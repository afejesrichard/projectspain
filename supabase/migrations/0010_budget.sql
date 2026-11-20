-- Költségvetés (Budget): one row per budgeted month and one per budget line.
-- Money is integer cents (INVARIANT [EXP-04]). Amounts, net pay and the
-- reasoning behind each line are personal, so they are entered in the app or
-- seeded straight into the database, never committed (INVARIANT [PRIV-01]).

create table if not exists public.budget_months (
  month          date primary key check (extract(day from month) = 1),
  net_pay_cents  bigint  not null check (net_pay_cents >= 0),
  -- euros per forint, the card rate forint receipts are converted at
  huf_eur_rate   numeric not null check (huf_eur_rate > 0),
  note           text    not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.budget_lines (
  month         date   not null references public.budget_months (month) on delete cascade,
  -- key that receipt items map to (see budget_receipt_items), or a
  -- subscription's own key, which no receipt maps to
  line          text   not null,
  label         text   not null,
  grp           text   not null check (grp in ('Housing and bills', 'Subscriptions', 'Everyday', 'One-offs')),
  budget_cents  bigint not null check (budget_cents >= 0),
  basis         text   not null default '',
  -- how the month end is projected: fixed and lumpy end at max(budget, spent);
  -- auto is a subscription counted as spent from due_day; pace continues at a
  -- blend of the month's own pace and the budget's
  model         text   not null check (model in ('fixed', 'auto', 'pace', 'lumpy')),
  due_day       integer check (due_day between 1 and 31),
  sort          integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (month, line),
  check (model <> 'auto' or due_day is not null)
);

drop trigger if exists budget_months_touch on public.budget_months;
create trigger budget_months_touch before update on public.budget_months
  for each row execute function public.touch_updated_at();

drop trigger if exists budget_lines_touch on public.budget_lines;
create trigger budget_lines_touch before update on public.budget_lines
  for each row execute function public.touch_updated_at();

alter table public.budget_months enable row level security;
alter table public.budget_lines enable row level security;

-- Editor-only, like every base table.
drop policy if exists budget_months_editor_all on public.budget_months;
create policy budget_months_editor_all on public.budget_months
  for all to authenticated using (true) with check (true);

drop policy if exists budget_lines_editor_all on public.budget_lines;
create policy budget_lines_editor_all on public.budget_lines
  for all to authenticated using (true) with check (true);

-- An edit on one phone shows on the other.
alter publication supabase_realtime add table public.budget_months;
alter publication supabase_realtime add table public.budget_lines;
