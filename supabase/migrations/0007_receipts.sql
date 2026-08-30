-- Kiadások (Expenses): store-and-forward for receipt XML.
-- The app validates, stores and re-emits receipts; analysis happens outside.
-- The original <receipt> element text is kept verbatim in raw_xml (the app
-- never alters receipt content); the other columns are an index over it for
-- querying and display only. Rows are immutable — insert and delete only —
-- so there is no updated_at / touch trigger here.
create table if not exists public.receipts (
  -- The receipt @id. The primary key IS the uniqueness contract: a duplicate
  -- import fails with 23505 and is rejected, never merged or overwritten.
  id             text primary key,
  raw_xml        text not null,
  datetime       text not null,           -- exactly as given in the file
  local_date     date not null,           -- calendar date in the receipt's own offset
  merchant_name  text not null,
  chain          text,
  nif            text,
  receipt_number text,
  total_cents    bigint not null,         -- money as integer cents, never a float
  currency       text not null,
  source         text not null check (source in ('photo','text','manual')),
  confidence     text not null check (confidence in ('high','medium','low')),
  item_count     integer not null,
  search_text    text not null default '',
  warnings       jsonb not null default '[]'::jsonb,
  imported_at    timestamptz not null default now()
);

create index if not exists receipts_local_date_idx on public.receipts (local_date);
create index if not exists receipts_nif_ref_idx on public.receipts (nif, receipt_number);

alter table public.receipts enable row level security;

-- Editor-only, like every base table; receipts never appear in a public view.
drop policy if exists receipts_editor_all on public.receipts;
create policy receipts_editor_all on public.receipts
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.receipts;
