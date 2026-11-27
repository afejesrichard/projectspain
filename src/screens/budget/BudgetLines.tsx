import { useEffect, useState } from 'react'
import { color, font } from '../../theme'
import { useBudget } from '../../stores/budget'
import { EmptyState, Skeleton } from '../../components/primitives'
import { GROUPS, GROUP_LABEL, MODEL_LABEL, fmtEur, parseEurInput, type BudgetLine, type BudgetModel } from '../../lib/budget'
import { BudgetHelp, MonthSwitcher, SectionTitle, StartMonthButton, nextMonthToStart } from './shared'

// Edit the month's budget: net pay, rate, and each line's amount, model, due
// day and basis. Every field saves when it is left.
export function BudgetLines() {
  const month = useBudget((s) => s.month)
  const data = useBudget((s) => s.byMonth[s.month])
  const loading = useBudget((s) => s.loading)

  if (!data) return loading ? <Skeleton h={300} r={12} /> : null

  if (!data.settings) {
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

  const total = data.lines.reduce((a, l) => a + l.budget_cents, 0)
  const next = nextMonthToStart(month, data.months)

  return (
    <div>
      <MonthSwitcher />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        <Settings />

        <section>
          <SectionTitle help={<BudgetHelp id="lines.models" />}>
            Sorok
            <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0, fontSize: 12, color: color.ink }}>
              összesen {fmtEur(total)}
            </span>
          </SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {GROUPS.map((g) => {
              const lines = data.lines.filter((l) => l.grp === g)
              if (lines.length === 0) return null
              return (
                <div key={g}>
                  <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ fontFamily: font.display, fontWeight: 600, fontSize: 15 }}>{GROUP_LABEL[g]}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: font.mono, fontSize: 12, color: color.softInk }}>
                      {fmtEur(lines.reduce((a, l) => a + l.budget_cents, 0))}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lines.map((l) => (
                      <LineEditor key={`${month}-${l.line}`} l={l} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {next && <StartMonthButton month={next} />}
      </div>
    </div>
  )
}

function Settings() {
  const settings = useBudget((s) => s.byMonth[s.month]?.settings)
  const updateSettings = useBudget((s) => s.updateSettings)
  if (!settings) return null
  return (
    <section>
      <SectionTitle help={<BudgetHelp id="lines.settings" />}>A hónap</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <Labeled label="Nettó fizetés">
          <EurField cents={settings.net_pay_cents} onCommit={(c) => updateSettings({ net_pay_cents: c })} />
        </Labeled>
        <Labeled label="Árfolyam (€ / Ft)">
          <RateField rate={settings.huf_eur_rate} onCommit={(r) => updateSettings({ huf_eur_rate: r })} />
        </Labeled>
        <Labeled label="Árfolyam (€ / $)">
          <RateField rate={settings.usd_eur_rate} onCommit={(r) => updateSettings({ usd_eur_rate: r })} />
        </Labeled>
        <Labeled label="Megjegyzés">
          <TextField value={settings.note} onCommit={(note) => updateSettings({ note })} />
        </Labeled>
      </div>
    </section>
  )
}

function LineEditor({ l }: { l: BudgetLine }) {
  const updateLine = useBudget((s) => s.updateLine)
  return (
    <div style={{ border: `1px solid ${color.line}`, background: color.cardWhite, borderRadius: 12, padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{l.label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: l.model === 'auto' ? 'minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,0.8fr)' : 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
        <Labeled label="Keret">
          <EurField cents={l.budget_cents} onCommit={(c) => updateLine(l.line, { budget_cents: c })} />
        </Labeled>
        <Labeled label="Számítás">
          <select
            value={l.model}
            onChange={(e) => {
              const model = e.target.value as BudgetModel
              // A subscription needs a charge day; default to the 1st.
              updateLine(l.line, model === 'auto' ? { model, due_day: l.due_day ?? 1 } : { model })
            }}
            style={inputStyle}
          >
            {(Object.keys(MODEL_LABEL) as BudgetModel[]).map((m) => (
              <option key={m} value={m}>
                {MODEL_LABEL[m]}
              </option>
            ))}
          </select>
        </Labeled>
        {l.model === 'auto' && (
          <Labeled label="Nap">
            <DayField day={l.due_day ?? 1} onCommit={(d) => updateLine(l.line, { due_day: d })} />
          </Labeled>
        )}
      </div>
      <Labeled label="Indoklás">
        <TextField value={l.basis} multiline onCommit={(basis) => updateLine(l.line, { basis })} />
      </Labeled>
    </div>
  )
}

// --- Fields: each keeps a draft while focused and commits on blur -------------

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: `1px solid ${color.line}`,
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 14,
  fontFamily: font.body,
  background: color.cardWhite,
  color: color.ink,
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: color.softInk }}>{label}</span>
      {children}
    </label>
  )
}

