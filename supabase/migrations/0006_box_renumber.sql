-- Renumbering boxes: the row id IS the box number, so renumbering means
-- changing the primary key. Items follow via the FK; the identity sequence is
-- bumped so "Új doboz" never collides with a hand-picked number.
-- (Applied to the live project as migration `box_renumbering`.)

-- Items must follow their box to its new number.
alter table public.items
  drop constraint if exists items_box_id_fkey;
alter table public.items
  add constraint items_box_id_fkey
    foreign key (box_id) references public.boxes(id)
    on delete set null
    on update cascade;

create or replace function public.renumber_box(p_old bigint, p_new bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_new is null or p_new < 1 then
    raise exception 'BOX_NUMBER_INVALID';
  end if;
  if p_new = p_old then
    return;
  end if;
  if exists (select 1 from boxes where id = p_new) then
    raise exception 'BOX_NUMBER_TAKEN';
  end if;

  update boxes set id = p_new where id = p_old;
  if not found then
    raise exception 'BOX_NOT_FOUND';
  end if;

  -- Keep the identity sequence ahead of any hand-picked number.
  perform setval(
    pg_get_serial_sequence('boxes', 'id'),
    (select max(id) from boxes),
    true
  );
end;
$$;

-- Editors only — anon must not be able to touch boxes through the definer.
revoke execute on function public.renumber_box(bigint, bigint) from public, anon;
grant execute on function public.renumber_box(bigint, bigint) to authenticated;
