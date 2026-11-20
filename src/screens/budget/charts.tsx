import { useState } from 'react'
import { color, font } from '../../theme'
import { fmtEur, type BudgetDay } from '../../lib/budget'
import { useWidth } from '../../hooks/useWidth'

// Hand-drawn SVG: two small charts do not justify a charting library.

const H = 220
const PAD = { t: 14, r: 12, b: 26, l: 10 }

const DAY_FMT = new Intl.DateTimeFormat('hu-HU', { month: 'short', day: 'numeric' })
const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return DAY_FMT.format(new Date(y, m - 1, d))
}

// Round tick values for a 0..max axis, in cents.
function ticks(maxCents: number, count = 4): number[] {
  if (maxCents <= 0) return [0]
  const rawStep = maxCents / count / 100
  const mag = 10 ** Math.floor(Math.log10(rawStep))
  const step = ([1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= rawStep) ?? 10 * mag) * 100
  const out: number[] = []
  for (let v = 0; v <= maxCents + 1; v += step) out.push(v)
  return out
}

function Caption({ text, legend }: { text: string | null; legend: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center', minHeight: 20, marginBottom: 6, fontSize: 12.5 }}>
      {text ? <span style={{ fontFamily: font.mono, color: color.ink }}>{text}</span> : legend}
    </div>
  )
}

function LegendSwatch({ kind, label }: { kind: 'line' | 'dash' | 'bar'; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: color.softInk }}>
      <svg width={18} height={10} aria-hidden>
        {kind === 'bar' ? (
          <rect x={4} y={1} width={10} height={8} rx={2} fill={color.keep} />
        ) : (
          <line x1={1} x2={17} y1={5} y2={5} stroke={kind === 'line' ? color.keep : color.mutedInk} strokeWidth={kind === 'line' ? 2 : 1.5} strokeDasharray={kind === 'dash' ? '4 3' : undefined} />
        )}
      </svg>
      {label}
    </span>
  )
}