function useDraft(shown: string) {
  const [draft, setDraft] = useState(shown)
  const [bad, setBad] = useState(false)
  // A change from the other phone replaces the draft unless it is mid-edit.
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setDraft(shown)
  }, [shown, focused])
  return { draft, setDraft, bad, setBad, focused, setFocused }
}

function EurField({ cents, onCommit }: { cents: number; onCommit: (cents: number) => void }) {
  const shown = (cents / 100).toFixed(2).replace('.', ',')
  const f = useDraft(shown)
  return (
    <input
      inputMode="decimal"
      value={f.draft}
      onFocus={() => f.setFocused(true)}
      onChange={(e) => {
        f.setDraft(e.target.value)
        f.setBad(false)
      }}
      onBlur={() => {
        f.setFocused(false)
        const c = parseEurInput(f.draft)
        if (c == null) {
          f.setBad(true)
          f.setDraft(shown)
          return
        }
        if (c !== cents) onCommit(c)
      }}
      aria-invalid={f.bad}
      style={{ ...inputStyle, fontFamily: font.mono, borderColor: f.bad ? color.throw : color.line }}
    />
  )
}

function RateField({ rate, onCommit }: { rate: number | null; onCommit: (rate: number) => void }) {
  const shown = rate == null ? '' : String(rate).replace('.', ',')
  const f = useDraft(shown)
  return (
    <input
      inputMode="decimal"
      value={f.draft}
      onFocus={() => f.setFocused(true)}
      onChange={(e) => f.setDraft(e.target.value)}
      onBlur={() => {
        f.setFocused(false)
        const t = f.draft.trim().replace(',', '.')
        const r = /^\d*\.?\d+$/.test(t) ? Number(t) : NaN
        if (!(r > 0)) {
          f.setDraft(shown)
          return
        }
        if (r !== rate) onCommit(r)
      }}
      style={{ ...inputStyle, fontFamily: font.mono }}
    />
  )
}

function DayField({ day, onCommit }: { day: number; onCommit: (day: number) => void }) {
  const f = useDraft(String(day))
  return (
    <input
      inputMode="numeric"
      value={f.draft}
      onFocus={() => f.setFocused(true)}
      onChange={(e) => f.setDraft(e.target.value)}
      onBlur={() => {
        f.setFocused(false)
        const d = /^\d{1,2}$/.test(f.draft.trim()) ? Number(f.draft.trim()) : NaN
        if (!(d >= 1 && d <= 31)) {
          f.setDraft(String(day))
          return
        }
        if (d !== day) onCommit(d)
      }}
      style={{ ...inputStyle, fontFamily: font.mono }}
    />
  )
}

function TextField({ value, multiline, onCommit }: { value: string; multiline?: boolean; onCommit: (v: string) => void }) {
  const f = useDraft(value)
  const common = {
    value: f.draft,
    onFocus: () => f.setFocused(true),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => f.setDraft(e.target.value),
    onBlur: () => {
      f.setFocused(false)
      if (f.draft !== value) onCommit(f.draft)
    },
  }
  return multiline ? (
    <textarea {...common} rows={2} style={{ ...inputStyle, resize: 'vertical', fontSize: 13, lineHeight: 1.4 }} />
  ) : (
    <input {...common} style={inputStyle} />
  )
}
