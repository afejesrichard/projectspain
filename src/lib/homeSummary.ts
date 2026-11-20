import { supabase } from './supabase'
import { writeTile } from './tileCache'
import { summarizeMonth, type BudgetMonthData } from './budget'

// INVARIANT [LOAD-01] — home's one data call. It refreshes the tile caches the
// modules also write, so a tile shows the same figure whether it was last
// filled here or inside its module.

interface HomeSummary {
  today: string
  budget: Omit<BudgetMonthData, 'receipts'> | null
  weekend: { from: string; to: string; count: number; alert: 'ok' | 'warn'; stale: boolean } | null
  flights: { trips: number; last_scan: string | null }
  moving: { items: number; boxes: number }
}

export async function refreshHomeSummary(): Promise<boolean> {
  const { data, error } = await supabase.rpc('home_summary')
  if (error || !data) return false
  const s = data as HomeSummary

  if (s.budget?.settings) {
    // The same projection the Budget module draws, so the verdict agrees.
    const m = summarizeMonth({ ...s.budget, receipts: [] })
    writeTile('budget', { month: s.budget.month, spentCents: m.spentCents, budgetCents: m.budgetCents, verdict: m.verdict })
  }
  if (s.weekend) writeTile('weekend', s.weekend)
  writeTile('moving', s.moving)
  writeTile('flightsScan', { trips: s.flights.trips, lastScan: s.flights.last_scan })
  return true
}
