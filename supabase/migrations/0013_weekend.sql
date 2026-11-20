-- Hétvége (Weekend): the weekly family-program screen, written by a scheduled
-- Claude task every Thursday evening and read by the app. One row per screened
-- weekend; the JSON keeps the shape the scan already produces.
--
-- app_settings holds personal values the app needs but the public repo must
-- not (INVARIANT [PRIV-01]): the home address directions start from, and later
-- the travel party and fare estimates. Seeded in the database, never here.

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

alter table public.app_settings enable row level security;
drop policy if exists app_settings_editor_all on public.app_settings;
create policy app_settings_editor_all on public.app_settings
  for all to authenticated using (true) with check (true);

create table if not exists public.weekend_screens (
  weekend_from  date primary key,
  weekend_to    date not null check (weekend_to >= weekend_from),
  screened_at   timestamptz not null default now(),
  next_screen   date,
  alert_status  text not null check (alert_status in ('ok', 'warn')),
  alert_title   text not null,
  -- [{level: ok|warn|info, tag, text, note?}]
  alerts        jsonb not null default '[]'::jsonb check (jsonb_typeof(alerts) = 'array'),
  -- [{name, type: free|paid, zone: city|trip, km, time, days: [Fri|Sat|Sun],
  --   where, desc, ages?, price?, verify?, link, maps}]
  items         jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array')
);

alter table public.weekend_screens enable row level security;
drop policy if exists weekend_screens_editor_all on public.weekend_screens;
create policy weekend_screens_editor_all on public.weekend_screens
  for all to authenticated using (true) with check (true);

-- The screen the app shows, in one call: the earliest weekend that has not
-- ended yet, or else the latest one marked stale (Thursday's scan has not run),
-- plus the home address for directions.
create or replace function public.weekend_current()
returns jsonb
language sql stable security invoker set search_path = public
as $$
  with today as (select (now() at time zone 'Europe/Madrid')::date as d),
  live as (
    select w.* from weekend_screens w, today
    where w.weekend_to >= today.d order by w.weekend_from asc limit 1
  ),
  latest as (
    select w.* from weekend_screens w order by w.weekend_from desc limit 1
  ),
  pick as (
    select l.*, false as stale from live l
    union all
    select x.*, true from latest x where not exists (select 1 from live)
  )
  select jsonb_build_object(
    'today', (select d from today),
    'screen', (select to_jsonb(p) - 'stale' from pick p),
    'stale', coalesce((select stale from pick), false),
    'home', (select value from app_settings where key = 'home')
  )
$$;

-- The scan's single entry point: validates the screen and writes it, replacing
-- that weekend's row if the scan runs again. Raises with the reason on bad
-- input, so a malformed run fails loudly instead of breaking the page.
create or replace function public.weekend_save(p jsonb)
returns date
language plpgsql volatile security invoker set search_path = public
as $$
declare
  it jsonb;
  al jsonb;
  v_from date := (p->>'weekend_from')::date;
  v_to date := (p->>'weekend_to')::date;
begin
  if v_from is null or v_to is null or v_to < v_from or v_to - v_from > 3 then
    raise exception 'WEEKEND_BAD_DATES: weekend_from/weekend_to must be a Fri-Sun span';
  end if;
  if coalesce(p->>'alert_status', '') not in ('ok', 'warn') or coalesce(p->>'alert_title', '') = '' then
    raise exception 'WEEKEND_BAD_ALERT: alert_status ok|warn and alert_title are required';
  end if;
  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_typeof(p->'alerts') is distinct from 'array' then
    raise exception 'WEEKEND_BAD_SHAPE: items and alerts must be arrays';
  end if;

  for al in select * from jsonb_array_elements(p->'alerts') loop
    if coalesce(al->>'level', '') not in ('ok', 'warn', 'info') or coalesce(al->>'text', '') = '' then
      raise exception 'WEEKEND_BAD_ALERT_ITEM: %', al;
    end if;
  end loop;

  for it in select * from jsonb_array_elements(p->'items') loop
    if coalesce(it->>'name', '') = ''
       or coalesce(it->>'type', '') not in ('free', 'paid')
       or coalesce(it->>'zone', '') not in ('city', 'trip')
       or jsonb_typeof(it->'km') is distinct from 'number'
       or jsonb_typeof(it->'days') is distinct from 'array'
       or exists (select 1 from jsonb_array_elements_text(it->'days') d where d not in ('Fri', 'Sat', 'Sun'))
       or coalesce(it->>'link', '') !~ '^https?://'
       or coalesce(it->>'maps', '') = '' then
      raise exception 'WEEKEND_BAD_ITEM: %', it->>'name';
    end if;
  end loop;

  insert into weekend_screens (weekend_from, weekend_to, screened_at, next_screen, alert_status, alert_title, alerts, items)
  values (v_from, v_to, coalesce((p->>'screened_at')::timestamptz, now()), (p->>'next_screen')::date,
          p->>'alert_status', p->>'alert_title', p->'alerts', p->'items')
  on conflict (weekend_from) do update set
    weekend_to = excluded.weekend_to,
    screened_at = excluded.screened_at,
    next_screen = excluded.next_screen,
    alert_status = excluded.alert_status,
    alert_title = excluded.alert_title,
    alerts = excluded.alerts,
    items = excluded.items;
  return v_from;
end;
$$;

revoke all on function public.weekend_current() from public, anon;
revoke all on function public.weekend_save(jsonb) from public, anon;
grant execute on function public.weekend_current() to authenticated;
grant execute on function public.weekend_save(jsonb) to authenticated;
