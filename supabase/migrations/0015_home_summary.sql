-- The home screen's one call (INVARIANT [LOAD-01]): the figures behind the
-- four tiles, painted first from the last cached copy and refreshed with this.
--
-- budget:  this month's budget_month() without the receipt list; the app runs
--          the same projection it shows in the Budget module, so the tile's
--          verdict can never disagree with the module.
-- weekend: the screen's dates, program count and warning state, no items.
-- flights: how many trips are logged and when the last scan wrote; the deal
--          count itself is worked out in the Flights module and cached.
-- moving:  inventory and box counts.
create or replace function public.home_summary()
returns jsonb
language sql stable security invoker set search_path = public
as $$
  with wk as (select weekend_current() as w)
  select jsonb_build_object(
    'today', (now() at time zone 'Europe/Madrid')::date,
    'budget', budget_month((now() at time zone 'Europe/Madrid')::date) - 'receipts',
    'weekend', (
      select case when w->'screen' is null or w->'screen' = 'null'::jsonb then null else jsonb_build_object(
        'from', w->'screen'->>'weekend_from',
        'to', w->'screen'->>'weekend_to',
        'count', jsonb_array_length(w->'screen'->'items'),
        'alert', w->'screen'->>'alert_status',
        'stale', (w->>'stale')::boolean) end
      from wk),
    'flights', jsonb_build_object(
      'trips', (select count(*) from fare_quotes where kind = 'return'),
      'last_scan', (select max(found_at) from fare_quotes where source = 'scan')),
    'moving', jsonb_build_object(
      'items', (select count(*) from items),
      'boxes', (select count(*) from boxes))
  )
$$;

revoke all on function public.home_summary() from public, anon;
grant execute on function public.home_summary() to authenticated;
