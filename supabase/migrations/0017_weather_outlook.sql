-- Időjárás: a standing daily outlook, not tied to any weekend. A scheduled
-- Claude task checks the warnings and the forecast every morning and saves
-- today plus the next two days here, through weather_save. The Weekend screen
-- and the home tile read it. The weekly program scan no longer checks the
-- weather at all: there is one weather feed, this one. The scan's alerts are
-- now optional and only carry notes that are not about weather (an upcoming
-- city event, say).
--
-- This replaces 0016's weekend_alerts_save, which could only refresh the
-- warnings of a weekend that was already on screen.

drop function if exists public.weekend_alerts_save(jsonb);
alter table public.weekend_screens drop column if exists alerts_checked_at;

-- One row, replaced by every check.
create table if not exists public.weather_outlook (
  id          boolean primary key default true check (id),
  checked_at  timestamptz not null default now(),
  status      text not null check (status in ('ok', 'warn')),
  title       text not null,
  -- [{date: YYYY-MM-DD, level: ok|warn, summary, tmin?, tmax?, rain_pct?, gust_kmh?}]
  days        jsonb not null check (jsonb_typeof(days) = 'array'),
  -- [{level: ok|warn|info, tag, text, note?}]
  alerts      jsonb not null default '[]'::jsonb check (jsonb_typeof(alerts) = 'array')
);

alter table public.weather_outlook enable row level security;
drop policy if exists weather_outlook_editor_all on public.weather_outlook;
create policy weather_outlook_editor_all on public.weather_outlook
  for all to authenticated using (true) with check (true);

-- The daily check's single entry point. Days must be consecutive calendar
-- days starting today (Barcelona time), one to four of them, so a run that
-- reports the wrong dates fails loudly instead of reaching the screen.
create or replace function public.weather_save(p jsonb)
returns timestamptz
language plpgsql volatile security invoker set search_path = public
as $$
declare
  d jsonb;
  al jsonb;
  k text;
  i int := 0;
  n int;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_now timestamptz := now();
begin
  if coalesce(p->>'status', '') not in ('ok', 'warn') or coalesce(p->>'title', '') = '' then
    raise exception 'WEATHER_BAD_STATUS: status ok|warn and title are required';
  end if;
  if jsonb_typeof(p->'days') is distinct from 'array' or jsonb_typeof(p->'alerts') is distinct from 'array' then
    raise exception 'WEATHER_BAD_SHAPE: days and alerts must be arrays';
  end if;
  n := jsonb_array_length(p->'days');
  if n < 1 or n > 4 then
    raise exception 'WEATHER_BAD_DAYS: one to four days, starting today';
  end if;

  for d in select * from jsonb_array_elements(p->'days') loop
    if coalesce(d->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$' or (d->>'date')::date <> v_today + i then
      raise exception 'WEATHER_BAD_DAY: day % must be % (consecutive days from today)', i + 1, v_today + i;
    end if;
    if coalesce(d->>'level', '') not in ('ok', 'warn') or coalesce(d->>'summary', '') = '' then
      raise exception 'WEATHER_BAD_DAY: % needs level ok|warn and a summary', d->>'date';
    end if;
    foreach k in array array['tmin', 'tmax', 'rain_pct', 'gust_kmh'] loop
      if d ? k and jsonb_typeof(d->k) is distinct from 'number' then
        raise exception 'WEATHER_BAD_DAY: % % must be a number', d->>'date', k;
      end if;
    end loop;
    i := i + 1;
  end loop;

  for al in select * from jsonb_array_elements(p->'alerts') loop
    if coalesce(al->>'level', '') not in ('ok', 'warn', 'info') or coalesce(al->>'text', '') = '' then
      raise exception 'WEATHER_BAD_ALERT: %', al;
    end if;
  end loop;

  insert into weather_outlook (id, checked_at, status, title, days, alerts)
  values (true, v_now, p->>'status', p->>'title', p->'days', p->'alerts')
  on conflict (id) do update set
    checked_at = excluded.checked_at,
    status = excluded.status,
    title = excluded.title,
    days = excluded.days,
    alerts = excluded.alerts;
  return v_now;
end;
$$;

revoke all on function public.weather_save(jsonb) from public, anon;
grant execute on function public.weather_save(jsonb) to authenticated;

-- The Weekend screen's one call now also carries the outlook.
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
    'home', (select value from app_settings where key = 'home'),
    'weather', (select to_jsonb(o) - 'id' from weather_outlook o)
  )
$$;

-- Home's one call: the outlook's state and the last day it covers, so the
-- tile can show a warning on any day of the week.
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
    'weather', (
      select jsonb_build_object('status', o.status, 'lastDay', o.days->-1->>'date')
      from weather_outlook o),
    'flights', jsonb_build_object(
      'trips', (select count(*) from fare_quotes where kind = 'return'),
      'last_scan', (select max(found_at) from fare_quotes where source = 'scan')),
    'moving', jsonb_build_object(
      'items', (select count(*) from items),
      'boxes', (select count(*) from boxes))
  )
$$;

-- The weekly scan no longer has to report weather: alert_status, alert_title
-- and alerts are optional (ok, empty, none). Everything else is as in 0013.
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
  if coalesce(p->>'alert_status', 'ok') not in ('ok', 'warn') then
    raise exception 'WEEKEND_BAD_ALERT: alert_status, when given, is ok|warn';
  end if;
  if jsonb_typeof(p->'items') is distinct from 'array'
     or (p ? 'alerts' and jsonb_typeof(p->'alerts') is distinct from 'array') then
    raise exception 'WEEKEND_BAD_SHAPE: items must be an array, and alerts too when given';
  end if;

  for al in select * from jsonb_array_elements(coalesce(p->'alerts', '[]'::jsonb)) loop
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
          coalesce(p->>'alert_status', 'ok'), coalesce(p->>'alert_title', ''),
          coalesce(p->'alerts', '[]'::jsonb), p->'items')
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
