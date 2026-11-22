import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { color, font, hexA } from '../theme'
import { MODULES, type ModuleId } from '../modules'
import { ModuleIcon } from '../components/ModuleIcon'
import { readTile } from '../lib/tileCache'
import { useIsDesktop } from '../hooks/useMedia'
import { fmtEur } from '../lib/budget'
import { refreshHomeSummary } from '../lib/homeSummary'

const DOT_COLOR = {
  live: color.sell,
  good: color.sell,
  warn: color.give,
  bad: color.throw,
  idle: color.faintInk,
} as const

// INVARIANT [LOAD-01] — home makes exactly one data call, home_summary(). The
// tiles paint at once from the last cached figures, then repaint when the
// summary lands. Tapping a tile is the only thing that loads a module.

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

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

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
      return { figure: `${fmtEur(b.spentCents, { whole: true }).replace(/\s€$/, '')} / ${fmtEur(b.budgetCents, { whole: true })}`, sub: day, dot: b.verdict }
    }
    const cached = readTile('receipts')
    const count = cached && cached.month === monthKey(today) ? cached.count : null
    return { figure: day, sub: count == null ? 'Nyugták' : `${count} nyugta ebben a hónapban`, dot: 'live' }
  }
  if (id === 'weekend') {
    const { from, to } = weekendOf(today)
    const w = readTile('weekend')
    // The daily outlook, while it still covers today: it speaks for the
    // weather on any day of the week, ahead of the weekly scan's own state.
    const wx = readTile('weather')
    const wxLive = wx && wx.lastDay >= isoDate(today) ? wx : null
    const wxWarn = wxLive?.status === 'warn'
    // The cached screen counts only while its weekend has not ended.
    if (w && w.to >= isoDate(today)) {
      const warn = wxLive ? wxWarn : w.alert === 'warn'
      return {
        figure: fmtRange(parseIso(w.from), parseIso(w.to)),
        sub: `${w.count} program${w.stale ? ' · elavult' : ''}${wxWarn ? ' · időjárási figyelmeztetés' : ''}`,
        dot: warn || w.stale ? 'warn' : 'good',
      }
    }
    return { figure: fmtRange(from, to), sub: wxWarn ? 'Időjárási figyelmeztetés' : 'Programok', dot: wxWarn ? 'warn' : 'idle' }
  }
  if (id === 'flights') {
    const f = readTile('flights')
    const scan = readTile('flightsScan')
    // A scan newer than the one the deal count was worked out from.
    const newer = !!scan?.lastScan && (!f?.lastScan || Date.parse(scan.lastScan) > Date.parse(f.lastScan))
    const trips = scan?.trips ?? f?.trips
    if (f && f.deals > 0) return { figure: `${f.deals} ajánlat`, sub: newer ? 'új keresés érkezett' : 'átlag alatt', dot: 'good' }
    return { figure: 'Figyelés', sub: newer ? 'új keresés érkezett' : trips != null ? `${trips} rögzített út` : 'BCN ⇄ BUD', dot: f || scan ? 'live' : 'idle' }
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
  // Repaint once the summary has refreshed the cached figures.
  const [, setFresh] = useState(0)
  useEffect(() => {
    let alive = true
    refreshHomeSummary().then((ok) => {
      if (ok && alive) setFresh((n) => n + 1)
    })
    return () => {
      alive = false
    }
  }, [])
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
