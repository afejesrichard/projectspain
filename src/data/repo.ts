import { supabase, EDITOR_EMAIL } from '../lib/supabase'
import type { Item, ItemDraft, ItemNote, Box, Person, ItemStatus, Receipt } from '../types'
import type { Disposition } from '../theme'
import type { ReceiptRecord } from '../lib/expenses'

// --- Row shapes (snake_case, as stored) ------------------------------------
interface ItemRow {
  id: number
  name: string
  cover: string
  photos: string[]
  thumb: string | null
  photo_count: number
  disposition: Disposition
  price_huf: number | null
  status: ItemStatus
  published: boolean
  private_note: string | null
  description: string | null
  box_id: number | null
  created_at?: string
}

// Public view row — safe columns only, no private_note / proposed_by / awaiting.
export interface PublicItem {
  id: number
  name: string
  cover: string
  photos: string[]
  thumb: string | null
  photo_count: number
  disposition: Extract<Disposition, 'sell' | 'give'>
  price_huf: number | null
  status: ItemStatus
  description: string | null
}

// --- Mappers ---------------------------------------------------------------
// `photosLoaded` is true only when the row actually carried its photos —
// light fetches (no `photos` column) leave it false so screens know to ask.
export function rowToItem(r: ItemRow | Omit<ItemRow, 'photos'>): Item {
  const hasPhotos = 'photos' in r
  return {
    id: r.id,
    name: r.name,
    cover: r.cover,
    photos: hasPhotos && Array.isArray(r.photos) ? r.photos : [],
    thumb: r.thumb ?? null,
    photoCount: photoCountOf(r),
    photosLoaded: hasPhotos,
    disposition: r.disposition,
    priceHUF: r.price_huf,
    status: r.status,
    published: r.published,
    privateNote: r.private_note,
    description: r.description,
    boxId: r.box_id ?? null,
  }
}

// The stored count wins; a row that came with its photos but predates the
// generated column (e.g. a test fixture) falls back to counting them.
function photoCountOf(r: { photo_count?: number; photos?: unknown }): number {
  if (typeof r.photo_count === 'number') return r.photo_count
  return Array.isArray(r.photos) ? r.photos.length : 0
}

// photo_count is a generated column: never sent, only read.
function itemToRow(it: Partial<Item>): Partial<ItemRow> {
  const row: Partial<ItemRow> = {}
  if (it.name !== undefined) row.name = it.name
  if (it.cover !== undefined) row.cover = it.cover
  if (it.photos !== undefined) row.photos = it.photos
  if (it.thumb !== undefined) row.thumb = it.thumb
  if (it.disposition !== undefined) row.disposition = it.disposition
  if (it.priceHUF !== undefined) row.price_huf = it.priceHUF
  if (it.status !== undefined) row.status = it.status
  if (it.published !== undefined) row.published = it.published
  if (it.privateNote !== undefined) row.private_note = it.privateNote
  if (it.description !== undefined) row.description = it.description
  if (it.boxId !== undefined) row.box_id = it.boxId
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
  if ('photos' in raw) {
    p.photos = Array.isArray(raw.photos) ? raw.photos : []
    p.photosLoaded = true
  }
  if ('thumb' in raw) p.thumb = raw.thumb ?? null
  if ('photo_count' in raw) p.photoCount = raw.photo_count ?? 0
  if ('disposition' in raw) p.disposition = raw.disposition as Item['disposition']
  if ('price_huf' in raw) p.priceHUF = raw.price_huf ?? null
  if ('status' in raw) p.status = raw.status as Item['status']
  if ('published' in raw) p.published = !!raw.published
  if ('private_note' in raw) p.privateNote = raw.private_note ?? null
  if ('description' in raw) p.description = raw.description ?? null
  if ('box_id' in raw) p.boxId = raw.box_id ?? null
  return p
}

// --- Auth ------------------------------------------------------------------
// Why a login failed. A wrong password and an unreachable backend used to look
// identical to the person typing, so a platform outage read as "forgot the
// password". Only a rejected credential is `bad_password`; everything else
// (network down, Supabase project paused or over quota, 5xx) is `unavailable`.
export type SignInResult =
  | { ok: true }
  | { ok: false; reason: 'bad_password' }
  | { ok: false; reason: 'unavailable'; message: string }

export async function signIn(password: string): Promise<SignInResult> {
  const { error } = await supabase.auth.signInWithPassword({
    email: EDITOR_EMAIL,
    password: password.trim(),
  })
  if (!error) return { ok: true }
  return classifySignInError(error)
}

