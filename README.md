# Manifest

A private, mobile-first relocation app for two people (Richard & Dorka) turning
the chaos of packing up a home into something they can **see, agree on, and act
on** — plus a public, read-only catalogue that makes the "for sale" pile easy to
share with a single link.

**Live (GitHub Pages):** https://afejesrichard.github.io/projectspain/
**Public catalogue:** https://afejesrichard.github.io/projectspain/#/nyilvanos

Deployed automatically by GitHub Actions on every push (see
`.github/workflows/deploy.yml`) — nothing to install or run locally.

Built from the Claude Design brief. The interface is a **shipping manifest**:
every object accounted for, tagged, and given a destination. The signature
element is the **disposition tag** — a punched luggage tag that colour-codes
meaning across the whole app:

| Tag | Colour | Meaning |
| --- | --- | --- |
| `MARAD` | steel blue `#2F6F8F` | Keep — staying with us |
| `ELADÓ` | money green `#3F8A5B` | Sell — with price |
| `ELAJÁNDÉK` | amber `#C98A2B` | Give away |
| `KIDOB` | brick `#9A5B4E` | Throw away |

Keep tags are always solid. Sell / Give / Throw are **removals**: they start
*unstamped* (dashed, muted) and only stamp solid once the other person signs off.

## Stack

- **Vite + React + TypeScript** single-page app
- **Zustand** store with optimistic writes + Supabase **realtime** for quiet
  live collaboration between the two editors
- **Supabase** (Postgres + Auth) as the canonical store
- **Space Grotesk** (display) / **Inter** (UI) / **Space Mono** (data, prices,
  counts, tag serials)

## Screens

| Route | Screen |
| --- | --- |
| `#/belepes` | Login (single shared password) |
| `#/` | Dashboard — the operations board |
| `#/leltar` | Inventory grid (filters + search) |
| `#/leltar/:id` | Item detail (in-place editing + approval strip) |
| `#/feladatok` | To-do board, grouped by phase |
| `#/jovahagyas` | Needs-approval queue |
| `#/nyilvanos` | **Public** read-only catalogue (no login) |

Routing is hash-based so the SPA works on GitHub Pages (which has no server
fallback): deep links always resolve and the shared link never 404s.

The public catalogue is deliberately a **read-only shop window**: no contact
details, no claim form, no navigation into the private app. Buyers reach out
however they already know you.

## Data model & privacy

The public page is the screen strangers judge them by, so private data must never
leak there. This is enforced at the database, not just the UI:

- `items` and `tasks` are **RLS-protected**. Anonymous visitors get **nothing**
  from the base tables.
- The editor **authenticates** (one shared account) to read/write the base tables.
- The public catalogue is a **view** (`public_items`) that exposes only safe
  columns — no `private_note`, no `proposed_by`, no approval state — and only
  published Sell/Give items that aren't gone.

See `supabase/migrations/` for the exact schema, RLS policies, and seed data.

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
"acting as" switch (Richard / Dorka) in the shell is **not** a security control;
it only decides whose name goes on a proposal and whose sign-off an approval
represents.

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

- Phone-first (~380px); the editor breaks to the sidebar + two-column layout at
  900px. Add-item and to-do flows are one-hand usable.
- Motion is restrained: a check-off tick and the sheet slide-up are the only two
  animated moments, and both respect `prefers-reduced-motion`.
- Disposition colours are never used alone — every tag pairs its colour with its
  word for colour-blind legibility.
- Photos are compressed client-side to modest JPEG data URLs.