// Cumulative spend by day against a straight line to the month budget.
export function RunningChart({ daily, budgetCents, daysInMonth }: { daily: BudgetDay[]; budgetCents: number; daysInMonth: number }) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [sel, setSel] = useState<number | null>(null)

  const maxCum = daily.reduce((m, d) => Math.max(m, d.cumulative_cents), 0)
  const yMax = Math.max(budgetCents, maxCum) * 1.08 || 100
  const yTicks = ticks(yMax)
  const labelW = Math.max(...yTicks.map((t) => fmtEur(t, { whole: true }).length)) * 6.4 + 8
  const L = PAD.l + labelW
  const x = (day: number) => L + (day / daysInMonth) * (W - PAD.r - L)
  const y = (c: number) => PAD.t + (1 - c / yMax) * (H - PAD.t - PAD.b)

  const path = daily.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i + 1).toFixed(1)},${y(d.cumulative_cents).toFixed(1)}`).join('')
  const last = daily[daily.length - 1]
  const pick = (px: number) => {
    const i = Math.round(((px - L) / (W - PAD.r - L)) * daysInMonth) - 1
    setSel(i >= 0 && i < daily.length ? i : null)
  }
  const s = sel != null ? daily[sel] : null

  return (
    <div ref={ref}>
      <Caption
        text={
          s
            ? `${dayLabel(s.day)} · aznap ${fmtEur(s.cents)} · eddig ${fmtEur(s.cumulative_cents)} · ütem ${fmtEur(Math.round((budgetCents * (sel! + 1)) / daysInMonth))}`
            : null
        }
        legend={
          <>
            <LegendSwatch kind="line" label="Eddig elköltve" />
            <LegendSwatch kind="dash" label="Keret ütemezve" />
          </>
        }
      />
      <svg
        width={W}
        height={H}
        role="img"
        aria-label="Halmozott költés a havi kerethez mérve"
        style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={(e) => pick(e.nativeEvent.offsetX)}
        onPointerDown={(e) => pick(e.nativeEvent.offsetX)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setSel(null)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={color.hairlineSoft} />
            <text x={PAD.l} y={y(t) + 4} fontSize={11} fontFamily={font.mono} fill={color.softInk}>
              {fmtEur(t, { whole: true })}
            </text>
          </g>
        ))}
        {[1, 8, 15, 22, 29].filter((d) => d <= daysInMonth).map((d) => (
          <text key={d} x={x(d)} y={H - 7} fontSize={11} fontFamily={font.mono} fill={color.softInk} textAnchor="middle">
            {d}.
          </text>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(daysInMonth)} y2={y(budgetCents)} stroke={color.mutedInk} strokeWidth={1.5} strokeDasharray="5 4" />
        <path d={path} fill="none" stroke={color.keep} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        {last && <circle cx={x(daily.length)} cy={y(last.cumulative_cents)} r={3.5} fill={color.keep} />}
        {s && (
          <>
            <line x1={x(sel! + 1)} x2={x(sel! + 1)} y1={PAD.t} y2={H - PAD.b} stroke={color.line} />
            <circle cx={x(sel! + 1)} cy={y(s.cumulative_cents)} r={4.5} fill={color.cardWhite} stroke={color.keep} strokeWidth={2} />
          </>
        )}
      </svg>
    </div>
  )
}

// Everyday spend per day against what the everyday budget allows per day.
export function EverydayChart({ daily, allowedCents, daysInMonth }: { daily: BudgetDay[]; allowedCents: number; daysInMonth: number }) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [sel, setSel] = useState<number | null>(null)

  const maxDay = daily.reduce((m, d) => Math.max(m, d.everyday_cents), 0)
  const yMax = Math.max(allowedCents * 2, maxDay) * 1.1 || 100
  const yTicks = ticks(yMax)
  const labelW = Math.max(...yTicks.map((t) => fmtEur(t, { whole: true }).length)) * 6.4 + 8
  const L = PAD.l + labelW
  const slot = (W - PAD.r - L) / daysInMonth
  const barW = Math.max(2, slot * 0.7)
  const y = (c: number) => PAD.t + (1 - c / yMax) * (H - PAD.t - PAD.b)
  const pick = (px: number) => {
    const i = Math.floor((px - L) / slot)
    setSel(i >= 0 && i < daily.length ? i : null)
  }
  const s = sel != null ? daily[sel] : null

  return (
    <div ref={ref}>
      <Caption
        text={s ? `${dayLabel(s.day)} · ${fmtEur(s.everyday_cents)}` : null}
        legend={
          <>
            <LegendSwatch kind="bar" label="Mindennapi költés" />
            <LegendSwatch kind="dash" label={`Keret: ${fmtEur(allowedCents)} / nap`} />
          </>
        }
      />
      <svg
        width={W}
        height={H}
        role="img"
        aria-label="Mindennapi költés naponta"
        style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={(e) => pick(e.nativeEvent.offsetX)}
        onPointerDown={(e) => pick(e.nativeEvent.offsetX)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setSel(null)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={color.hairlineSoft} />
            <text x={PAD.l} y={y(t) + 4} fontSize={11} fontFamily={font.mono} fill={color.softInk}>
              {fmtEur(t, { whole: true })}
            </text>
          </g>
        ))}
        {[1, 8, 15, 22, 29].filter((d) => d <= daysInMonth).map((d) => (
          <text key={d} x={L + (d - 0.5) * slot} y={H - 7} fontSize={11} fontFamily={font.mono} fill={color.softInk} textAnchor="middle">
            {d}.
          </text>
        ))}
        {daily.map((d, i) => (
          <rect
            key={d.day}
            x={L + i * slot + (slot - barW) / 2}
            y={y(d.everyday_cents)}
            width={barW}
            height={Math.max(0, y(0) - y(d.everyday_cents))}
            rx={Math.min(2, barW / 3)}
            fill={color.keep}
            opacity={sel == null || sel === i ? 1 : 0.45}
          />
        ))}
        <line x1={L} x2={W - PAD.r} y1={y(allowedCents)} y2={y(allowedCents)} stroke={color.mutedInk} strokeWidth={1.5} strokeDasharray="5 4" />
      </svg>
    </div>
  )
}
