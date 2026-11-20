import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { color, font, hexA } from '../../theme'
import { useBudget } from '../../stores/budget'
import { EmptyState, Skeleton } from '../../components/primitives'
import { useIsDesktop } from '../../hooks/useMedia'
import {
  GROUPS,
  GROUP_LABEL,
  MODEL_LABEL,
  fmtEur,
  summarizeMonth,
  type BudgetMonthData,
  type BudgetReceiptLine,
  type LineView,
  type MonthSummary,
} from '../../lib/budget'
import { BudgetHelp, MonthSwitcher, SectionTitle, StartMonthButton, VERDICT_COLOR } from './shared'
import { EverydayChart, RunningChart } from './charts'

const DAY_FMT = new Intl.DateTimeFormat('hu-HU', { month: 'short', day: 'numeric' })
const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return DAY_FMT.format(new Date(y, m - 1, d))
}

// The Budget module's default view. Reads one budget_month() result; every
// figure on it is worked out in src/lib/budget.ts.
export function BudgetMonth() {
  const month = useBudget((s) => s.month)
  const data = useBudget((s) => s.byMonth[s.month])
  const loading = useBudget((s) => s.loading)
  const error = useBudget((s) => s.error)
  const summary = useMemo(() => (data?.settings ? summarizeMonth(data) : null), [data])

  if (!data) {
    if (error) return <EmptyState title="A hónapot nem sikerült betölteni." hint="Ellenőrizd a kapcsolatot, és nyisd meg újra." />
    return <MonthSkeleton loading={loading} />
  }

  if (!summary) {
    return (
      <div>
        <MonthSwitcher />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <EmptyState title="Ehhez a hónaphoz még nincs keret." />
          {data.months.some((m) => m < month) && <StartMonthButton month={month} />}
        </div>
      </div>
    )
  }

  return (
    <div>
      <MonthSwitcher />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        <Headline s={summary} />
        <Figures s={summary} />
        <Lines s={summary} receipts={data.receipts} />
        <Charts s={summary} data={data} />
      </div>
    </div>
  )
}

function MonthSkeleton({ loading }: { loading: boolean }) {
  if (!loading) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Skeleton w={220} h={30} />
      <Skeleton h={88} r={12} />
      <Skeleton h={160} r={12} />
      <Skeleton h={300} r={12} />
    </div>
  )
}

// --- 2. Headline: spent, budget, projected ------------------------------------
function Headline({ s }: { s: MonthSummary }) {
  const tone = VERDICT_COLOR[s.verdict]
  const isDesktop = useIsDesktop()
  const figure = (label: string, value: string, strong?: boolean) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: font.mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: strong ? tone : color.softInk }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: isDesktop ? 34 : 23,
          letterSpacing: '-0.01em',
          color: strong ? tone : color.ink,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  )
  return (
    <div
      style={{
        border: `1px solid ${hexA(tone, 0.55)}`,
        background: hexA(tone, 0.06),
        borderRadius: 14,
        padding: isDesktop ? '18px 20px' : '14px 14px 12px',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: isDesktop ? 20 : 10 }}>
        {figure('Elköltve', fmtEur(s.spentCents, { whole: true }))}
        {figure('Keret', fmtEur(s.budgetCents, { whole: true }))}
        {figure('Várható', fmtEur(s.projectedCents, { whole: true }), true)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, fontFamily: font.mono, fontSize: 12, color: color.mutedInk }}>
        <span>
          {s.dayOfMonth}. nap / {s.daysInMonth}
        </span>
        {s.lowCents != null && s.highCents != null && (
          <span>
            · valószínűleg {fmtEur(s.lowCents, { whole: true })} – {fmtEur(s.highCents, { whole: true })}
          </span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          <BudgetHelp id="month.projection" />
        </span>
      </div>
    </div>
  )
}

// --- 3. Four figures ------------------------------------------------------------
function Figures({ s }: { s: MonthSummary }) {
  const rateHigh = s.everydayRateCents > s.everydayBudgetRateCents * 1.15
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
      <Figure
        label="Hátralévő keret"
        help={<BudgetHelp id="month.left" />}
        value={fmtEur(s.leftCents, { whole: true })}
        bad={s.leftCents < 0}
        sub={`${s.daysLeft} nap van hátra`}
      />
      <Figure
        label="Mindennapi átlag"
        help={<BudgetHelp id="month.rate" />}
        value={`${fmtEur(s.everydayRateCents)} / nap`}
        bad={rateHigh}
        sub={`keret: ${fmtEur(s.everydayBudgetRateCents)} / nap`}
      />
      <Figure
        label="Előfizetések"
        help={<BudgetHelp id="month.subs" />}
        value={fmtEur(s.autoPaidCents)}
        sub={`/ ${fmtEur(s.subscriptionsBudgetCents)}`}
      />
      <Figure
        label="Mozgástér"
        help={<BudgetHelp id="month.headroom" />}
        value={fmtEur(s.headroomCents)}
        bad={s.headroomCents < 0}
        sub={`nettó: ${fmtEur(s.netPayCents, { whole: true })}`}
      />
    </div>
  )
}

