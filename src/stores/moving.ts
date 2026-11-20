import { create } from 'zustand'
import type { Item, ItemDraft, ItemNote, Box, ItemStatus } from '../types'
import type { Disposition } from '../theme'
import { supabase } from '../lib/supabase'
import * as repo from '../data/repo'
import { rowToItem, rowToNote, rowToBox, rowPatchToItem, rowPatchToBox } from '../data/repo'
import type { ItemRow, NoteRow, BoxRow } from '../data/repo'
import { makeThumb, needsThumb } from '../lib/thumb'
import { createModuleLifecycle, singleFlight } from '../lib/moduleLifecycle'
import { writeTile } from '../lib/tileCache'
import { onSignOut, useSession } from './session'

// The Moving module: inventory, boxes and item notes. Loaded and kept live only
// while one of its routes is mounted (INVARIANT [LOAD-01]); the data stays in
// memory afterwards so a revisit paints at once and refreshes behind it.

interface MovingState {
  // True until the first load of this session has finished.
  loading: boolean
  loaded: boolean
  items: Item[]
  notes: ItemNote[]
  boxes: Box[]
  flashId: number | null

  load: () => Promise<void>
  clearFlash: () => void

  // items
  addItem: (draft: ItemDraft) => Promise<number | null>
  setDisposition: (id: number, d: Disposition) => Promise<void>
  setStatus: (id: number, s: ItemStatus) => Promise<void>
  updateItem: (id: number, patch: Partial<Item>) => Promise<void>
  togglePublished: (id: number) => Promise<void>
  removeItem: (id: number) => Promise<void>
  // Full-size photos are not part of the initial load (INVARIANT [EGRESS-01]);
  // a detail screen asks for its own row's photos when it opens.
  ensureItemPhotos: (id: number) => Promise<void>

  // notes
  addNote: (itemId: number, body: string) => Promise<void>

  // boxes
  addBox: () => Promise<number | null>
  updateBox: (id: number, patch: Partial<Box>) => Promise<void>
  ensureBoxPhotos: (id: number) => Promise<void>
  removeBox: (id: number) => Promise<void>
  // Packing out: the box AND its packed items are removed together.
  removeBoxWithItems: (id: number) => Promise<void>
  // Resolves to null on success, or an error code: 'taken' | 'error'.
  renumberBox: (id: number, newId: number) => Promise<'taken' | 'error' | null>
}

const EMPTY = {
  loading: true,
  loaded: false,
  items: [] as Item[],
  notes: [] as ItemNote[],
  boxes: [] as Box[],
  flashId: null as number | null,
}

const loadOnce = singleFlight(async () => {
  const { loaded } = useMoving.getState()
  if (!loaded) useMoving.setState({ loading: true })
  try {
    // The whole manifest MINUS inline photos, so names, tags and prices paint
    // immediately instead of blocking on megabytes of base64.
    const [items, notes, boxes] = await Promise.all([repo.fetchItemsLight(), repo.fetchNotes(), repo.fetchBoxes()])
    useMoving.setState({ items, notes, boxes, loading: false, loaded: true })

    // Rows that have photos but no thumb yet (from before thumbs existed) get
    // one generated here and written back, so the next load, on any device, is
    // light. Best effort; the module is fully usable without. Runs only from
    // inside Moving, never on app start.
    backfillThumbs().catch(() => {
      /* thumbs simply stay as placeholders until the next attempt */
    })
  } catch {
    useMoving.setState({ loading: false })
  }
})

