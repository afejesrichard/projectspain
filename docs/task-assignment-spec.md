# Task assignment — draft spec

**Status:** draft, awaiting approval
**Scope:** assigning to-dos to Ricsi, Dorka, or both; seeing "my tasks" at a glance.

## Goal

Every task belongs to one of: **Ricsi**, **Dorka**, or **Közös** (both). Either
editor can choose the assignee when creating a task and change it later with one
tap. Each person can instantly see their own open tasks.

## Already in place (no schema change needed)

- `tasks.assignee` column with check constraint `('Richard','Dorka','Both')`
- Assignee chip rendered on every task row (name or "Közös")
- Filter bar on the to-do board: **Mind / Enyém / [másik]é** + "Kész elrejtése";
  "Enyém" already matches own tasks **plus** Közös ones
- Realtime sync + row highlight when the other editor changes something

## Gaps this spec closes

1. New tasks are silently assigned to their creator — no choice offered.
2. An existing task's assignee cannot be changed at all.
3. The filter always resets to "Mind"; nothing surfaces *how many* of the open
   tasks are yours.

## Proposed UX

### 1. Assign at creation (quick-add row)

- The add-task input in each phase section gets a compact **assignee chip** on
  its right, showing the current target: `Én`, `[másik neve]`, or `Közös`.
- Tapping the chip cycles: **Én → [másik] → Közös → Én…**
- Default is **Én** (the device's acting-as person). The last choice sticks for
  subsequent adds in the same session, so batch-entering the other person's
  tasks doesn't require re-tapping every time.
- Enter still adds instantly; the chip never blocks the keyboard flow.

### 2. Reassign an existing task

- Tapping the assignee chip **on a task row** cycles the same order
  (Ricsi → Dorka → Közös → …).
- No confirmation — it's low-stakes and instantly reversible; the change syncs
  live and flashes briefly on the other editor's screen (existing behaviour).
- Tap target padded to ≥44px for one-handed phone use.

### 3. See my tasks

- The **"Enyém"** filter chip shows a live open-task count, e.g. `Enyém · 7`
  ("open" = not done; Közös tasks count for both people).
- The selected filter **persists per device** (localStorage), so someone who
  lives in "Enyém" view stays there between visits.
- Dashboard: the "Feladatok megnyitása · N nyitott" quick entry gains
  `· ebből tiéd: M`, and tapping it deep-links to the to-do board with **Enyém**
  preselected.

## Copy (HU)

| Element | Text |
|---|---|
| Quick-add chip states | `Én` / `Dorka` v. `Ricsi` / `Közös` |
| Row chip states | name or `Közös` (unchanged) |
| Enyém filter with count | `Enyém · 7` |
| Dashboard quick entry | `Feladatok megnyitása · 16 nyitott · ebből tiéd: 6` |

## Edge cases

- **Acting-as switch mid-session:** "Enyém" and all counts recompute for the new
  identity immediately (derived state, nothing stored per task).
- **Közös tasks** appear in both people's "Enyém" and count toward both.
- **Completed tasks** keep their assignee; reassigning a done task is allowed
  but pointless — no special handling.
- **Concurrent reassign:** last write wins via existing realtime merge; both
  screens converge.

## Out of scope (unchanged)

Due-date editing, priority editing, task comments, notifications.

## Effort

Small. No database or API change — UI-only, an afternoon at most, fully
compatible with all existing data.
