-- Photo thumbnails, so the app stops shipping every full-size photo on every
-- load. Photos are inline base64 in `photos` (~150 KB each, ~25 MB in total);
-- pulling all of them on each open exhausted the free plan's 5.5 GB/month
-- egress and the whole project was cut off. From now on:
--   - `thumb`       a ~320px JPEG data URL of the first photo, rendered by the
--                   client on every photo write, read by every grid
--   - `photo_count` how many photos a row holds, without fetching them
-- Full photos are fetched per row, only by detail screens / the lightbox.
-- Rows saved before this migration have no thumb yet; the app backfills them
-- on its next load (see backfillThumbs in src/store.ts).
-- (Applied to the live project as migration `photo_thumbs`.)

alter table public.items
  add column if not exists thumb text,
  add column if not exists photo_count integer
    generated always as (jsonb_array_length(photos)) stored;

alter table public.boxes
  add column if not exists thumb text,
  add column if not exists photo_count integer
    generated always as (jsonb_array_length(photos)) stored;

-- The public catalogue gets the same two columns (appended, so the view can
-- be replaced in place). Still only safe columns: no private_note, no
-- proposed_by, no approval state.
create or replace view public.public_items
with (security_invoker = false) as
  select id, name, cover, photos, disposition, price_huf, status, description, created_at,
         thumb, photo_count
  from public.items
  where published = true
    and disposition in ('sell','give')
    and status <> 'gone';

grant select on public.public_items to anon, authenticated;
