-- A month with no budget row of its own (e.g. October, before budgets were
-- kept here) still converts forint receipts: at the latest earlier budgeted
-- month's rate, or failing that the earliest later one. Without the second
-- step, forint receipts before the first budgeted month dropped out.
-- INVARIANT [BUD-01]: this stays the single home of the item-to-line rule.
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
        (select bm.huf_eur_rate from budget_months bm where bm.month <= f.d order by bm.month desc limit 1),
        (select bm.huf_eur_rate from budget_months bm where bm.month > f.d order by bm.month asc limit 1)
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
