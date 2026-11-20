import { useState } from 'react'
import { color, font } from '../../theme'
import { addMonths, fmtMonth, monthOf, type Verdict } from '../../lib/budget'
import { useBudget } from '../../stores/budget'
import { helpFor } from '../../components/Help'
import { budgetHelp } from '../../help/budget'

export const BudgetHelp = helpFor(budgetHelp)

export const VERDICT_COLOR: Record<Verdict, string> = {
  good: color.sell,
  warn: color.give,
  bad: color.throw,
}

// ‹ 2026. november ›  — steps through budgeted months, plus the current
// calendar month even before it has a budget (so it can be started).
export function MonthSwitcher() {
  const month = useBudget((s) => s.month)
  const months = useBudget((s) => s.byMonth[s.month]?.months)
  const setMonth = useBudget((s) => s.setMonth)

  const options = [...new Set([...(months ?? []), monthOf(new Date()), month])].sort()
  const i = options.indexOf(month)
  const prev = i > 0 ? options[i - 1] : null
  const next = i < options.length - 1 ? options[i + 1] : null

  const arrow = (target: string | null, label: string, glyph: string) => (
    <button
      type="button"
      onClick={() => target && setMonth(target)}
      disabled={!target}
      aria-label={label}
      style={{
        width: 36,
        height: 36,
        borderRadius: 9,
        border: `1px solid ${color.line}`,
        background: color.cardWhite,
        color: target ? color.ink : color.faintInk,
        cursor: target ? 'pointer' : 'default',
        fontSize: 18,
        lineHeight: 1,
      }}
    >
      {glyph}
    </button>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      {arrow(prev, 'Előző hónap', '‹')}
      <h1 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 24, margin: 0, letterSpacing: '-0.01em', minWidth: 0 }}>
        {fmtMonth(month)}
      </h1>
      {arrow(next, 'Következő hónap', '›')}
    </div>
  )
}

// Copies the latest earlier month into `month`.
export function StartMonthButton({ month, label }: { month: string; label?: string }) {
  const startMonth = useBudget((s) => s.startMonth)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            const r = await startMonth(month)
            setBusy(false)
            if (r === 'exists') setError('Ez a hónap már el van indítva.')
            else if (r === 'no_source') setError('Nincs korábbi hónap, amiből másolni lehetne.')
            else if (r === 'error') setError('Nem sikerült elindítani. Próbáld újra.')
          }}
          style={{
            padding: '11px 16px',
            borderRadius: 9,
            border: 'none',
            background: color.ink,
            color: color.paper,
            fontSize: 14,
            fontWeight: 500,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? 'Indítás…' : label ?? `${fmtMonth(month)} indítása`}
        </button>
        <BudgetHelp id="lines.start" />
      </div>
      {error && <div style={{ fontSize: 13, color: color.throw }}>{error}</div>}
    </div>
  )
}

export function nextMonthToStart(month: string, months: string[]): string | null {
  const next = addMonths(month, 1)
  const latest = months[months.length - 1]
  return latest === month && !months.includes(next) ? next : null
}

export function SectionTitle({ children, help }: { children: React.ReactNode; help?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: font.mono,
        fontSize: 11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: color.softInk,
        paddingBottom: 9,
        borderBottom: `1px solid ${color.line}`,
        marginBottom: 12,
      }}
    >
      {children}
      {help}
    </div>
  )
}