// Exported for tests. GoTrue rejects a wrong password with 400 +
// `invalid_credentials`; anything else means the backend itself is the problem.
export function classifySignInError(error: { code?: string; status?: number; message: string }): SignInResult {
  const badCredentials =
    error.code === 'invalid_credentials' ||
    (error.status === 400 && /invalid login credentials/i.test(error.message))
  if (badCredentials) return { ok: false, reason: 'bad_password' }
  return { ok: false, reason: 'unavailable', message: error.message }
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

// Every column EXCEPT `photos`. The photos array is base64 data URLs (up to a
// few hundred KB each), so pulling it inline makes the initial manifest fetch
// many times heavier than it needs to be. We fetch it separately and hydrate.
const ITEM_LIGHT_COLUMNS =
  'id,name,cover,thumb,photo_count,disposition,price_huf,status,published,private_note,description,box_id,created_at'

// Fast path: the whole manifest minus the heavy inline photos, so the
// text-first UI (names, tags, prices) can paint immediately.
export async function fetchItemsLight(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_LIGHT_COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
  if (error) throw error
  return (data as Omit<ItemRow, 'photos'>[]).map(rowToItem)
}

// Full photos for specific rows only — a detail screen, or the one-off thumb
// backfill. Never the whole table (INVARIANT [EGRESS-01], src/lib/thumb.ts).
export async function fetchItemPhotos(ids: number[]): Promise<Map<number, string[]>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.from('items').select('id,photos').in('id', ids)
  if (error) throw error
  const map = new Map<number, string[]>()
  for (const r of data as { id: number; photos: unknown }[]) {
    map.set(r.id, Array.isArray(r.photos) ? (r.photos as string[]) : [])
  }
  return map
}

// --- Editor writes ---------------------------------------------------------
export async function insertItem(draft: ItemDraft & { thumb: string | null }): Promise<Item> {
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

// --- Boxes (Dobozok) --------------------------------------------------------
interface BoxRow {
  id: number
  label: string
  room: string
  note: string
  sealed: boolean
  unpacked_at: string | null
  photos: string[]
  thumb: string | null
  photo_count: number
  created_at?: string
}

export function rowToBox(r: BoxRow | Omit<BoxRow, 'photos'>): Box {
  const hasPhotos = 'photos' in r
  return {
    id: r.id,
    label: r.label ?? '',
    room: r.room ?? '',
    note: r.note ?? '',
    sealed: !!r.sealed,
    unpackedAt: r.unpacked_at ?? null,
    photos: hasPhotos && Array.isArray(r.photos) ? r.photos : [],
    thumb: r.thumb ?? null,
    photoCount: photoCountOf(r),
    photosLoaded: hasPhotos,
  }
}

// TOAST-safe partial mapper (photos can be omitted from UPDATE payloads).
export function rowPatchToBox(raw: Partial<BoxRow>): Partial<Box> {
  const p: Partial<Box> = {}
  if ('label' in raw) p.label = raw.label ?? ''
  if ('room' in raw) p.room = raw.room ?? ''
  if ('note' in raw) p.note = raw.note ?? ''
  if ('sealed' in raw) p.sealed = !!raw.sealed
  if ('unpacked_at' in raw) p.unpackedAt = raw.unpacked_at ?? null
  if ('photos' in raw) {
    p.photos = Array.isArray(raw.photos) ? raw.photos : []
    p.photosLoaded = true
  }
  if ('thumb' in raw) p.thumb = raw.thumb ?? null
  if ('photo_count' in raw) p.photoCount = raw.photo_count ?? 0
  return p
}

function boxToRow(b: Partial<Box>): Partial<BoxRow> {
  const row: Partial<BoxRow> = {}
  if (b.label !== undefined) row.label = b.label
  if (b.room !== undefined) row.room = b.room
  if (b.note !== undefined) row.note = b.note
  if (b.sealed !== undefined) row.sealed = b.sealed
  if (b.unpackedAt !== undefined) row.unpacked_at = b.unpackedAt
  if (b.photos !== undefined) row.photos = b.photos
  if (b.thumb !== undefined) row.thumb = b.thumb
  return row
}

// Everything except the inline photos (same split as items).
const BOX_LIGHT_COLUMNS = 'id,label,room,note,sealed,unpacked_at,thumb,photo_count,created_at'

export async function fetchBoxes(): Promise<Box[]> {
  const { data, error } = await supabase
    .from('boxes')
    .select(BOX_LIGHT_COLUMNS)
    .order('id', { ascending: true })
  if (error) throw error
  return (data as Omit<BoxRow, 'photos'>[]).map(rowToBox)
}

export async function fetchBoxPhotos(ids: number[]): Promise<Map<number, string[]>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.from('boxes').select('id,photos').in('id', ids)
  if (error) throw error
  const map = new Map<number, string[]>()
  for (const r of data as { id: number; photos: unknown }[]) {
    map.set(r.id, Array.isArray(r.photos) ? (r.photos as string[]) : [])
  }
  return map
}

// Creates the next-numbered box; the returned id is the number to write on it.
export async function insertBox(): Promise<Box> {
  const { data, error } = await supabase.from('boxes').insert({}).select('*').single()
  if (error) throw error
  return rowToBox(data as BoxRow)
}

export async function patchBox(id: number, patch: Partial<Box>): Promise<void> {
  const { error } = await supabase.from('boxes').update(boxToRow(patch)).eq('id', id)
  if (error) throw error
}

export async function deleteBox(id: number): Promise<void> {
  const { error } = await supabase.from('boxes').delete().eq('id', id)
  if (error) throw error
}

