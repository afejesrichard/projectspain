import { supabase, EDITOR_EMAIL } from '../lib/supabase'
import type { Item, Task, ItemNote, Person, Phase, Assignee, Priority, ItemStatus } from '../types'
import type { Disposition } from '../theme'

// --- Row shapes (snake_case, as stored) ------------------------------------
interface ItemRow {
  id: number
  name: string
  cover: string
  photos: string[]
  disposition: Disposition
  price_huf: number | null
  status: ItemStatus
  published: boolean
  awaiting: boolean
  stamped: boolean
  proposed_by: Person | null
  private_note: string | null
  description: string | null
  created_at?: string
}

interface TaskRow {
  id: number
  title: string
  phase: Phase
  assignee: Assignee
  due: string | null
  priority: Priority
  done: boolean
  created_at?: string
}

// Public view row — safe columns only, no private_note / proposed_by / awaiting.
export interface PublicItem {
  id: number
  name: string
  cover: string
  photos: string[]
  disposition: Extract<Disposition, 'sell' | 'give'>
  price_huf: number | null
  status: ItemStatus
  description: string | null
}

// --- Mappers ---------------------------------------------------------------
export function rowToItem(r: ItemRow): Item {
  return {
    id: r.id,
    name: r.name,
    cover: r.cover,
    photos: Array.isArray(r.photos) ? r.photos : [],
    disposition: r.disposition,
    priceHUF: r.price_huf,
    status: r.status,
    published: r.published,
    awaiting: r.awaiting,
    stamped: r.stamped,
    proposedBy: r.proposed_by,
    privateNote: r.private_note,
    description: r.description,
  }
}

function itemToRow(it: Partial<Item>): Partial<ItemRow> {
  const row: Partial<ItemRow> = {}
  if (it.name !== undefined) row.name = it.name
  if (it.cover !== undefined) row.cover = it.cover
  if (it.photos !== undefined) row.photos = it.photos
  if (it.disposition !== undefined) row.disposition = it.disposition
  if (it.priceHUF !== undefined) row.price_huf = it.priceHUF
  if (it.status !== undefined) row.status = it.status
  if (it.published !== undefined) row.published = it.published
  if (it.awaiting !== undefined) row.awaiting = it.awaiting
  if (it.stamped !== undefined) row.stamped = it.stamped
  if (it.proposedBy !== undefined) row.proposed_by = it.proposedBy
  if (it.privateNote !== undefined) row.private_note = it.privateNote
  if (it.description !== undefined) row.description = it.description
  return row
}

// Partial mapper for realtime UPDATE events. Postgres omits unchanged TOASTed
// (large) columns — e.g. photos — from logical-decoding payloads, so an update
// event must be MERGED into the existing item, never swapped in wholesale.
// Only keys actually present in the payload become part of the patch.
export function rowPatchToItem(raw: Partial<ItemRow>): Partial<Item> {
  const p: Partial<Item> = {}
  if ('name' in raw) p.name = raw.name as string
  if ('cover' in raw) p.cover = raw.cover as string
  if ('photos' in raw) p.photos = Array.isArray(raw.photos) ? raw.photos : []
  if ('disposition' in raw) p.disposition = raw.disposition as Item['disposition']
  if ('price_huf' in raw) p.priceHUF = raw.price_huf ?? null
  if ('status' in raw) p.status = raw.status as Item['status']
  if ('published' in raw) p.published = !!raw.published
  if ('awaiting' in raw) p.awaiting = !!raw.awaiting
  if ('stamped' in raw) p.stamped = !!raw.stamped
  if ('proposed_by' in raw) p.proposedBy = raw.proposed_by ?? null
  if ('private_note' in raw) p.privateNote = raw.private_note ?? null
  if ('description' in raw) p.description = raw.description ?? null
  return p
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    phase: r.phase,
    assignee: r.assignee,
    due: r.due,
    priority: r.priority,
    done: r.done,
  }
}

function taskToRow(t: Partial<Task>): Partial<TaskRow> {
  const row: Partial<TaskRow> = {}
  if (t.title !== undefined) row.title = t.title
  if (t.phase !== undefined) row.phase = t.phase
  if (t.assignee !== undefined) row.assignee = t.assignee
  if (t.due !== undefined) row.due = t.due
  if (t.priority !== undefined) row.priority = t.priority
  if (t.done !== undefined) row.done = t.done
  return row
}

// --- Auth ------------------------------------------------------------------
export async function signIn(password: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({
    email: EDITOR_EMAIL,
    password: password.trim(),
  })
  return !error
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

// --- Editor reads ----------------------------------------------------------
// Newest first, but seed items (identical timestamps) fall back to id ascending
// so the original manifest order (1..10) is preserved.
export async function fetchItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
  if (error) throw error
  return (data as ItemRow[]).map(rowToItem)
}

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase.from('tasks').select('*').order('id', { ascending: true })
  if (error) throw error
  return (data as TaskRow[]).map(rowToTask)
}

// --- Editor writes ---------------------------------------------------------
export async function insertItem(draft: Omit<Item, 'id'>): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert(itemToRow(draft))
    .select('*')
    .single()
  if (error) throw error
  return rowToItem(data as ItemRow)
}

export async function patchItem(id: number, patch: Partial<Item>): Promise<void> {
  const { error } = await supabase.from('items').update(itemToRow(patch)).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id: number): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}

// --- Item notes (private thread) -------------------------------------------
interface NoteRow {
  id: number
  item_id: number
  author: Person | null
  body: string
  created_at: string
}

export function rowToNote(r: NoteRow): ItemNote {
  return { id: r.id, itemId: r.item_id, author: r.author, body: r.body, createdAt: r.created_at }
}

export async function fetchNotes(): Promise<ItemNote[]> {
  const { data, error } = await supabase
    .from('item_notes')
    .select('*')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return (data as NoteRow[]).map(rowToNote)
}

export async function insertNote(itemId: number, author: Person, body: string): Promise<ItemNote> {
  const { data, error } = await supabase
    .from('item_notes')
    .insert({ item_id: itemId, author, body })
    .select('*')
    .single()
  if (error) throw error
  return rowToNote(data as NoteRow)
}

export type { NoteRow }

export async function insertTask(draft: Omit<Task, 'id'>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(taskToRow(draft))
    .select('*')
    .single()
  if (error) throw error
  return rowToTask(data as TaskRow)
}

export async function patchTask(id: number, patch: Partial<Task>): Promise<void> {
  const { error } = await supabase.from('tasks').update(taskToRow(patch)).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: number): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

// --- Public catalogue (no auth) --------------------------------------------
export async function fetchPublicItems(): Promise<PublicItem[]> {
  const { data, error } = await supabase
    .from('public_items')
    .select('id,name,cover,photos,disposition,price_huf,status,description')
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
  if (error) throw error
  return (data as PublicItem[]).map((r) => ({ ...r, photos: Array.isArray(r.photos) ? r.photos : [] }))
}

export { rowToTask }
export type { ItemRow, TaskRow }
