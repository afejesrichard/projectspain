# Boxing (Dobozok) — draft spec

**Status:** draft, awaiting approval
**Scope:** numbered boxes with photo galleries of their contents, so "what's in
box 12?" is answered by opening the app instead of the box.

## Goal

While packing, you write a number on the physical box and create the same box
in the app. As things go in, you photograph them. Later — mid-move or in the
new home — you find things by flicking through box photos instead of cutting
tape.

## Data model

New `boxes` table (RLS editor-only, realtime, never public):

| column | type | notes |
|---|---|---|
| `id` | bigint identity | **doubles as the box number** — the number you write on the box |
| `label` | text | optional, e.g. "konyha — üvegek" |
| `room` | text | optional room it was packed in |
| `note` | text | optional plain note (not a thread — keep boxes light) |
| `sealed` | boolean | taped shut; default false |
| `photos` | jsonb | compressed data-URL photos of the contents |
| `created_at` / `updated_at` | timestamptz | |

- Numbering is automatic and sequential (1, 2, 3…). Deleting a box leaves a
  gap in the numbering — exactly like real life, and it guarantees a number is
  never reused for a different box.
- Photos: same inline data-URL approach as items, but compressed harder
  (max 1024px, q0.65 ≈ 100–180 KB each) and allowing **up to 8 per box**,
  since a box holds many things. Realtime updates use the same
  merge-not-replace handling so photos never vanish on edits.

## Screens

### Dobozok tab (new, editors only)

- New nav entry **Dobozok** in the desktop sidebar and the mobile bottom bar
  (the bar goes to five tabs; the approval tab label shortens to fit).
- Grid of box cards. Card: the number huge in mono (`#12`), label, room,
  photo count (`5 fotó`), and a thumbnail of the first photo. **Sealed boxes
  render with a solid border + a small LEZÁRVA stamp** — the manifest
  metaphor: unsealed is open/dashed, sealed is stamped.
- **Új doboz** button creates the next-numbered box in one tap and opens it —
  no form first, number is instant so you can write it on the box immediately.
- Search field filters by label/room text.

### Box detail

- Number displayed huge (`#12`), label and room editable in place, note field.
- **Photo gallery**: camera-first add target (same pattern as items), grid of
  thumbnails, tap any photo for the full-screen lightbox, remove per photo.
- **Lezárva** toggle — flips the card to its sealed/stamped look.
- Delete box with the same quiet two-step confirm as items.

### Dashboard

- One stat block: `N doboz · M lezárva`, tapping opens the Dobozok tab.

## Explicitly private

Boxes never appear on the public page or in the public view — there is nothing
to publish. RLS mirrors items: authenticated editors only.

## Out of scope (possible later)

- Linking inventory items to a box ("Melyik dobozban van a kávégép?") — a
  `box_id` on items with a chip on the item detail. Deferred so v1 stays light;
  the photos answer most "where is it" questions.
- QR/label printing, box weight, unpacked-tracking in the new home.

## Storage budget

50 boxes × ~4 photos × ~150 KB ≈ 30 MB — comfortably inside the free tier
alongside the item photos.

## Effort

One database migration + repo/store wiring + two screens + nav entry.
Roughly the same size as the approval queue build; no impact on existing data.
