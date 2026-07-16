import { create } from 'zustand'
import type { Item, Task, Person, ItemStatus, Assignee, Phase } from './types'
import type { Disposition } from './theme'
import { supabase } from './lib/supabase'
import * as repo from './data/repo'
import { rowToItem, rowToTask } from './data/repo'
import type { ItemRow, TaskRow } from './data/repo'

const ACTING_KEY = 'manifest-acting-as'

function readActingAs(): Person {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTING_KEY) : null
  return v === 'Dorka' ? 'Dorka' : 'Richard'
}

interface ManifestState {
  authed: boolean
  actingAs: Person
  ready: boolean // initial session check finished
  loading: boolean // editor data loading

  items: Item[]
  tasks: Task[]
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
  addItem: (draft: Omit<Item, 'id' | 'awaiting' | 'stamped' | 'proposedBy'>) => Promise<number | null>
  setDisposition: (id: number, d: Disposition) => Promise<void>
  setStatus: (id: number, s: ItemStatus) => Promise<void>
  updateItem: (id: number, patch: Partial<Item>) => Promise<void>
  togglePublished: (id: number) => Promise<void>
  approve: (id: number) => Promise<void>
  sendBack: (id: number) => Promise<void>

  // tasks
  addTask: (title: string, phase: Phase, assignee: Assignee) => Promise<void>
  toggleTask: (id: number) => Promise<void>
  updateTask: (id: number, patch: Partial<Task>) => Promise<void>
  removeTask: (id: number) => Promise<void>
}

let realtimeBound = false

export const useStore = create<ManifestState>((set, get) => ({
  authed: false,
  actingAs: readActingAs(),
  ready: false,
  loading: false,

  items: [],
  tasks: [],
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
      if (!authed) set({ items: [], tasks: [] })
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
            const row = rowToItem(payload.new as unknown as ItemRow)
            const exists = s.items.some((i) => i.id === row.id)
            return {
              items: exists ? s.items.map((i) => (i.id === row.id ? row : i)) : [row, ...s.items],
              flashId: row.id,
            }
          })
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
          set((s) => {
            if (payload.eventType === 'DELETE') {
              const oldId = (payload.old as { id?: number }).id
              return { tasks: s.tasks.filter((t) => t.id !== oldId) }
            }
            const row = rowToTask(payload.new as unknown as TaskRow)
            const exists = s.tasks.some((t) => t.id === row.id)
            return {
              tasks: exists ? s.tasks.map((t) => (t.id === row.id ? row : t)) : [...s.tasks, row],
              flashId: row.id,
            }
          })
        })
        .subscribe()
    }
  },

  loadData: async () => {
    set({ loading: true })
    try {
      const [items, tasks] = await Promise.all([repo.fetchItems(), repo.fetchTasks()])
      set({ items, tasks, loading: false })
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
    set({ authed: false, items: [], tasks: [] })
  },

  setActingAs: (p) => {
    try {
      localStorage.setItem(ACTING_KEY, p)
    } catch {
      /* ignore */
    }
    set({ actingAs: p })
  },

  clearFlash: () => set({ flashId: null }),

  addItem: async (draft) => {
    const isRemoval = draft.disposition !== 'keep'
    const full: Omit<Item, 'id'> = {
      ...draft,
      awaiting: isRemoval,
      stamped: !isRemoval,
      proposedBy: isRemoval ? get().actingAs : null,
    }
    try {
      const created = await repo.insertItem(full)
      set((s) => ({ items: [created, ...s.items.filter((i) => i.id !== created.id)], flashId: created.id }))
      return created.id
    } catch {
      return null
    }
  },

  setDisposition: async (id, d) => {
    const it = get().items.find((i) => i.id === id)
    if (!it) return
    let patch: Partial<Item>
    if (d === 'keep') {
      patch = { disposition: d, stamped: true, awaiting: false, proposedBy: null }
    } else {
      const wasApprovedRemoval = it.stamped && !it.awaiting && it.disposition !== 'keep'
      patch = wasApprovedRemoval
        ? { disposition: d }
        : { disposition: d, awaiting: true, stamped: false, proposedBy: get().actingAs }
    }
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

  approve: async (id) => {
    await get().updateItem(id, { stamped: true, awaiting: false })
  },

  sendBack: async (id) => {
    const it = get().items.find((i) => i.id === id)
    if (!it) return
    await get().updateItem(id, {
      awaiting: true,
      stamped: false,
      proposedBy: it.proposedBy === 'Richard' ? 'Dorka' : 'Richard',
    })
  },

  addTask: async (title, phase, assignee) => {
    const t = title.trim()
    if (!t) return
    const draft: Omit<Task, 'id'> = {
      title: t,
      phase,
      assignee,
      due: null,
      priority: 'normal',
      done: false,
    }
    try {
      const created = await repo.insertTask(draft)
      set((s) => ({ tasks: [...s.tasks.filter((x) => x.id !== created.id), created], flashId: created.id }))
    } catch {
      /* ignore */
    }
  },

  toggleTask: async (id) => {
    const t = get().tasks.find((x) => x.id === id)
    if (!t) return
    await get().updateTask(id, { done: !t.done })
  },

  updateTask: async (id, patch) => {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)), flashId: id }))
    try {
      await repo.patchTask(id, patch)
    } catch {
      get().loadData()
    }
  },

  removeTask: async (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    try {
      await repo.deleteTask(id)
    } catch {
      get().loadData()
    }
  },
}))
