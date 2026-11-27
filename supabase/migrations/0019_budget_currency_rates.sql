-- BUG-FX01: every non-EUR receipt was converted at the forint rate, so a
-- USD 19.09 card charge counted as EUR 0.05. budget_months gets its own
-- dollar rate (euros per dollar, the card rate, entered in the app like the
-- forint rate and copied by "start month"), and the rate is looked up per
-- currency. A currency with no rate is reported, not guessed.
-- INVARIANT [BUD-01]: budget_receipt_items stays the single home of the
-- item-to-line rule; the BUG-S01 subscription match and the category rule are
-- carried over from 0018 unchanged. Only the rate step changes.

alter table public.budget_months
  add column if not exists usd_eur_rate numeric check (usd_eur_rate > 0);

create or replace function public.budget_receipt_items(p_from date, p_to date)
returns table (receipt_id text, day date, merchant text, line text, eur numeric)
language sql stable security invoker set search_path = public
as $$
  with it as (
    select r.id, r.local_date as d, r.merchant_name as m, r.currency as cur,
           r.total_cents / 100.0 as tot,
           unnest(xpath('//item', r.raw_xml::xml)) as x
    from receipts r
    where r.local_date between p_from and p_to
  ), f as (
    select id, d, m, cur, tot,
      (xpath('/item/@category', x))[1]::text as cat,
      coalesce((xpath('/item/@sub', x))[1]::text, '') as sub,
      coalesce((xpath('/item/@line', x))[1]::text, '') as line_attr,
      ((xpath('/item/net/text()', x))[1]::text)::numeric as net
    from it
  ), rated as (
    select f.*,
      -- INVARIANT [BUG-FX01]: each currency converts at its own rate, never another currency's.
      -- Before: every non-EUR receipt used huf_eur_rate, so USD 19.09 counted as EUR 0.05.
      -- A currency with no rate gives a null rate: the receipt is reported as
      -- unconverted by budget_month() instead of being counted at a wrong rate.
      -- Each currency keeps the HUF rule from 0012: the latest budgeted month
      -- with that rate on or before the receipt, else the earliest later one.
      case cur
        when 'EUR' then 1
        when 'HUF' then coalesce(
          (select bm.huf_eur_rate from budget_months bm where bm.month <= f.d order by bm.month desc limit 1),
          (select bm.huf_eur_rate from budget_months bm where bm.month > f.d order by bm.month asc limit 1))
        when 'USD' then coalesce(
          (select bm.usd_eur_rate from budget_months bm where bm.month <= f.d and bm.usd_eur_rate is not null order by bm.month desc limit 1),
          (select bm.usd_eur_rate from budget_months bm where bm.month > f.d and bm.usd_eur_rate is not null order by bm.month asc limit 1))
      end as rate
    from f
  ), matched as (
    -- INVARIANT [BUG-S01]: a subscription receipt is counted on its auto line only, never also in Other.
    -- Before: auto lines used due_day only and the receipt also landed in Other (double count).
    -- Auto lines without a receipt must still fill on due_day: most subscriptions are never logged.
    -- Match order, among the auto lines of the receipt's own month (by local_date):
    -- the item's line="..." attribute, then the merchant name equal (ignoring
    -- case and outer spaces) to the line key, then to the line label. Exact
    -- equality on purpose: a substring match would send "Microsoft 365" or
    -- "Amazon Prime (Amazon.es)" to the wrong line. No match: sub_line is null
    -- and the item goes through the category rule as before.
    select rated.*,
      case when rated.sub = 'subscription' then (
        select bl.line from budget_lines bl
        where bl.month = date_trunc('month', rated.d)::date
          and bl.model = 'auto'
          and (bl.line = rated.line_attr
               or lower(bl.line) = lower(trim(rated.m))
               or lower(bl.label) = lower(trim(rated.m)))
        order by case
                   when bl.line = rated.line_attr then 0
                   when lower(bl.line) = lower(trim(rated.m)) then 1
                   else 2
                 end, bl.sort, bl.line
        limit 1
      ) end as sub_line
    from rated
  )
  select id, d, m,
    -- INVARIANT [BUG-S01]: a subscription receipt is counted on its auto line only, never also in Other.
    -- Before: auto lines used due_day only and the receipt also landed in Other (double count).
    -- Auto lines without a receipt must still fill on due_day: most subscriptions are never logged.
    -- A matched item takes its auto line here and never reaches the 'other'
    -- fall-through below. The category rule itself is unchanged from 0012.
    coalesce(sub_line, case
      when cat = 'housing' and sub = 'rent' then 'rent'
      when cat = 'housing' and sub in ('electricity', 'home-services') then 'electricity'
      when cat = 'housing' and (sub like 'water%' or sub in ('sewer-tax', 'waste-tax', 'vat') or m ilike 'Aig%es de Barcelona%') then 'water'
      when cat = 'housing' and sub = 'parking' then 'garage'
      when cat = 'housing' and sub in ('internet', 'mobile') then 'telecom'
      when cat = 'housing' then 'other'
      when sub in ('flights', 'membership') then 'travel'
      when cat = 'home-setup' then 'home-setup'
      when cat = 'admin' or sub in ('car-admin', 'car-repair', 'car-equipment') then 'admin'
      when cat = 'food' then 'groceries'
      when cat = 'alcohol' then 'drinks'
      when cat = 'household' then 'household'
      when cat = 'eating-out' then 'eating-out'
      when cat = 'kids' then 'kids'
      when cat = 'transport' then 'transport'
      when cat = 'leisure' then 'leisure'
      when cat = 'health' then 'health'
      else 'other'
    end),
    net * (case when sum(net) over (partition by id) > 0 then tot / sum(net) over (partition by id) else 1 end) * rate
  from matched
