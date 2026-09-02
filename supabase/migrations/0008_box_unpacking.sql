-- Packing out: a box can be marked fully unpacked in the new home, and an
-- unpacked box can then be cleared away together with the items it held.
-- unpacked_at doubles as the flag and the record of when it happened.
-- (Applied to the live project as migration `box_unpacking`.)

alter table public.boxes
  add column if not exists unpacked_at timestamptz;

-- Clearing away an unpacked box removes the box AND its packed items in one
-- transaction — unlike a plain box delete, where the FK unpacks the items but
-- keeps them in the inventory.
create or replace function public.delete_box_with_items(p_box bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from boxes where id = p_box) then
    raise exception 'BOX_NOT_FOUND';
  end if;

  delete from items where box_id = p_box;
  delete from boxes where id = p_box;
end;
$$;

-- Editors only — anon must not be able to touch boxes through the definer.
revoke execute on function public.delete_box_with_items(bigint) from public, anon;
grant execute on function public.delete_box_with_items(bigint) to authenticated;
