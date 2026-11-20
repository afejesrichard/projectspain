// Budget maths, pure and testable. Ported from the November 2026 budget
// dashboard with its behaviour unchanged, with two fixes: the month's length
// is computed rather than fixed at 30, and sums are kept in cents
// (INVARIANT [EXP-04]). The figures it works from come from the
// budget_month() database function, which owns the item-to-line rule
// (INVARIANT [BUD-01]).

export type BudgetGroup = 'Housing and bills' | 'Subscriptions' | 'Everyday' | 'One-offs'
export type BudgetModel = 'fixed' | 'auto' | 'pace' | 'lumpy'

export const GROUPS: BudgetGroup[] = ['Housing and bills', 'Subscriptions', 'Everyday', 'One-offs']

export interface BudgetLine {
  line: string
  label: string
  grp: BudgetGroup
  budget_cents: number
  basis: string
  model: BudgetModel
  due_day: number | null
  sort: number
}

export interface BudgetSettings {
  month: string
  net_pay_cents: number
  huf_eur_rate: number
  note: string
}

export interface BudgetDay {
  day: string
  cents: number
  everyday_cents: number
  cumulative_cents: number
}

export interface BudgetReceiptLine {
  id: string
  day: string
  merchant: string
  line: string
  cents: number
}

// The shape budget_month() returns.
export interface BudgetMonthData {
  month: string
  today: string
  days_in_month: number
  day_of_month: number
  days_left: number
  months: string[]
  settings: BudgetSettings | null
  lines: BudgetLine[]
  spent: { line: string; cents: number; receipts: number }[]
  logged_cents: number
  receipt_count: number
  daily: BudgetDay[]
  receipts: BudgetReceiptLine[]
}

export interface LineView extends BudgetLine {
  spentCents: number
  leftCents: number
  // spent / budget; 1 when there is spend against a zero budget
  share: number
  receiptCount: number
}

export type Verdict = 'good' | 'warn' | 'bad'

export interface MonthSummary {
  lines: LineView[]
  // lines whose receipts arrived but which have no budget line this month
  unbudgeted: { line: string; cents: number }[]
  budgetCents: number
  groupBudgetCents: Record<BudgetGroup, number>
  loggedCents: number
  autoPaidCents: number
  subscriptionsBudgetCents: number
  spentCents: number
  leftCents: number
  projectedCents: number
  lowCents: number | null
  highCents: number | null
  everydayRateCents: number
  everydayBudgetRateCents: number
  netPayCents: number
  headroomCents: number
  verdict: Verdict
  dayOfMonth: number
  daysLeft: number
  daysInMonth: number
}

// Within this much of net pay the month is a warning, not a pass.
export const WARN_MARGIN_CENTS = 10000

// The range needs a week of days before it means anything.
export const RANGE_MIN_DAYS = 7
// 1.28 standard deviations each side: roughly the middle 80%.
const RANGE_Z = 1.28
// Scales the median absolute deviation to a standard deviation.
const MAD_TO_SD = 1.4826