function Figure({ label, help, value, sub, bad }: { label: string; help: React.ReactNode; value: string; sub: string; bad?: boolean }) {
  return (
    <div style={{ border: `1px solid ${color.line}`, background: color.cardWhite, borderRadius: 12, padding: '12px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: color.mutedInk }}>
        {label}
        <span style={{ marginLeft: 'auto' }}>{help}</span>
      </div>
      <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 21, marginTop: 4, color: bad ? color.throw : color.ink, whiteSpace: 'nowrap' }}>
        {value}
      </div>
      <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.softInk, marginTop: 2 }}>{sub}</div>
    </div>
  )
}

// --- 4. Lines by group ----------------------------------------------------------
function Lines({ s, receipts }: { s: MonthSummary; receipts: BudgetReceiptLine[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <section>
      <SectionTitle help={<BudgetHelp id="month.lines" />}>Sorok</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {GROUPS.map((g) => {
          const lines = s.lines.filter((l) => l.grp === g)
          if (lines.length === 0) return null
          const spent = lines.reduce((a, l) => a + l.spentCents, 0)
          return (
            <div key={g}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: font.display, fontWeight: 600, fontSize: 15 }}>{GROUP_LABEL[g]}</span>
                <span style={{ marginLeft: 'auto', fontFamily: font.mono, fontSize: 12, color: color.softInk }}>
                  {fmtEur(spent, { whole: true })} / {fmtEur(s.groupBudgetCents[g], { whole: true })}
                </span>
              </div>
              {lines.map((l) => (
                <LineRow
                  key={l.line}
                  l={l}
                  open={open === l.line}
                  onToggle={() => setOpen((o) => (o === l.line ? null : l.line))}
                  receipts={receipts.filter((r) => r.line === l.line)}
                />
              ))}
            </div>
          )
        })}
        {s.unbudgeted.length > 0 && (
          <div>
            <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Keret nélkül</div>
            {s.unbudgeted.map((u) => (
              <div key={u.line} style={{ display: 'flex', padding: '9px 0', borderBottom: `1px solid ${color.hairlineSoft}`, fontSize: 14 }}>
                <span>{u.line}</span>
                <span style={{ marginLeft: 'auto', fontFamily: font.mono }}>{fmtEur(u.cents)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function LineRow({ l, open, onToggle, receipts }: { l: LineView; open: boolean; onToggle: () => void; receipts: BudgetReceiptLine[] }) {
  const navigate = useNavigate()
  const over = l.spentCents > l.budget_cents
  return (
    <div style={{ borderBottom: `1px solid ${color.hairlineSoft}` }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: 'block',
          width: '100%',
          padding: '10px 0 11px',
          border: 'none',
          background: 'transparent',
          textAlign: 'left',
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label}</span>
          <span style={{ marginLeft: 'auto', fontFamily: font.mono, fontSize: 12.5, whiteSpace: 'nowrap', color: over ? color.throw : color.ink }}>
            {fmtEur(l.spentCents)} <span style={{ color: color.softInk }}>/ {fmtEur(l.budget_cents)}</span>
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: color.trackFill, marginTop: 7, overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(100, l.share * 100)}%`,
              height: '100%',
              borderRadius: 3,
              background: over ? color.throw : color.keep,
            }}
          />
        </div>
      </button>
      {open && (
        <div style={{ padding: '2px 0 14px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
          <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.softInk }}>
            {MODEL_LABEL[l.model]}
            {l.model === 'auto' && l.due_day != null && ` · terhelés minden hónap ${l.due_day}.`}
            {' · '}
            {l.leftCents >= 0 ? `${fmtEur(l.leftCents)} maradt` : `${fmtEur(-l.leftCents)} túllépés`}
          </div>
          {l.basis && <div style={{ color: color.mutedInk, lineHeight: 1.45 }}>{l.basis}</div>}
          {receipts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {receipts.map((r) => (
                <button
                  key={`${r.id}-${r.line}`}
                  type="button"
                  onClick={() => navigate(`/koltsegvetes/nyugtak/${encodeURIComponent(r.id)}`)}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '7px 0',
                    border: 'none',
                    borderTop: `1px solid ${color.hairlineSoft}`,
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontFamily: font.mono, color: color.softInk, whiteSpace: 'nowrap' }}>{fmtDay(r.day)}</span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.merchant}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: font.mono, whiteSpace: 'nowrap' }}>{fmtEur(r.cents)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- 5. Charts --------------------------------------------------------------------
function Charts({ s, data }: { s: MonthSummary; data: BudgetMonthData }) {
  if (data.daily.length === 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
      <section>
        <SectionTitle help={<BudgetHelp id="month.running" />}>Halmozott költés</SectionTitle>
        <RunningChart daily={data.daily} budgetCents={s.budgetCents} daysInMonth={s.daysInMonth} />
      </section>
      <section>
        <SectionTitle help={<BudgetHelp id="month.everyday" />}>Mindennapi költés naponta</SectionTitle>
        <EverydayChart daily={data.daily} allowedCents={s.everydayBudgetRateCents} daysInMonth={s.daysInMonth} />
      </section>
    </div>
  )
}
