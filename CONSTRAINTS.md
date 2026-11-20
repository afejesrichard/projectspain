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

- **INVARIANT [EXP-02]** — the receipts list aggregates only the sum of
  `total` for the visible set. Category, VAT, merchant and recurrence analysis
  of receipts is done by Claude on the exported file. (Narrowed in the budget
  phase: the Budget module's month view is a separate feature with its own
  rules, BUD-01 and BUD-02.) Enforced in `src/screens/Expenses.tsx` (the
  visible-set sum).

- **INVARIANT [EXP-03]** — date range filtering uses `local_date`, derived from
  the receipt's own offset, never a UTC conversion. A receipt at `23:30+02:00`
  belongs to that calendar day. Enforced in `src/lib/expenses.ts`
  (`localDateOf`) and `src/screens/Expenses.tsx` (the range filter).

- **INVARIANT [EXP-04]** — money is never stored or compared as a float.
  Amounts live as integer cents (or the original decimal string inside the
  verbatim XML); every tolerance check compares integer cents. This binds the
  budget too: `budget_cents`, `net_pay_cents`, and every figure in
  `src/lib/budget.ts` is cents, with typed amounts parsed without float maths
  (`parseEurInput`). Enforced in `src/lib/expenses.ts` (`parseCents` and the
  arithmetic checks) and `src/lib/budget.ts`.

- **CONTRACT** — the receipt `@id` is unique across the store. A duplicate-id
  import is rejected, never merged or overwritten. Enforced by the `receipts`
  primary key (`supabase/migrations/0007_receipts.sql`) and surfaced in
  `src/data/repo.ts` (`insertReceipt`, 23505 → rejected).

## Loading

- **INVARIANT [LOAD-01]** — no module fetches data or opens a live channel
  before its route mounts. Module stores (`src/stores/moving.ts`,
  `src/stores/receipts.ts`, `src/stores/budget.ts`) never load at import time;
  the route that needs one acquires its lifecycle on mount (a module's parent
  route, or a `Hold` around a group of routes) and releases it on unmount,
  which removes the channel. Home makes exactly one data call,
  `home_summary()`; its tiles paint first from the figures cached on the
  device and repaint when the summary lands. The service worker is registered
  only after sign-in, so the public catalogue never downloads the editor.
  Enforced in `src/lib/moduleLifecycle.ts`, `src/components/ModuleLayout.tsx`,
  `src/screens/Home.tsx`, `src/lib/homeSummary.ts` and `src/lib/pwa.ts`.

## Help

- **INVARIANT [HELP-01]** — no explanatory prose on a screen outside a help
  surface. A screen shows labels, numbers, state and controls. Any sentence
  that explains how to read something, or why, opens from a `<Help>` button
  beside its section title (at most one per section) or from the module's
  guide. Still allowed inline: a one-line empty state, an error or status
  line, a destructive-action confirmation, a chart legend. Help text lives in
  `src/help/<module>.ts`, keyed by id, and ships in that module's chunk.
  Enforced in `src/components/Help.tsx`.

## Budget

- **INVARIANT [BUD-01]** — the mapping from a receipt item to a budget line
  exists in one place, the `budget_receipt_items` database function, which
  also scales item nets to the printed total and converts forints at the
  month's rate. Nothing else classifies receipt items. Enforced in
  `supabase/migrations/0012_budget_rate_fallback.sql` (the current
  definition).

- **INVARIANT [BUD-02]** — the Budget module never writes to receipts. Its
  functions only read them, and its store writes only `budget_months` and
  `budget_lines`. Enforced in `supabase/migrations/0011_budget_functions.sql`
  and `src/stores/budget.ts`.

## Privacy

- **INVARIANT [PRIV-01]** — no personal data in the repository: the repo is
  public. Addresses, pay, budget amounts and their reasoning, and travel
  party details live in the database behind the login. Seeds that carry them
  are applied to the database directly and never committed; tests use
  synthetic figures. Enforced in `supabase/migrations/0010_budget.sql` (the
  note on seeding) and `src/help/help.test.ts` (help text carries no
  addresses or amounts).
