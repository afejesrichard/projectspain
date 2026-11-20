-- Repjegy (Flights): the BCN-BUD fare log. Written by the scheduled fare scan
-- (Mondays and Thursdays) and by the app's "log a trip" form; read by the
-- Flights module, which works out windows, averages and tiers itself
-- (src/lib/fares.ts). Money is integer cents (INVARIANT [EXP-04]).
--
-- Party sizes and the starting fare estimates live in app_settings under
-- 'fares' (INVARIANT [PRIV-01]), seeded in the database only.

create table if not exists public.fare_quotes (
  id                 text primary key,
  kind               text not null check (kind in ('return', 'leg')),
  -- return trips
  party              text check (party in ('family', 'grandparents')),
  origin             text check (origin in ('BCN', 'BUD')),
  out_date           date,
  ret_date           date,
  out_dep            text check (out_dep ~ '^\d{2}:\d{2}$'),
  out_arr            text check (out_arr ~ '^\d{2}:\d{2}$'),
  ret_dep            text check (ret_dep ~ '^\d{2}:\d{2}$'),
  ret_arr            text check (ret_arr ~ '^\d{2}:\d{2}$'),
  out_carrier        text,
  ret_carrier        text,
  -- one 1-adult fare, both legs together (a leg: that one flight)
  price_cents        bigint not null check (price_cents > 0),
  -- the whole party's total when a source showed it, else null
  party_price_cents  bigint check (party_price_cents > 0),
  -- one-way legs kept from the first scan as raw data
  travel_date        date,
  direction          text check (direction in ('BCN-BUD', 'BUD-BCN')),
  carrier            text,
  note               text not null default '',
  source             text not null check (source in ('scan', 'manual')),
  found_at           timestamptz not null default now(),
  check (kind <> 'return' or (party is not null and out_date is not null and ret_date is not null and ret_date > out_date
                              and out_carrier is not null and ret_carrier is not null)),
  check (kind <> 'leg' or (travel_date is not null and direction is not null and carrier is not null))
);

create index if not exists fare_quotes_out_date_idx on public.fare_quotes (out_date);

alter table public.fare_quotes enable row level security;
drop policy if exists fare_quotes_editor_all on public.fare_quotes;
create policy fare_quotes_editor_all on public.fare_quotes
  for all to authenticated using (true) with check (true);

-- A trip logged on one phone appears on the other.
alter publication supabase_realtime add table public.fare_quotes;

-- The scan's single entry point: validates each trip, inserts the new ones and
-- skips ids that already exist. Never updates or deletes. Returns how many
-- rows were inserted. Raises with the reason on bad input.
create or replace function public.fare_save(p jsonb)
returns integer
language plpgsql volatile security invoker set search_path = public
as $$
declare
  t jsonb;
  n integer := 0;
  added integer;
begin
  if jsonb_typeof(p) is distinct from 'array' then
    raise exception 'FARE_BAD_SHAPE: pass a JSON array of trips';
  end if;
  for t in select * from jsonb_array_elements(p) loop
    if coalesce(t->>'id', '') !~ '^[A-Za-z0-9_-]{1,80}$' then
      raise exception 'FARE_BAD_ID: %', t->>'id';
    end if;
    if coalesce(t->>'party', '') not in ('family', 'grandparents')
       or (t->>'out_date') is null or (t->>'ret_date') is null
       or (t->>'ret_date')::date <= (t->>'out_date')::date
       or jsonb_typeof(t->'price_cents') is distinct from 'number' or (t->>'price_cents')::numeric <= 0
       or (t->>'price_cents')::numeric <> trunc((t->>'price_cents')::numeric)
       or coalesce(t->>'out_carrier', '') = '' or coalesce(t->>'ret_carrier', '') = '' then
      raise exception 'FARE_BAD_TRIP: %', t->>'id';
    end if;
    insert into fare_quotes (id, kind, party, origin, out_date, ret_date, out_dep, out_arr, ret_dep, ret_arr,
                             out_carrier, ret_carrier, price_cents, party_price_cents, note, source, found_at)
    values (t->>'id', 'return', t->>'party',
            coalesce(t->>'origin', case when t->>'party' = 'grandparents' then 'BUD' else 'BCN' end),
            (t->>'out_date')::date, (t->>'ret_date')::date,
            nullif(t->>'out_dep', ''), nullif(t->>'out_arr', ''), nullif(t->>'ret_dep', ''), nullif(t->>'ret_arr', ''),
            t->>'out_carrier', t->>'ret_carrier',
            (t->>'price_cents')::bigint, nullif((t->>'party_price_cents')::bigint, 0),
            left(coalesce(t->>'note', ''), 300), coalesce(t->>'source', 'scan'),
            coalesce((t->>'found_at')::timestamptz, now()))
    on conflict (id) do nothing;
    get diagnostics added = row_count;
    n := n + added;
  end loop;
  return n;
end;
$$;

revoke all on function public.fare_save(jsonb) from public, anon;
grant execute on function public.fare_save(jsonb) to authenticated;
