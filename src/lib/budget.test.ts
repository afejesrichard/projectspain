import { describe, expect, it } from 'vitest'
import {
  addMonths,
  fmtEur,
  parseEurInput,
  projectionRange,
  summarizeMonth,
  type BudgetLine,
  type BudgetMonthData,
} from './budget'

// Synthetic figures only: the real budget lives in the database (PRIV-01).
function line(p: Partial<BudgetLine> & Pick<BudgetLine, 'line' | 'grp' | 'budget_cents' | 'model'>): BudgetLine {
  return { label: p.line, basis: '', due_day: null, sort: 0, ...p }
}

function month(p: Partial<BudgetMonthData> = {}): BudgetMonthData {
  return {
    month: '2030-04-01',
    today: '2030-04-10',
    days_in_month: 30,
    day_of_month: 10,
    days_left: 20,
    months: ['2030-04-01'],
    settings: { month: '2030-04-01', net_pay_cents: 300000, huf_eur_rate: 0.0025, note: '' },
    lines: [],
    spent: [],
    logged_cents: 0,
    receipt_count: 0,
    daily: [],
    receipts: [],
    ...p,
  }
}

describe('summarizeMonth', () => {
  it('ends fixed and lumpy lines at the larger of budget and spent', () => {
    const m = summarizeMonth(
      month({
        lines: [
          line({ line: 'rent', grp: 'Housing and bills', budget_cents: 100000, model: 'fixed' }),
          line({ line: 'kids', grp: 'Everyday', budget_cents: 20000, model: 'lumpy' }),
          line({ line: 'travel', grp: 'One-offs', budget_cents: 29000, model: 'fixed' }),
        ],
        spent: [
          { line: 'rent', cents: 100000, receipts: 1 },
          { line: 'kids', cents: 5000, receipts: 1 },
          { line: 'travel', cents: 45000, receipts: 1 },
        ],
        logged_cents: 150000,
      }),
    )
    // rent 1000 + kids max(200, 50) + travel max(290, 450): a booking replaces the reserve
    expect(m.projectedCents).toBe(100000 + 20000 + 45000)
    expect(m.lines.find((l) => l.line === 'travel')!.leftCents).toBe(-16000)
  })

  it('counts a subscription as spent from its due day, never from receipts', () => {
    const subs = [
      line({ line: 'early', grp: 'Subscriptions', budget_cents: 1000, model: 'auto', due_day: 3 }),
      line({ line: 'today', grp: 'Subscriptions', budget_cents: 2000, model: 'auto', due_day: 10 }),
      line({ line: 'later', grp: 'Subscriptions', budget_cents: 4000, model: 'auto', due_day: 25 }),
    ]
    const m = summarizeMonth(month({ lines: subs, spent: [{ line: 'later', cents: 999, receipts: 1 }], logged_cents: 0 }))
    expect(m.autoPaidCents).toBe(3000)
    expect(m.spentCents).toBe(3000)
    expect(m.lines.find((l) => l.line === 'later')!.spentCents).toBe(0)
    // every subscription counts in full at month end
    expect(m.projectedCents).toBe(7000)
  })

  it('projects paced lines at a blend that leans on the month as it goes on', () => {
    const groceries = line({ line: 'groceries', grp: 'Everyday', budget_cents: 30000, model: 'pace' })
    // day 10 of 30, spent 150 € (15/day) against a 10/day budget pace
    const m = summarizeMonth(month({ lines: [groceries], spent: [{ line: 'groceries', cents: 15000, receipts: 5 }], logged_cents: 15000 }))
    // w = 1/3: rate = 1/3 * 1500 + 2/3 * 1000 = 1166.67 per day for 20 days
    expect(m.projectedCents).toBe(Math.round(15000 + (1500 / 3 + 2000 / 3) * 20))
    expect(m.everydayRateCents).toBe(1500)
    expect(m.everydayBudgetRateCents).toBe(1000)
  })

  it('uses the real month length, not 30 days', () => {
    const groceries = line({ line: 'groceries', grp: 'Everyday', budget_cents: 31000, model: 'pace' })
    const m = summarizeMonth(
      month({ days_in_month: 31, day_of_month: 31, days_left: 0, lines: [groceries], spent: [{ line: 'groceries', cents: 31000, receipts: 1 }], logged_cents: 31000 }),
    )
    expect(m.everydayBudgetRateCents).toBe(1000)
    expect(m.projectedCents).toBe(31000)
  })

  it('projects a month that has not started at its budget', () => {
    const m = summarizeMonth(
      month({
        day_of_month: 0,
        days_left: 30,
        lines: [
          line({ line: 'groceries', grp: 'Everyday', budget_cents: 30000, model: 'pace' }),
          line({ line: 'sub', grp: 'Subscriptions', budget_cents: 500, model: 'auto', due_day: 1 }),
        ],
      }),
    )
    expect(m.projectedCents).toBe(30500)
    expect(m.spentCents).toBe(0)
    expect(m.everydayRateCents).toBe(0)
  })

  it('sets the verdict against net pay with a 100 € warning margin', () => {
    const at = (cents: number) =>
      summarizeMonth(month({ lines: [line({ line: 'rent', grp: 'Housing and bills', budget_cents: cents, model: 'fixed' })] })).verdict
    expect(at(289999)).toBe('good')
    expect(at(290001)).toBe('warn')
    expect(at(300001)).toBe('bad')
  })

  it('reports headroom as net pay minus the whole budget', () => {
    const m = summarizeMonth(month({ lines: [line({ line: 'rent', grp: 'Housing and bills', budget_cents: 310000, model: 'fixed' })] }))
    expect(m.headroomCents).toBe(-10000)
  })

  it('keeps spend on a line with no budget in the total and lists it', () => {
    const m = summarizeMonth(month({ lines: [], spent: [{ line: 'other', cents: 1234, receipts: 1 }], logged_cents: 1234 }))
    expect(m.spentCents).toBe(1234)
    expect(m.unbudgeted).toEqual([{ line: 'other', cents: 1234 }])
  })
})

