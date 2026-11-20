import { useNavigate } from 'react-router-dom'
import { color, font, hexA } from '../theme'
import { MODULES, type ModuleId } from '../modules'
import { ModuleIcon } from '../components/ModuleIcon'
import { readTile } from '../lib/tileCache'
import { useIsDesktop } from '../hooks/useMedia'
import { fmtEur } from '../lib/budget'

const DOT_COLOR = {
  live: color.sell,
  good: color.sell,
  warn: color.give,
  bad: color.throw,
  idle: color.faintInk,
} as const

// INVARIANT [LOAD-01] — home asks the database nothing. Each tile paints from
// figures computed on the device or cached by the module on its last visit;
// tapping a tile is the only thing that loads a module.

type Dot = 'live' | 'idle' | 'good' | 'warn' | 'bad'

interface TileContent {
  figure: string
  sub: string
  dot: Dot
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// The coming weekend, Friday to Sunday; the current one from Friday on.
function weekendOf(today: Date): { from: Date; to: Date } {
  const dow = today.getDay() // 0 Sun .. 6 Sat
  const offset = dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 2)
  return { from, to }
}

const MONTH_SHORT = new Intl.DateTimeFormat('hu-HU', { month: 'short' })

function fmtRange(from: Date, to: Date): string {
  const m1 = MONTH_SHORT.format(from)
  if (from.getMonth() === to.getMonth()) return `${m1} ${from.getDate()}–${to.getDate()}.`
  return `${m1} ${from.getDate()}. – ${MONTH_SHORT.format(to)} ${to.getDate()}.`
}

function tileContent(id: ModuleId, today: Date): TileContent {
  if (id === 'budget') {
    const day = `${today.getDate()}. nap / ${daysInMonth(today)}`
    const b = readTile('budget')
    if (b && b.month === `${monthKey(today)}-01`) {
      return { figure: `${fmtEur(b.spentCents, { whole: true })} / ${fmtEur(b.budgetCents, { whole: true })}`, sub: day, dot: b.verdict }
    }
    const cached = readTile('receipts')
    const count = cached && cached.month === monthKey(today) ? cached.count : null
    return { figure: day, sub: count == null ? 'Nyugták' : `${count} nyugta ebben a hónapban`, dot: 'live' }
  }
  if (id === 'weekend') {
    const { from, to } = weekendOf(today)
    return { figure: fmtRange(from, to), sub: 'Hamarosan az appban', dot: 'idle' }
  }
  if (id === 'flights') {
    return { figure: 'Figyelés', sub: 'Hamarosan az appban', dot: 'idle' }
  }
  const cached = readTile('moving')
  return cached
    ? { figure: `${cached.items} tárgy`, sub: `${cached.boxes} doboz`, dot: 'live' }
    : { figure: 'Leltár', sub: 'Tárgyak és dobozok', dot: 'live' }
}

export function Home() {
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const today = new Date()
  const dateLine = new Intl.DateTimeFormat('hu-HU', { month: 'long', day: 'numeric', weekday: 'long' }).format(today)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: color.softInk }}>
        {dateLine}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? 'repeat(auto-fill,minmax(240px,1fr))' : 'repeat(2,minmax(0,1fr))',
          gap: isDesktop ? 16 : 12,
        }}
      >
        {MODULES.map((m) => {
          const t = tileContent(m.id, today)
          return (
            <button
              key={m.id}
              onClick={() => navigate(m.path)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 6,
                minHeight: isDesktop ? 150 : 132,
                padding: isDesktop ? 18 : 14,
                borderRadius: 14,
                border: `1px solid ${color.line}`,
                background: color.cardWhite,
                color: color.ink,
                textAlign: 'left',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: isDesktop ? 18 : 14,
                  right: isDesktop ? 18 : 14,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: DOT_COLOR[t.dot],
                }}
              />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: hexA(color.keep, 0.1),
                  color: color.keep,
                }}
              >
                <ModuleIcon id={m.id} size={18} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: color.mutedInk, marginTop: 'auto' }}>{m.title}</span>
              <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: isDesktop ? 24 : 19, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
                {t.figure}
              </span>
              <span style={{ fontFamily: font.mono, fontSize: 11.5, color: color.softInk }}>{t.sub}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
