import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { createModuleLifecycle } from '../lib/moduleLifecycle'
import { writeTile } from '../lib/tileCache'
import { monthOf, summarizeMonth, type BudgetLine, type BudgetMonthData, type BudgetSettings } from '../lib/budget'
import { onSignOut } from './session'

// The Budget module's Month and Lines views. One budget_month() call per month
// returns everything the views draw; months already seen stay in memory so a
// revisit paints at once and refreshes behind it (INVARIANT [LOAD-01]).
// Writes go to budget_months and budget_lines only, never to receipts
// (INVARIANT [BUD-02]).

type LinePatch = Partial<Pick<BudgetLine, 'label' | 'budget_cents' | 'basis' | 'model' | 'due_day'>>
type SettingsPatch = Partial<Pick<BudgetSettings, 'net_pay_cents' | 'huf_eur_rate' | 'note'>>

interface BudgetState {
  month: string
  byMonth: Record<string, BudgetMonthData>
  loading: boolean
  error: boolean

  setMonth: (month: string) => void
  load: (month?: string) => Promise<void>
  updateLine: (line: string, patch: LinePatch) => Promise<boolean>
  updateSettings: (patch: SettingsPatch) => Promise<boolean>
  // Resolves to null on success, or 'exists' | 'no_source' | 'error'.
  startMonth: (month: string) => Promise<'exists' | 'no_source' | 'error' | null>
}

const initial = () => ({ month: monthOf(new Date()), byMonth: {} as Record<string, BudgetMonthData>, loading: false, error: false })

export const useBudget = create<BudgetState>((set, get) => ({
  ...initial(),

  setMonth: (month) => {
    set({ month })
    void get().load(month)
  },

  load: async (month = get().month) => {
    const cached = get().byMonth[month]
    if (!cached) set({ loading: true, error: false })
    const { data, error } = await supabase.rpc('budget_month', { p_month: month })
    if (error || !data) {
      set({ loading: false, error: !cached })
      return
    }
    set((s) => ({ byMonth: { ...s.byMonth, [month]: data as BudgetMonthData }, loading: false, error: false }))
  },

  updateLine: async (line, patch) => {
    const { month, byMonth } = get()
    const before = byMonth[month]
    if (!before) return false
    // Optimistic: the bars and projection move as soon as the field is left.
    set((s) => ({
      byMonth: {
        ...s.byMonth,
        [month]: { ...before, lines: before.lines.map((l) => (l.line === line ? { ...l, ...patch } : l)) },
      },
    }))
    const { error } = await supabase.from('budget_lines').update(patch).eq('month', month).eq('line', line)
    if (error) {
      set((s) => ({ byMonth: { ...s.byMonth, [month]: before } }))
      return false
    }
    return true
  },

  updateSettings: async (patch) => {
    const { month, byMonth } = get()
    const before = byMonth[month]
    if (!before?.settings) return false
    set((s) => ({ byMonth: { ...s.byMonth, [month]: { ...before, settings: { ...before.settings!, ...patch } } } }))
    const { error } = await supabase.from('budget_months').update(patch).eq('month', month)
    if (error) {
      set((s) => ({ byMonth: { ...s.byMonth, [month]: before } }))
      return false
    }
    // A new rate changes how forint receipts convert: refetch the figures.
    if (patch.huf_eur_rate != null) void get().load(month)
    return true
  },

  startMonth: async (month) => {
    const { error } = await supabase.rpc('budget_start_month', { p_month: month })
    if (error) {
      if (error.message.includes('MONTH_EXISTS')) return 'exists'
      if (error.message.includes('NO_SOURCE_MONTH')) return 'no_source'
      return 'error'
    }
    set({ month })
    await get().load(month)
    return null
  },
}))

onSignOut(() => useBudget.setState(initial()))

// Home tile: the current calendar month's spend against its budget.
useBudget.subscribe((s, prev) => {
  if (s.byMonth === prev.byMonth) return
  const current = monthOf(new Date())
  const data = s.byMonth[current]
  if (!data?.settings) return
  const m = summarizeMonth(data)
  writeTile('budget', { month: current, spentCents: m.spentCents, budgetCents: m.budgetCents, verdict: m.verdict })
})

// --- Live: a receipt imported, or a line edited, on the other phone --------
let channelSeq = 0
let refetchTimer: ReturnType<typeof setTimeout> | undefined

function subscribeBudget(): () => void {
  const refetch = () => {
    clearTimeout(refetchTimer)
    // Several rows can land at once (an import, "start month"): fetch once.
    refetchTimer = setTimeout(() => void useBudget.getState().load(), 400)
  }
  const channel = supabase
    .channel(`budget-live-${++channelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'receipts' }, refetch)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_lines' }, refetch)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_months' }, refetch)
    .subscribe()
  return () => {
    clearTimeout(refetchTimer)
    void supabase.removeChannel(channel)
  }
}

export const budgetLifecycle = createModuleLifecycle({
  load: () => useBudget.getState().load(),
  subscribe: subscribeBudget,
})