// Packing out: removes the box AND the items packed in it, in one transaction.
// A plain deleteBox only unpacks them (FK on delete set null) — this one is for
// a fully unpacked box whose contents have served their purpose in the app.
export async function deleteBoxWithItems(id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_box_with_items', { p_box: id })
  if (error) throw error
}

// Atomic renumber (the id IS the box number): items follow via the FK's
// on update cascade. Throws with a message containing BOX_NUMBER_TAKEN /
// BOX_NUMBER_INVALID / BOX_NOT_FOUND on the corresponding failure.
export async function renumberBox(oldId: number, newId: number): Promise<void> {
  const { error } = await supabase.rpc('renumber_box', { p_old: oldId, p_new: newId })
  if (error) throw error
}

export type { BoxRow }

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

// --- Receipts (Kiadások) ----------------------------------------------------
// Rows are immutable: insert and delete only, never update.
interface ReceiptRow {
  id: string
  raw_xml?: string
  datetime: string
  local_date: string
  merchant_name: string
  chain: string | null
  nif: string | null
  receipt_number: string | null
  total_cents: number
  currency: string
  source: Receipt['source']
  confidence: Receipt['confidence']
  item_count: number
  search_text: string
  warnings: unknown
  imported_at: string
}

// Everything EXCEPT raw_xml — the verbatim XML can be large and the list never
// needs it (same philosophy as the items photo split).
const RECEIPT_LIGHT_COLUMNS =
  'id,datetime,local_date,merchant_name,chain,nif,receipt_number,total_cents,currency,source,confidence,item_count,search_text,warnings,imported_at'

export function rowToReceipt(r: ReceiptRow): Receipt {
  return {
    id: r.id,
    datetime: r.datetime,
    localDate: r.local_date,
    merchantName: r.merchant_name,
    chain: r.chain,
    nif: r.nif,
    receiptNumber: r.receipt_number,
    totalCents: Number(r.total_cents),
    currency: r.currency,
    source: r.source,
    confidence: r.confidence,
    itemCount: r.item_count,
    searchText: r.search_text,
    warnings: Array.isArray(r.warnings) ? (r.warnings as Receipt['warnings']) : [],
    importedAt: r.imported_at,
  }
}

export async function fetchReceipts(): Promise<Receipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select(RECEIPT_LIGHT_COLUMNS)
    .order('local_date', { ascending: false })
    .order('datetime', { ascending: false })
  if (error) throw error
  return (data as ReceiptRow[]).map(rowToReceipt)
}

// CONTRACT: the receipt @id is unique across the store — the primary key
// enforces it, a duplicate insert fails with 23505 and is reported as
// rejected. A duplicate is never merged or overwritten.
export async function insertReceipt(rec: ReceiptRecord): Promise<'imported' | 'duplicate'> {
  const { error } = await supabase.from('receipts').insert({
    id: rec.id,
    raw_xml: rec.rawXml,
    datetime: rec.datetime,
    local_date: rec.localDate,
    merchant_name: rec.merchantName,
    chain: rec.chain,
    nif: rec.nif,
    receipt_number: rec.receiptNumber,
    total_cents: rec.totalCents,
    currency: rec.currency,
    source: rec.source,
    confidence: rec.confidence,
    item_count: rec.itemCount,
    search_text: rec.searchText,
    warnings: rec.warnings,
  })
  if (error) {
    if (error.code === '23505') return 'duplicate'
    throw error
  }
  return 'imported'
}

export async function deleteReceipt(id: string): Promise<void> {
  const { error } = await supabase.from('receipts').delete().eq('id', id)
  if (error) throw error
}

export async function fetchReceiptRaw(id: string): Promise<string | null> {
  const { data, error } = await supabase.from('receipts').select('raw_xml').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as { raw_xml: string } | null)?.raw_xml ?? null
}

// For export: the verbatim elements plus their datetime (for ordering) in a
// local-date range, inclusive on both ends.
export async function fetchReceiptRawsInRange(
  from: string,
  to: string,
): Promise<{ id: string; rawXml: string; datetime: string }[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('id,raw_xml,datetime')
    .gte('local_date', from)
    .lte('local_date', to)
  if (error) throw error
  return (data as { id: string; raw_xml: string; datetime: string }[]).map((r) => ({
    id: r.id,
    rawXml: r.raw_xml,
    datetime: r.datetime,
  }))
}

export type { ReceiptRow }

// --- Public catalogue (no auth) --------------------------------------------
// The shareable page: text, tags and cover thumbs in one light query. The
// full-size photo of a single item is fetched only when a visitor taps it.
export async function fetchPublicItemsLight(): Promise<PublicItem[]> {
  const { data, error } = await supabase
    .from('public_items')
    .select('id,name,cover,thumb,photo_count,disposition,price_huf,status,description')
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
  if (error) throw error
  return (data as Omit<PublicItem, 'photos'>[]).map((r) => ({ ...r, photos: [] }))
}

export async function fetchPublicItemPhotos(id: number): Promise<string[]> {
  const { data, error } = await supabase.from('public_items').select('photos').eq('id', id).maybeSingle()
  if (error) throw error
  const photos = (data as { photos?: unknown } | null)?.photos
  return Array.isArray(photos) ? (photos as string[]) : []
}

export type { ItemRow }
