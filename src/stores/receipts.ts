import { create } from 'zustand'
import type { Receipt } from '../types'
import type { ReceiptRecord } from '../lib/expenses'
import { supabase } from '../lib/supabase'
import * as repo from '../data/repo'
import { rowToReceipt } from '../data/repo'
import type { ReceiptRow } from '../data/repo'
import { createModuleLifecycle, singleFlight } from '../lib/moduleLifecycle'
import { writeTile } from '../lib/tileCache'
import { onSignOut } from './session'

// Receipts, part of the Budget module. Loaded and kept live only while a
// Budget route is mounted (INVARIANT [LOAD-01]).

interface ReceiptsState {
  loading: boolean
  loaded: boolean
  receipts: Receipt[]

  load: () => Promise<void>
  // NOT optimistic: duplicate detection must be authoritative, so the
  // per-receipt result waits for the database.
  importReceipt: (rec: ReceiptRecord) => Promise<'imported' | 'duplicate' | 'error'>
  removeReceipt: (id: string) => Promise<boolean>
}

const EMPTY = { loading: true, loaded: false, receipts: [] as Receipt[] }

const loadOnce = singleFlight(async () => {
  const { loaded } = useReceipts.getState()
  if (!loaded) useReceipts.setState({ loading: true })
  try {
    const receipts = await repo.fetchReceipts()
    useReceipts.setState({ receipts, loading: false, loaded: true })
  } catch {
    useReceipts.setState({ loading: false })
  }
})

export const useReceipts = create<ReceiptsState>((set) => ({
  ...EMPTY,

  load: loadOnce,

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
}))

onSignOut(() => useReceipts.setState({ ...EMPTY }))

// Home tile: how many receipts this calendar month (a count, not a sum).
useReceipts.subscribe((s, prev) => {
  if (!s.loaded || (s.receipts === prev.receipts && prev.loaded)) return
  const d = new Date()
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  writeTile('receipts', { month, count: s.receipts.filter((r) => r.localDate.startsWith(month)).length })
})

let channelSeq = 0

function subscribeReceipts(): () => void {
  const channel = supabase
    .channel(`receipts-live-${++channelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'receipts' }, (payload) => {
      useReceipts.setState((s) => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: string }).id
          return { receipts: s.receipts.filter((r) => r.id !== oldId) }
        }
        // Receipts are immutable: only INSERTs arrive. The light mapper
        // ignores raw_xml, so payload size is irrelevant here.
        const row = rowToReceipt(payload.new as unknown as ReceiptRow)
        const exists = s.receipts.some((r) => r.id === row.id)
        return { receipts: exists ? s.receipts : [row, ...s.receipts] }
      })
    })
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

export const receiptsLifecycle = createModuleLifecycle({
  load: () => useReceipts.getState().load(),
  subscribe: subscribeReceipts,
})