export const useMoving = create<MovingState>((set, get) => ({
  ...EMPTY,

  load: loadOnce,

  clearFlash: () => set({ flashId: null }),

  ensureItemPhotos: async (id) => {
    const it = get().items.find((i) => i.id === id)
    if (!it || it.photosLoaded || it.photoCount === 0) return
    try {
      const photos = (await repo.fetchItemPhotos([id])).get(id) ?? []
      set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, photos, photosLoaded: true } : i)),
      }))
    } catch {
      /* the thumb stays on screen; the next open tries again */
    }
  },

  ensureBoxPhotos: async (id) => {
    const b = get().boxes.find((x) => x.id === id)
    if (!b || b.photosLoaded) return
    try {
      const photos = (await repo.fetchBoxPhotos([id])).get(id) ?? []
      set((s) => ({
        boxes: s.boxes.map((x) => (x.id === id ? { ...x, photos, photosLoaded: true } : x)),
      }))
    } catch {
      /* leave photosLoaded false: the uploader stays disabled rather than
         risk overwriting photos it never saw */
    }
  },

  addItem: async (draft) => {
    try {
      const created = await repo.insertItem({ ...draft, thumb: await makeThumb(draft.photos) })
      // The insert returns the full row, photos included, so it is loaded.
      set((s) => ({ items: [created, ...s.items.filter((i) => i.id !== created.id)], flashId: created.id }))
      return created.id
    } catch {
      return null
    }
  },

  setDisposition: async (id, d) => {
    const it = get().items.find((i) => i.id === id)
    if (!it) return
    const patch: Partial<Item> = { disposition: d }
    // Something being sold / given / thrown away is not coming in a box.
    if (d !== 'keep' && it.boxId != null) patch.boxId = null
    await get().updateItem(id, patch)
  },

  setStatus: async (id, status) => {
    await get().updateItem(id, { status })
  },

  updateItem: async (id, patch) => {
    if (patch.photos) patch = await withThumb(patch)
    // optimistic
    set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)), flashId: id }))
    try {
      await repo.patchItem(id, patch)
    } catch {
      get().load()
    }
  },

  togglePublished: async (id) => {
    const it = get().items.find((i) => i.id === id)
    if (!it) return
    await get().updateItem(id, { published: !it.published })
  },

  removeItem: async (id) => {
    // optimistic removal; realtime DELETE keeps the other editor in sync
    set((s) => ({ items: s.items.filter((it) => it.id !== id) }))
    try {
      await repo.deleteItem(id)
    } catch {
      get().load()
    }
  },

  addNote: async (itemId, body) => {
    const text = body.trim()
    if (!text) return
    try {
      const created = await repo.insertNote(itemId, useSession.getState().actingAs, text)
      set((s) => ({ notes: [...s.notes.filter((n) => n.id !== created.id), created] }))
    } catch {
      /* ignore */
    }
  },

  addBox: async () => {
    try {
      const created = await repo.insertBox()
      set((s) => ({ boxes: [...s.boxes.filter((b) => b.id !== created.id), created].sort((a, b) => a.id - b.id) }))
      return created.id
    } catch {
      return null
    }
  },

  updateBox: async (id, patch) => {
    if (patch.photos) patch = await withThumb(patch)
    set((s) => ({ boxes: s.boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)) }))
    try {
      await repo.patchBox(id, patch)
    } catch {
      get().load()
    }
  },

  renumberBox: async (id, newId) => {
    // Not optimistic: a taken number is an expected outcome, and flashing the
    // wrong number onto the header would be worse than a beat of latency.
    try {
      await repo.renumberBox(id, newId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('BOX_NUMBER_TAKEN')) return 'taken'
      get().load()
      return 'error'
    }
    set((s) => ({
      boxes: s.boxes.map((b) => (b.id === id ? { ...b, id: newId } : b)).sort((a, b) => a.id - b.id),
      items: s.items.map((it) => (it.boxId === id ? { ...it, boxId: newId } : it)),
    }))
    return null
  },

  removeBox: async (id) => {
    // Optimistic: the box goes, its items are unpacked (mirrors the FK's
    // on delete set null).
    set((s) => ({
      boxes: s.boxes.filter((b) => b.id !== id),
      items: s.items.map((it) => (it.boxId === id ? { ...it, boxId: null } : it)),
    }))
    try {
      await repo.deleteBox(id)
    } catch {
      get().load()
    }
  },

  removeBoxWithItems: async (id) => {
    // Optimistic: box and contents go together (mirrors the RPC's transaction);
    // realtime DELETEs keep the other editor in sync.
    set((s) => ({
      boxes: s.boxes.filter((b) => b.id !== id),
      items: s.items.filter((it) => it.boxId !== id),
    }))
    try {
      await repo.deleteBoxWithItems(id)
    } catch {
      get().load()
    }
  },
}))

onSignOut(() => useMoving.setState({ ...EMPTY }))

// Keep the home tile's figures current whenever the counts change.
useMoving.subscribe((s, prev) => {
  if (!s.loaded) return
  if (s.items.length === prev.items.length && s.boxes.length === prev.boxes.length && prev.loaded) return
  writeTile('moving', { items: s.items.length, boxes: s.boxes.length })
})

// --- Live channel, open only while a Moving route is mounted ----------------
let channelSeq = 0