$$;

create or replace function public.budget_month(p_month date)
returns jsonb
language plpgsql stable security invoker set search_path = public
as $$
declare
  m_start date := date_trunc('month', p_month)::date;
  m_end   date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_dim   integer := extract(day from (date_trunc('month', p_month) + interval '1 month - 1 day'))::integer;
  v_dom   integer;
  result  jsonb;
begin
  v_dom := case
    when v_today < m_start then 0
    when v_today > m_end then v_dim
    else extract(day from v_today)::integer
  end;

  -- INVARIANT [BUG-FX01]: an item with no rate for its currency is left out
  -- of every sum and listed under 'unconverted' instead, so the screen can say
  -- so. It is never counted at another currency's rate.
  with all_items as materialized (
    select * from budget_receipt_items(m_start, m_end)
  ), bm_items as materialized (
    select * from all_items where eur is not null
  ), everyday_lines as (
    select bl.line from budget_lines bl where bl.month = m_start and bl.grp = 'Everyday'
  )
  select jsonb_build_object(
    'month', m_start,
    'today', v_today,
    'days_in_month', v_dim,
    'day_of_month', v_dom,
    'days_left', v_dim - v_dom,
    'months', coalesce((select jsonb_agg(month order by month) from budget_months), '[]'::jsonb),
    'settings', (select to_jsonb(bm) - 'created_at' - 'updated_at' from budget_months bm where bm.month = m_start),
    'lines', coalesce((
      select jsonb_agg(to_jsonb(bl) - 'month' - 'updated_at' order by bl.sort, bl.line)
      from budget_lines bl where bl.month = m_start), '[]'::jsonb),
    'spent', coalesce((
      select jsonb_agg(jsonb_build_object('line', line, 'cents', cents, 'receipts', n) order by cents desc)
      from (select line, round(sum(eur) * 100)::bigint as cents, count(distinct receipt_id)::int as n
            from bm_items group by line) s), '[]'::jsonb),
    'logged_cents', (select coalesce(round(sum(eur) * 100), 0)::bigint from bm_items),
    'receipt_count', (select count(distinct receipt_id)::int from bm_items),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
               'day', d.dd::date,
               'cents', d.cents,
               'everyday_cents', d.everyday_cents,
               'cumulative_cents', d.cumulative_cents) order by d.dd)
      from (
        select s.dd,
          round(coalesce(sum(i.eur), 0) * 100)::bigint as cents,
          round(coalesce(sum(i.eur) filter (where i.line in (select line from everyday_lines)), 0) * 100)::bigint as everyday_cents,
          round(sum(coalesce(sum(i.eur), 0)) over (order by s.dd) * 100)::bigint as cumulative_cents
        from generate_series(m_start, least(v_today, m_end), interval '1 day') s(dd)
        left join bm_items i on i.day = s.dd::date
        group by s.dd
      ) d), '[]'::jsonb),
    'receipts', coalesce((
      select jsonb_agg(jsonb_build_object('id', receipt_id, 'day', day, 'merchant', merchant, 'line', line, 'cents', cents)
                       order by day desc, receipt_id, line)
      from (select receipt_id, day, merchant, line, round(sum(eur) * 100)::bigint as cents
            from bm_items group by receipt_id, day, merchant, line) r), '[]'::jsonb),
    'unconverted', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'day', r.local_date, 'merchant', r.merchant_name, 'currency', r.currency)
                       order by r.local_date desc, r.id)
      from receipts r
      where r.id in (select receipt_id from all_items where eur is null)), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- "Start month": copy the latest earlier month's net pay, rates and lines into
-- a new month, ready to edit. Fails with MONTH_EXISTS or NO_SOURCE_MONTH.
create or replace function public.budget_start_month(p_month date)
returns date
language plpgsql volatile security invoker set search_path = public
as $$
declare
  target date := date_trunc('month', p_month)::date;
  src    date;
begin
  if exists (select 1 from budget_months where month = target) then
    raise exception 'MONTH_EXISTS';
  end if;
  select max(month) into src from budget_months where month < target;
  if src is null then
    raise exception 'NO_SOURCE_MONTH';
  end if;
  insert into budget_months (month, net_pay_cents, huf_eur_rate, usd_eur_rate, note)
    select target, net_pay_cents, huf_eur_rate, usd_eur_rate, '' from budget_months where month = src;
  insert into budget_lines (month, line, label, grp, budget_cents, basis, model, due_day, sort)
    select target, line, label, grp, budget_cents, basis, model, due_day, sort
    from budget_lines where month = src;
  return target;
end;
$$;
