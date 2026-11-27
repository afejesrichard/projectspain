-- BUG-S01: subscription receipts were counted twice. Auto (subscription)
-- lines filled from due_day alone, and the same receipt also fell through the
-- category rule into 'other'. A receipt item with sub="subscription" that
-- matches an auto line of its month now maps to that line instead.
-- INVARIANT [BUD-01]: this stays the single home of the item-to-line rule.
-- Everything except the subscription match is unchanged from 0012: the same
-- category rule, the same scaling to the printed total and the same rate
-- lookup (no new FX logic).
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
      case when cur = 'EUR' then 1 else coalesce(
        (select bm.huf_eur_rate from budget_months bm where bm.month <= f.d order by bm.month desc limit 1),
        (select bm.huf_eur_rate from budget_months bm where bm.month > f.d order by bm.month asc limit 1)
      ) end as rate
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