describe('projectionRange', () => {
  it('waits for a week of data', () => {
    expect(projectionRange([1, 2, 3, 4, 5, 6], 1000, 0, 10)).toEqual({ low: null, high: null })
  })

  it('is 1.28 robust standard deviations scaled by the square root of days left', () => {
    // median 10, absolute deviations sorted [0,0,0,5,5,5,10] -> MAD 5
    const r = projectionRange([5, 5, 10, 10, 10, 15, 20], 10000, 0, 16)
    const band = 1.28 * 1.4826 * 5 * 4
    expect(r.low).toBeCloseTo(10000 - band, 9)
    expect(r.high).toBeCloseTo(10000 + band, 9)
  })

  it('never goes below what is already spent', () => {
    const r = projectionRange([0, 0, 0, 100, 200, 300, 400], 1000, 990, 30)
    expect(r.low).toBe(990)
  })
})

describe('money in and out', () => {
  it('formats cents the Hungarian way', () => {
    expect(fmtEur(123456)).toBe('1\u202f234,56 €')
    expect(fmtEur(-4321)).toBe('−43,21 €')
    expect(fmtEur(987654, { whole: true })).toBe('9\u202f877 €')
    expect(fmtEur(5)).toBe('0,05 €')
  })

  it('parses typed amounts to integer cents without floats', () => {
    expect(parseEurInput('1234,56')).toBe(123456)
    expect(parseEurInput('1 234.56')).toBe(123456)
    expect(parseEurInput('90')).toBe(9000)
    expect(parseEurInput('90,5')).toBe(9050)
    expect(parseEurInput('€ 12')).toBe(1200)
    expect(parseEurInput('0.1')).toBe(10)
    expect(parseEurInput('12,345')).toBeNull()
    expect(parseEurInput('abc')).toBeNull()
    expect(parseEurInput('')).toBeNull()
  })
})

describe('months', () => {
  it('steps across year ends', () => {
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
    expect(addMonths('2027-01-01', -1)).toBe('2026-12-01')
  })
})
