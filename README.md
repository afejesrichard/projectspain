# Project Spain

A private, mobile-first family app for two people (Richard & Dorka), installable
to the phone's home screen. Home is a grid of four modules, each loaded only
when opened:

- **Költségvetés (Budget):** the month against its budget with a month-end
  projection, built from the receipts they import, plus the receipts list.
- **Hétvége (Weekend):** this weekend's family programs and weather or civil
  protection warnings, screened every Thursday evening by a scheduled Claude task.
- **Repjegy (Flights):** a BCN–BUD fare watch for the family and the
  grandparents, fed twice a week by a scheduled Claude scan.
- **Költözés (Moving):** the relocation inventory and boxes, plus a public,
  read-only catalogue that makes the "for sale" pile easy to share with a link.

**Live (GitHub Pages):** https://afejesrichard.github.io/projectspain/
**Public catalogue:** https://afejesrichard.github.io/projectspain/#/nyilvanos

Deployed automatically by GitHub Actions on every push (see
`.github/workflows/deploy.yml`) — nothing to install or run locally.

The interface is a **shipping manifest**, from the Claude Design brief: every
object accounted for, tagged, and given a destination. Its signature element,
the **disposition tag**, is a punched luggage tag whose four colours are the
only accents in the app:

| Tag | Colour | Meaning |
| --- | --- | --- |
| `VISSZÜK` | steel blue `#2F6F8F` | Keep — staying with us |
| `ELADÓ` | money green `#3F8A5B` | Sell — with price |
| `INGYEN ELVIHETŐ` | amber `#C98A2B` | Give away |
| `KIDOB` | brick `#9A5B4E` | Throw away |

Every tag is stamped solid the moment it's chosen — dispositions apply
immediately. (The earlier two-person sign-off flow and the to-do board were
sunset; their database tables remain but the app no longer uses them.)

## Stack

- **Vite + React + TypeScript** single-page app
- **Zustand**, one store per module (`src/stores/`), with optimistic writes and
  Supabase **realtime** for quiet live collaboration between the two editors.
  A module loads its data and opens its live channel only while one of its
  routes is mounted (see `LOAD-01` in `CONSTRAINTS.md`)
- **Supabase** (Postgres + Auth) as the canonical store
- **Space Grotesk** (display) / **Inter** (UI) / **Space Mono** (data, prices,
  counts, tag serials), self-hosted from `@fontsource` (latin and latin-ext
  subsets of the weights in use; see `src/fonts.css`)
- Installable web app (`vite-plugin-pwa`): a service worker precaches the app
  shell after sign-in, so repeat opens are instant and work offline; data
  always comes from Supabase. The public catalogue never registers it.

## Screens

| Route | Screen |
| --- | --- |
| `#/belepes` | Login (single shared password) |
| `#/` | Home: one tile per module, filled by a single `home_summary()` call |
| `#/koltsegvetes` | Budget: the month against its budget, with a month-end projection |
| `#/koltsegvetes/sorok` | Budget lines: amounts, projection model, net pay and rate; start the next month |
| `#/koltsegvetes/nyugtak` | Receipts: XML import, list, export (see `docs/expenses-format.md`) |
| `#/koltsegvetes/nyugtak/:id` | Receipt detail |
| `#/hetvege` | Weekend: this weekend's family programs and warnings, written by the Thursday scan |
| `#/repjegy` | Flights: BCN-BUD fare boards, deals and the trip log, fed by the Monday and Thursday scan |
| `#/koltozes` | Moving overview (the former dashboard) |
| `#/leltar` | Inventory grid (filters + search) |
| `#/leltar/:id` | Item detail (in-place editing) |
| `#/dobozok` | Numbered moving boxes with content photos |
| `#/dobozok/:id` | Box detail |
| `#/nyilvanos` | **Public** read-only catalogue (no login) |

The old `#/kiadasok` and `#/kiadasok/:id` links redirect to the receipts routes.
On a phone the shell is a top bar with a menu drawer; from 900px up it is a
sidebar. Both list the modules from `src/modules.ts`.

Routing is hash-based so the SPA works on GitHub Pages (which has no server
fallback): deep links always resolve and the shared link never 404s.

The public catalogue is deliberately a **read-only shop window**: no contact
details, no claim form, no navigation into the private app. Buyers reach out
however they already know you.

## Data model & privacy

