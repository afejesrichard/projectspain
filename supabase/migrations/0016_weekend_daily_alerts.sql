-- Hétvége: warnings refreshed every day. The Thursday scan writes the whole
-- screen once a week, but weather and civil protection warnings change faster
-- than that (a wind warning for Sunday can be issued on Friday). A second,
-- daily scheduled task re-checks the warnings and writes only those, through
-- weekend_alerts_save; the program list is never touched by it.

alter table public.weekend_screens
  add column if not exists alerts_checked_at timestamptz;

-- Replaces the warnings of the weekend on screen (the earliest one that has
-- not ended yet) and stamps when they were checked. Returns that weekend's
-- Friday, or null when there is no upcoming weekend to update (Monday to
-- Thursday, before the weekly scan has run): nothing is written then.
create or replace function public.weekend_alerts_save(p jsonb)
returns date
language plpgsql volatile security invoker set search_path = public
as $$
declare
  al jsonb;
  v_from date;
begin
  if coalesce(p->>'alert_status', '') not in ('ok', 'warn') or coalesce(p->>'alert_title', '') = '' then
    raise exception 'WEEKEND_BAD_ALERT: alert_status ok|warn and alert_title are required';
  end if;
  if jsonb_typeof(p->'alerts') is distinct from 'array' then
    raise exception 'WEEKEND_BAD_SHAPE: alerts must be an array';
  end if;
  for al in select * from jsonb_array_elements(p->'alerts') loop
    if coalesce(al->>'level', '') not in ('ok', 'warn', 'info') or coalesce(al->>'text', '') = '' then
      raise exception 'WEEKEND_BAD_ALERT_ITEM: %', al;
    end if;
  end loop;

  select w.weekend_from into v_from
  from weekend_screens w
  where w.weekend_to >= (now() at time zone 'Europe/Madrid')::date
  order by w.weekend_from asc limit 1;
  if v_from is null then
    return null;
  end if;

  update weekend_screens set
    alert_status = p->>'alert_status',
    alert_title = p->>'alert_title',
    alerts = p->'alerts',
    alerts_checked_at = now()
  where weekend_from = v_from;
  return v_from;
end;
$$;

revoke all on function public.weekend_alerts_save(jsonb) from public, anon;
grant execute on function public.weekend_alerts_save(jsonb) to authenticated;
