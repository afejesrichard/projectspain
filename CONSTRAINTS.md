# Constraints

Rules that must survive any later rewrite. Each is marked in code with a
`// INVARIANT [..]` (or CONTRACT) comment at the site that enforces it.

## Expenses (Kiadások)

- **INVARIANT [EXP-01]** — the app never alters receipt content. Storage keeps
  the original `<receipt>` element text exactly as it appeared in the uploaded
  file; export re-emits it unchanged. If a parser cannot round-trip
  byte-for-byte, keep the raw substring from the uploaded file instead of
  re-serialising a DOM. Enforced in `src/lib/expenses.ts`
  (`extractReceiptRanges`, `buildExportXml`).

- **INVARIANT [EXP-02]** — the only aggregation in this feature is the sum of
  `total` for a filtered list. Category, VAT, merchant and recurrence analysis
  are done by Claude on the exported file, not here. Enforced in
  `src/screens/Expenses.tsx` (the visible-set sum).

- **INVARIANT [EXP-03]** — date range filtering uses `local_date`, derived from
  the receipt's own offset, never a UTC conversion. A receipt at `23:30+02:00`
  belongs to that calendar day. Enforced in `src/lib/expenses.ts`
  (`localDateOf`) and `src/screens/Expenses.tsx` (the range filter).

- **INVARIANT [EXP-04]** — money is never stored or compared as a float.
  Amounts live as integer cents (or the original decimal string inside the
  verbatim XML); every tolerance check compares integer cents. Enforced in
  `src/lib/expenses.ts` (`parseCents` and the arithmetic checks).

- **CONTRACT** — the receipt `@id` is unique across the store. A duplicate-id
  import is rejected, never merged or overwritten. Enforced by the `receipts`
  primary key (`supabase/migrations/0007_receipts.sql`) and surfaced in
  `src/data/repo.ts` (`insertReceipt`, 23505 → rejected).