The public page is the screen strangers judge them by, so private data must never
leak there. This is enforced at the database, not just the UI:

- Every base table (`items`, `boxes`, `receipts`, `budget_months`,
  `budget_lines`, `weekend_screens`, `fare_quotes`, `app_settings`) is
  **RLS-protected**, and every function runs with the caller's rights.
  Anonymous visitors get **nothing** from them.
- **No personal data in the repository** (it is public): the home address, pay,
  budget amounts and travel party live in the database (`app_settings` and the
  budget tables) and are seeded there, never committed. See `PRIV-01` in
  `CONSTRAINTS.md`.
- The editor **authenticates** (one shared account) to read/write the base tables.
- The public catalogue is a **view** (`public_items`) that exposes only safe
  columns — no `private_note`, no `proposed_by`, no approval state — and only
  published Sell/Give items that aren't gone.

See `supabase/migrations/` for the exact schema and RLS policies. The database
starts empty — everything is catalogued by the two of you, in the app.

### Photos and bandwidth

Photos live inline in the rows as base64 data URLs, so every byte stored is a
byte downloaded again whenever it is read. The free Supabase plan allows
**5.5 GB of egress a month**; pulling the full photo set (~25 MB) on every app
open burned through that in a few weeks and Supabase cut the project off
until the next billing cycle (the login screen then reports the outage rather
than a wrong password).

To keep loads light, each row also stores a small `thumb` (~320px, ~15 KB) and
a `photo_count`. Grids and the public catalogue only ever read the thumb; the
full-size `photos` column is fetched **per row, on demand** — when a detail
screen opens or a visitor taps a card. Rows from before thumbs existed get
one generated and written back by the first device that opens the app. Usage
is visible in the Supabase dashboard under Organization → Usage.

## Scheduled scans

Three scheduled Claude tasks (claude.ai → scheduled tasks) write into the app
through validated database functions, and nothing else:

| Task | Runs | Writes through |
| --- | --- | --- |
| Weekly family weekend screen | Thu 18:47 Madrid | `weekend_save(jsonb)`: validates the screen, replaces that weekend's row |
| Daily weekend warnings check | Every day 07:43 Madrid | `weekend_alerts_save(jsonb)`: replaces only the warnings of the weekend on screen, never the programs; a no-op when no upcoming weekend is saved yet |
| BCN-BUD fare scan | Mon and Thu 19:47 Madrid | `fare_save(jsonb)`: validates each trip, adds new ids, never updates or deletes |

The weekend screen's instructions are versioned in
[`docs/weekend-scan-brief.md`](docs/weekend-scan-brief.md): what counts as a
program (general city fairs, markets and festes majors as well as kids'
events), the seven search passes, and how multi-week events carry over.

All need the Supabase connector attached in claude.ai. A malformed run fails
with a named reason (`WEEKEND_BAD_ITEM`, `FARE_BAD_TRIP`) instead of reaching
the screens.

## Deployment

Every push to `main` builds the app and deploys it to GitHub Pages via
`.github/workflows/deploy.yml`. The Vite `base` is relative (`./`), so the build
works from the Pages subpath without hardcoding the repo name.

## Local development (optional)

```bash
npm install
npm run dev      # http://localhost:5173
```

The Supabase URL and publishable key are baked in as defaults (the publishable
key is safe to expose). To point at a different project, copy `.env.example` to
`.env` and edit the values.

### Login

One hand-made shared account — the login screen only asks for a password and
supplies the account email (`manifest@move.local`) behind the scenes. The
"acting as" switch (Richard / Dorka) in the menu is **not** a security control;
it only decides whose name goes on notes.

To (re)provision the account on a fresh project, run
`supabase/migrations/0003_editor_account.sql.example` with your chosen password.

## Scripts

```bash
npm run dev        # dev server
npm run build      # typecheck + production build
npm run preview    # preview the production build
npm run typecheck  # types only
```

## Notes on the build

- Phone-first (~380px): a top bar with a menu drawer, breaking to a sidebar at
  900px. Explanations live behind `?` buttons and each module's guide, not on
  the screens (`HELP-01`).
- Motion is restrained: a check-off tick and the sheet slide-up are the only two
  animated moments, and both respect `prefers-reduced-motion`.
- Disposition colours are never used alone — every tag pairs its colour with its
  word for colour-blind legibility.
- Photos are compressed client-side to modest JPEG data URLs.