function subscribeMoving(): () => void {
  const set = useMoving.setState
  const channel = supabase
    .channel(`moving-live-${++channelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (payload) => {
      set((s) => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: number }).id
          return { items: s.items.filter((i) => i.id !== oldId) }
        }
        const raw = payload.new as unknown as Partial<ItemRow>
        if (raw.id == null) return {}
        const exists = s.items.some((i) => i.id === raw.id)
        if (!exists) {
          return { items: [rowToItem(raw as ItemRow), ...s.items], flashId: raw.id }
        }
        // MERGE, don't replace: unchanged large columns (photos!) are omitted
        // from realtime UPDATE payloads, so a wholesale swap would silently
        // blank them out in the UI.
        const patch = rowPatchToItem(raw)
        return {
          items: s.items.map((i) => (i.id === raw.id ? { ...i, ...patch } : i)),
          flashId: raw.id,
        }
      })
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'item_notes' }, (payload) => {
      set((s) => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: number }).id
          return { notes: s.notes.filter((n) => n.id !== oldId) }
        }
        const row = rowToNote(payload.new as unknown as NoteRow)
        const exists = s.notes.some((n) => n.id === row.id)
        return {
          notes: exists ? s.notes.map((n) => (n.id === row.id ? row : n)) : [...s.notes, row],
        }
      })
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'boxes' }, (payload) => {
      set((s) => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: number }).id
          return { boxes: s.boxes.filter((b) => b.id !== oldId) }
        }
        const raw = payload.new as unknown as Partial<BoxRow>
        if (raw.id == null) return {}
        // A renumbered box arrives as an UPDATE whose id changed: the old row
        // must morph into the new id, not linger next to a duplicate.
        const oldId = (payload.old as { id?: number }).id ?? raw.id
        const target = s.boxes.some((b) => b.id === oldId)
          ? oldId
          : s.boxes.some((b) => b.id === raw.id)
            ? raw.id
            : null
        if (target == null) {
          return { boxes: [...s.boxes, rowToBox(raw as BoxRow)].sort((a, b) => a.id - b.id) }
        }
        // Merge: photos may be TOAST-omitted from UPDATE payloads.
        const patch = rowPatchToBox(raw)
        return {
          boxes: s.boxes
            .map((b) => (b.id === target ? { ...b, ...patch, id: raw.id! } : b))
            .sort((a, b) => a.id - b.id),
        }
      })
    })
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

export const movingLifecycle = createModuleLifecycle({
  load: () => useMoving.getState().load(),
  subscribe: subscribeMoving,
})

// A photo change carries its own thumb and count, so the card and the "N fotó"
// label update in the same write (the database recomputes photo_count itself).
async function withThumb<T extends { photos?: string[] }>(
  patch: T,
): Promise<T & { thumb: string | null; photoCount: number; photosLoaded: true }> {
  const photos = patch.photos ?? []
  return { ...patch, thumb: await makeThumb(photos), photoCount: photos.length, photosLoaded: true }
}

// One-time migration of rows saved before thumbs existed. Pulls their full
// photos in small batches, renders a thumb on this device, and writes it back.
// A no-op once every row with photos has a thumb.
const BACKFILL_BATCH = 8

async function backfillThumbs(): Promise<void> {
  if (typeof document === 'undefined') return
  const { items, boxes } = useMoving.getState()

  const itemIds = items.filter(needsThumb).map((i) => i.id)
  for (let at = 0; at < itemIds.length; at += BACKFILL_BATCH) {
    const batch = itemIds.slice(at, at + BACKFILL_BATCH)
    const photosById = await repo.fetchItemPhotos(batch)
    for (const [id, photos] of photosById) {
      const thumb = await makeThumb(photos)
      useMoving.setState((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, photos, photosLoaded: true, thumb } : i)),
      }))
      if (thumb) await repo.patchItem(id, { thumb })
    }
  }

  const boxIds = boxes.filter(needsThumb).map((b) => b.id)
  for (let at = 0; at < boxIds.length; at += BACKFILL_BATCH) {
    const batch = boxIds.slice(at, at + BACKFILL_BATCH)
    const photosById = await repo.fetchBoxPhotos(batch)
    for (const [id, photos] of photosById) {
      const thumb = await makeThumb(photos)
      useMoving.setState((s) => ({
        boxes: s.boxes.map((b) => (b.id === id ? { ...b, photos, photosLoaded: true, thumb } : b)),
      }))
      if (thumb) await repo.patchBox(id, { thumb })
    }
  }
}
