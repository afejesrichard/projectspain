-- Budget read functions. All run with the caller's rights (security invoker),
-- so the editor-only policy on receipts keeps applying. They only read
-- receipts, never write them (INVARIANT [BUD-02]).

-- INVARIANT [BUD-01] — the single home of the rule that maps a receipt item to
-- a budget line. Each item's net is scaled so a receipt's items add up to its
-- printed total, and non-euro receipts are converted at the month's card rate
-- (the latest budgeted month's rate if that month has none). Amounts are left
-- unrounded here; callers round once, at the level they report.
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
      ((xpath('/item/net/text()', x))[1]::text)::numeric as net
    from it
  ), rated as (
    select f.*,
      case when cur = 'EUR' then 1 else coalesce(
        (select bm.huf_eur_rate from budget_months bm where bm.month = date_trunc('month', f.d)::date),
        (select bm.huf_eur_rate from budget_months bm where bm.month <= f.d order by bm.month desc limit 1)
      ) end as rate
    from f
  )
  select id, d, m,
    case
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
    end,
    net * (case when sum(net) over (partition by id) > 0 then tot / sum(net) over (partition by id) else 1 end) * rate
  from rated
$$;

-- Per receipt and line, in cents: what a receipt counts against each line.
create or replace function public.budget_receipt_lines(p_from date, p_to date)
returns table (receipt_id text, day date, merchant text, line text, cents bigint)
language sql stable security invoker set search_path = public
as $$
  select receipt_id, day, merchant, line, round(sum(eur) * 100)::bigint
  from budget_receipt_items(p_from, p_to)
  group by receipt_id, day, merchant, line
  order by day desc, receipt_id, line
$$;

-- The whole month view in one round trip, without sending receipt XML to the
-- phone. Sums are rounded to cents once per reported figure, as the budget
-- dashboard this replaces did. The projection itself is computed in the app
-- (src/lib/budget.ts) from these figures.
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

  with bm_items as materialized (
    select * from budget_receipt_items(m_start, m_end)
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
            from bm_items group by receipt_id, day, merchant, line) r), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- "Start month": copy the latest earlier month's net pay, rate and lines into
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
  insert into budget_months (month, net_pay_cents, huf_eur_rate, note)
    select target, net_pay_cents, huf_eur_rate, '' from budget_months where month = src;
  insert into budget_lines (month, line, label, grp, budget_cents, basis, model, due_day, sort)
    select target, line, label, grp, budget_cents, basis, model, due_day, sort
    from budget_lines where month = src;
  return target;
end;
$$;

revoke all on function public.budget_receipt_items(date, date) from public, anon;
revoke all on function public.budget_receipt_lines(date, date) from public, anon;
revoke all on function public.budget_month(date) from public, anon;
revoke all on function public.budget_start_month(date) from public, anon;
grant execute on function public.budget_receipt_items(date, date) to authenticated;
grant execute on function public.budget_receipt_lines(date, date) to authenticated;
grant execute on function public.budget_month(date) to authenticated;
grant execute on function public.budget_start_month(date) to authenticated;
