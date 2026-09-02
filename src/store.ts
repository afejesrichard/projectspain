import { create } from 'zustand'
import type { Item, ItemNote, Box, Person, ItemStatus, Receipt } from './types'
import type { Disposition } from './theme'
import type { ReceiptRecord } from './lib/expenses'
import { supabase } from './lib/supabase'
import * as repo from './data/repo'
import { rowToItem, rowToNote, rowToBox, rowToReceipt, rowPatchToItem, rowPatchToBox } from './data/repo'
import type { ItemRow, NoteRow, BoxRow, ReceiptRow } from './data/repo'

const ACTING_KEY = 'manifest-acting-as'

function readStoredActingAs(): Person | null {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTING_KEY) : null
  return v === 'Dorka' || v === 'Richard' ? v : null
}

interface ManifestState {
  authed: boolean
  actingAs: Person
  // Whether this device has explicitly chosen who it is (welcome screen).
  identityChosen: boolean
  ready: boolean // initial session check finished
  loading: boolean // editor data loading

  items: Item[]
  notes: ItemNote[]
  boxes: Box[]
  receipts: Receipt[]
  flashId: number | null

  // lifecycle
  init: () => void
  loadData: () => Promise<void>

  // session
  login: (password: string) => Promise<boolean>
  logout: () => Promise<void>
  setActingAs: (p: Person) => void
  clearFlash: () => void

  // items
  addItem: (draft: Omit<Item, 'id'>) => Promise<number | null>
  setDisposition: (id: number, d: Disposition) => Promise<void>
  setStatus: (id: number, s: ItemStatus) => Promise<void>
  updateItem: (id: number, patch: Partial<Item>) => Promise<void>
  togglePublished: (id: number) => Promise<void>
  removeItem: (id: number) => Promise<void>

  // notes
  addNote: (itemId: number, body: string) => Promise<void>

  // boxes
  addBox: () => Promise<number | null>
  updateBox: (id: number, patch: Partial<Box>) => Promise<void>
  removeBox: (id: number) => Promise<void>
  // Packing out: the box AND its packed items are removed together.
  removeBoxWithItems: (id: number) => Promise<void>
  // Resolves to null on success, or an error code: 'taken' | 'error'.
  renumberBox: (id: number, newId: number) => Promise<'taken' | 'error' | null>

  // receipts (Kiadások) — NOT optimistic: duplicate detection must be
  // authoritative, so the per-receipt result waits for the database.
  importReceipt: (rec: ReceiptRecord) => Promise<'imported' | 'duplicate' | 'error'>
  removeReceipt: (id: string) => Promise<boolean>
}

let realtimeBound = false