export function summarizeMonth(data: BudgetMonthData): MonthSummary {
  const dim = data.days_in_month
  const dom = data.day_of_month
  const daysLeft = data.days_left
  const logged = new Map(data.spent.map((s) => [s.line, s]))

  const groupBudgetCents = { 'Housing and bills': 0, Subscriptions: 0, Everyday: 0, 'One-offs': 0 } as Record<BudgetGroup, number>
  let budgetCents = 0
  let autoPaidCents = 0
  let everydaySpent = 0
  let everydayBudget = 0
  let projected = 0

  const lines: LineView[] = data.lines.map((l) => {
    const b = l.budget_cents
    // A subscription never shows up as a receipt: it counts as spent from
    // its charge day.
    const s = l.model === 'auto' ? (dom >= (l.due_day ?? 1) ? b : 0) : (logged.get(l.line)?.cents ?? 0)

    budgetCents += b
    groupBudgetCents[l.grp] += b
    if (l.model === 'auto') autoPaidCents += s
    if (l.grp === 'Everyday') {
      everydaySpent += s
      everydayBudget += b
    }

    if (l.model === 'pace') {
      // This month's own pace counts for more as the month goes on.
      const w = Math.min(1, dom / dim)
      const rate = dom > 0 ? w * (s / dom) + (1 - w) * (b / dim) : b / dim
      projected += s + rate * daysLeft
    } else {
      // fixed, lumpy and subscriptions end at the larger of budget and spent;
      // for the travel reserve that means the reserve or the actual booking.
      projected += Math.max(b, s)
    }

    return {
      ...l,
      spentCents: s,
      leftCents: b - s,
      share: b > 0 ? s / b : s > 0 ? 1 : 0,
      receiptCount: logged.get(l.line)?.receipts ?? 0,
    }
  })

  const budgeted = new Set(data.lines.map((l) => l.line))
  const unbudgeted = data.spent.filter((s) => !budgeted.has(s.line)).map((s) => ({ line: s.line, cents: s.cents }))

  const spentCents = data.logged_cents + autoPaidCents
  const { low, high } = projectionRange(
    data.daily.map((d) => d.everyday_cents),
    projected,
    spentCents,
    daysLeft,
  )

  const netPayCents = data.settings?.net_pay_cents ?? 0
  const verdict: Verdict =
    projected > netPayCents ? 'bad' : projected > netPayCents - WARN_MARGIN_CENTS ? 'warn' : 'good'

  const subscriptionsBudgetCents = groupBudgetCents.Subscriptions

  return {
    lines,
    unbudgeted,
    budgetCents,
    groupBudgetCents,
    loggedCents: data.logged_cents,
    autoPaidCents,
    subscriptionsBudgetCents,
    spentCents,
    leftCents: budgetCents - spentCents,
    projectedCents: Math.round(projected),
    lowCents: low == null ? null : Math.round(low),
    highCents: high == null ? null : Math.round(high),
    everydayRateCents: dom > 0 ? Math.round(everydaySpent / dom) : 0,
    everydayBudgetRateCents: Math.round(everydayBudget / dim),
    netPayCents,
    headroomCents: netPayCents - budgetCents,
    verdict,
    dayOfMonth: dom,
    daysLeft,
    daysInMonth: dim,
  }
}

// The "likely between" range: a robust spread of this month's daily everyday
// spend (median absolute deviation, scaled to a standard deviation), widened
// by the square root of the days left. Never below what is already spent.
export function projectionRange(
  everydayPerDay: number[],
  projected: number,
  spentSoFar: number,
  daysLeft: number,
): { low: number | null; high: number | null } {
  if (everydayPerDay.length < RANGE_MIN_DAYS) return { low: null, high: null }
  const ev = [...everydayPerDay].sort((a, b) => a - b)
  const med = ev[Math.floor(ev.length / 2)]
  const dev = ev.map((v) => Math.abs(v - med)).sort((a, b) => a - b)
  const sd = MAD_TO_SD * dev[Math.floor(dev.length / 2)]
  const band = RANGE_Z * sd * Math.sqrt(daysLeft)
  return { low: Math.max(spentSoFar, projected - band), high: projected + band }
}

// --- Formatting and input ----------------------------------------------------

// 1 335,73 € (hu-HU style; a narrow no-break space groups thousands).
export function fmtEur(cents: number, opts: { whole?: boolean } = {}): string {
  const neg = cents < 0
  const abs = Math.abs(Math.round(cents))
  if (opts.whole) {
    const euros = Math.round(abs / 100)
    return `${neg ? '−' : ''}${group(String(euros))} €`
  }
  const whole = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  return `${neg ? '−' : ''}${group(String(whole))},${frac} €`
}

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// Accepts what people type: "1335,73", "1 335.73", "90", "90,5", "€ 12".
// Returns integer cents, or null when it is not an amount. No float maths.
export function parseEurInput(text: string): number | null {
  const s = text.replace(/[€\s  ]/g, '')
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(s)
  if (!m) return null
  const frac = (m[2] ?? '').padEnd(2, '0')
  return parseInt(m[1], 10) * 100 + parseInt(frac || '0', 10)
}

// --- Months --------------------------------------------------------------------

// 'YYYY-MM-01' for the month containing a local calendar date.
export function monthOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return monthOf(d)
}

const MONTH_NAME = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long' })

export function fmtMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return MONTH_NAME.format(new Date(y, m - 1, 1))
}

export const GROUP_LABEL: Record<BudgetGroup, string> = {
  'Housing and bills': 'Lakhatás és rezsi',
  Subscriptions: 'Előfizetések',
  Everyday: 'Mindennapi',
  'One-offs': 'Egyszeri',
}

export const MODEL_LABEL: Record<BudgetModel, string> = {
  fixed: 'Fix',
  auto: 'Előfizetés',
  pace: 'Ütemezett',
  lumpy: 'Egyenetlen',
}