export const useStore = create<ManifestState>((set, get) => ({
  authed: false,
  actingAs: readStoredActingAs() ?? 'Richard',
  identityChosen: readStoredActingAs() != null,
  ready: false,
  loading: false,

  items: [],
  notes: [],
  boxes: [],
  receipts: [],
  flashId: null,

  init: () => {
    // Resolve the current session, then react to future auth changes.
    supabase.auth.getSession().then(({ data }) => {
      const authed = !!data.session
      set({ authed, ready: true })
      if (authed) get().loadData()
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      const authed = !!session
      const wasAuthed = get().authed
      set({ authed })
      if (authed && !wasAuthed) get().loadData()
      if (!authed) set({ items: [], notes: [], boxes: [], receipts: [] })
    })

    if (!realtimeBound) {
      realtimeBound = true
      supabase
        .channel('manifest-live')
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
            // MERGE, don't replace: unchanged large columns (photos!) are
            // omitted from realtime UPDATE payloads, so a wholesale swap
            // would silently blank them out in the UI.
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'receipts' }, (payload) => {
          set((s) => {
            if (payload.eventType === 'DELETE') {
              const oldId = (payload.old as { id?: string }).id
              return { receipts: s.receipts.filter((r) => r.id !== oldId) }
            }
            // Receipts are immutable — only INSERTs arrive. The light mapper
            // ignores raw_xml, so payload size is irrelevant here.
            const row = rowToReceipt(payload.new as unknown as ReceiptRow)
            const exists = s.receipts.some((r) => r.id === row.id)
            return { receipts: exists ? s.receipts : [row, ...s.receipts] }
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
            // A renumbered box arrives as an UPDATE whose id changed — the old
            // row must morph into the new id, not linger next to a duplicate.
            const oldId = (payload.old as { id?: number }).id ?? raw.id
            const target = s.boxes.some((b) => b.id === oldId)
              ? oldId
              : s.boxes.some((b) => b.id === raw.id)
                ? raw.id
                : null
            if (target == null) {
              return { boxes: [...s.boxes, rowToBox(raw as BoxRow)].sort((a, b) => a.id - b.id) }
            }
            // Merge — photos may be TOAST-omitted from UPDATE payloads.
            const patch = rowPatchToBox(raw)
            return {
              boxes: s.boxes
                .map((b) => (b.id === target ? { ...b, ...patch, id: raw.id! } : b))
                .sort((a, b) => a.id - b.id),
            }
          })
        })
        .subscribe()
    }
  },

  loadData: async () => {
    set({ loading: true })
    try {
      // Phase 1: the whole manifest MINUS inline photos, so names, tags and
      // prices paint immediately instead of blocking on megabytes of base64.
      const [items, notes, boxes, receipts] = await Promise.all([
        repo.fetchItemsLight(),
        repo.fetchNotes(),
        repo.fetchBoxes(),
        repo.fetchReceipts(),
      ])
      set({ items, notes, boxes, receipts, loading: false })

      // Phase 2: hydrate photos in the background and merge by id. Cards show
      // their placeholder until their thumbnail arrives; if this fails the app
      // stays fully usable, just without pictures.
      repo
        .fetchItemPhotos()
        .then((photosById) => {
          set((s) => ({
            items: s.items.map((it) =>
              photosById.has(it.id) ? { ...it, photos: photosById.get(it.id)! } : it,
            ),
          }))
        })
        .catch(() => {
          /* thumbnails simply stay as placeholders */
        })
    } catch {
      set({ loading: false })
    }
  },

  login: async (password) => {
    const ok = await repo.signIn(password)
    if (ok) {
      set({ authed: true })
      await get().loadData()
    }
    return ok
  },

  logout: async () => {
    await repo.signOut()
    set({ authed: false, items: [], notes: [], boxes: [], receipts: [] })
  },

  setActingAs: (p) => {
    try {
      localStorage.setItem(ACTING_KEY, p)
    } catch {
      /* ignore */
    }
    set({ actingAs: p, identityChosen: true })
  },

  clearFlash: () => set({ flashId: null }),

  addItem: async (draft) => {
    try {
      const created = await repo.insertItem(draft)
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
    // optimistic
    set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)), flashId: id }))
    try {
      await repo.patchItem(id, patch)
    } catch {
      get().loadData()
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
      get().loadData()
    }
  },

  addNote: async (itemId, body) => {
    const text = body.trim()
    if (!text) return
    try {
      const created = await repo.insertNote(itemId, get().actingAs, text)
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
    set((s) => ({ boxes: s.boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)) }))
    try {
      await repo.patchBox(id, patch)
    } catch {
      get().loadData()
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
      get().loadData()
      return 'error'
    }
    set((s) => ({
      boxes: s.boxes.map((b) => (b.id === id ? { ...b, id: newId } : b)).sort((a, b) => a.id - b.id),
      items: s.items.map((it) => (it.boxId === id ? { ...it, boxId: newId } : it)),
    }))
    return null
  },

  importReceipt: async (rec) => {
    try {
      const result = await repo.insertReceipt(rec)
      if (result === 'imported') {
        const light: Receipt = {
          id: rec.id,
          datetime: rec.datetime,
          localDate: rec.localDate,
          merchantName: rec.merchantName,
          chain: rec.chain,
          nif: rec.nif,
          receiptNumber: rec.receiptNumber,
          totalCents: rec.totalCents,
          currency: rec.currency,
          source: rec.source,
          confidence: rec.confidence,
          itemCount: rec.itemCount,
          searchText: rec.searchText,
          warnings: rec.warnings,
          importedAt: new Date().toISOString(),
        }
        set((s) => ({
          receipts: s.receipts.some((r) => r.id === light.id) ? s.receipts : [light, ...s.receipts],
        }))
      }
      return result
    } catch {
      return 'error'
    }
  },

  removeReceipt: async (id) => {
    // Not optimistic either: after deletion the same @id may be imported
    // again, so the UI must reflect the database's truth, not a guess.
    try {
      await repo.deleteReceipt(id)
    } catch {
      return false
    }
    set((s) => ({ receipts: s.receipts.filter((r) => r.id !== id) }))
    return true
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
      get().loadData()
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
      get().loadData()
    }
  },
}))
