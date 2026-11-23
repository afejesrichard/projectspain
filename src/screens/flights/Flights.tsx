import { useMemo, useState } from 'react'
import { color, font, hexA } from '../../theme'
import { useFlights } from '../../stores/flights'
import { EmptyState, Skeleton } from '../../components/primitives'
import { helpFor } from '../../components/Help'
import { flightsHelp } from '../../help/flights'
import { IconPlus } from '../../components/icons'
import { fmtEur } from '../../lib/budget'
import {
  bookingLinks,
  computeBoard,
  daysBetween,
  fmtDay,
  isGp,
  legText,
  localToday,
  tooLong,
  totalCents,
  totalIsEstimate,
  windowLabel,
  workFriendly,
  type Board,
  type Deal,
  type FareSettings,
  type Leg,
  type Row,
  type TierKey,
  type Trip,
} from '../../lib/fares'
import { LogSheet } from './LogSheet'

const FlightsHelp = helpFor(flightsHelp)

type Tab = 'family' | 'grandparents' | 'log'
const TAB_KEY = 'ps-flights-tab'

export function Flights() {
  const trips = useFlights((s) => s.trips)
  const legs = useFlights((s) => s.legs)
  const settings = useFlights((s) => s.settings)
  const loading = useFlights((s) => s.loading)
  const error = useFlights((s) => s.error)
  const [tab, setTabState] = useState<Tab>(() => {
    try {
      const v = localStorage.getItem(TAB_KEY)
      return v === 'grandparents' || v === 'log' ? v : 'family'
    } catch {
      return 'family'
    }
  })
  const setTab = (t: Tab) => {
    setTabState(t)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      /* remembered for this visit only */
    }
  }
  const [sheet, setSheet] = useState(false)

  const today = localToday()
  const board = useMemo(() => (settings ? computeBoard(trips, legs, settings, today, Date.now()) : null), [trips, legs, settings, today])

  if (!settings || !board) {
    if (error) return <EmptyState title="A jegyfigyelőt nem sikerült betölteni." hint="Ellenőrizd a kapcsolatot, és nyisd meg újra." />
    return loading ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Skeleton w={180} h={32} />
        <Skeleton h={90} r={12} />
        <Skeleton h={160} r={12} />
      </div>
    ) : null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 72 }}>
      <header>
        <h1 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 28, margin: 0, letterSpacing: '-0.01em' }}>BCN ⇄ BUD</h1>
        <div style={{ fontFamily: font.mono, fontSize: 12, color: color.softInk, marginTop: 4 }}>
          {trips.length} út · utolsó keresés: {board.lastScan ? fmtStamp(board.lastScan) : 'még nincs'} · H és Cs 19:47
        </div>
      </header>

      <Banner board={board} settings={settings} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Seg value={tab} onChange={setTab} />
        <FlightsHelp id="flights.days" data={today} />
      </div>

      {tab === 'family' && <FamilyTab board={board} settings={settings} />}
      {tab === 'grandparents' && <GrandparentsTab board={board} settings={settings} />}
      {tab === 'log' && <LogTab board={board} trips={trips} legs={legs} settings={settings} />}

      <button
        type="button"
        onClick={() => setSheet(true)}
        aria-label="Út rögzítése"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 'calc(20px + env(safe-area-inset-bottom))',
          zIndex: 30,
          width: 56,
          height: 56,
          borderRadius: 28,
          border: 'none',
          background: color.ink,
          color: color.paper,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 18px rgba(22,32,46,0.28)',
          cursor: 'pointer',
        }}
      >
        <IconPlus size={22} />
      </button>
      {sheet && <LogSheet settings={settings} today={today} onClose={() => setSheet(false)} />}
    </div>
  )
}

const STAMP = new Intl.DateTimeFormat('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const fmtStamp = (isoTs: string) => STAMP.format(new Date(isoTs))

function Seg({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const opts: [Tab, string][] = [
    ['family', 'Család'],
    ['grandparents', 'Nagyszülők'],
    ['log', 'Napló'],
  ]
  return (
    <div role="tablist" style={{ display: 'inline-flex', padding: 4, gap: 4, borderRadius: 10, background: color.trackFill }}>
      {opts.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          style={{
            border: 'none',
            padding: '7px 14px',
            borderRadius: 7,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            background: value === v ? color.cardWhite : 'transparent',
            color: value === v ? color.ink : color.mutedInk,
            boxShadow: value === v ? '0 1px 2px rgba(22,32,46,0.12)' : 'none',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// --- 1. Banner: deals below average, biggest drop first ------------------------------
function Banner({ board, settings }: { board: Board; settings: FareSettings }) {
  const on = board.dealCount > 0
  return (
    <section
      style={{
        border: `1px solid ${on ? color.sell : color.line}`,
        background: on ? hexA(color.sell, 0.07) : color.cardWhite,
        borderRadius: 14,
        padding: '14px 14px 12px',
      }}
    >
      <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 19, color: on ? color.sell : color.ink }}>
        {on ? `${board.dealCount} ajánlat átlag alatt` : 'Figyelés'}
      </div>
      {on ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginTop: 10 }}>
          {board.alerts.slice(0, 6).map((a) => (
            <DealCard key={a.trip.id} deal={a} settings={settings} />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13.5, color: color.mutedInk, marginTop: 4 }}>Minden élő út az átlagán vagy fölötte van.</div>
      )}
      {board.alerts.length > 6 && (
        <div style={{ fontFamily: font.mono, fontSize: 12, color: color.softInk, marginTop: 8 }}>+{board.alerts.length - 6} további a táblákon</div>
      )}
    </section>
  )
}

function DealCard({ deal, settings }: { deal: Deal; settings: FareSettings }) {
  const t = deal.trip
  return (
    <div style={{ background: color.cardWhite, border: `1px solid ${color.line}`, borderRadius: 12, padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontFamily: font.mono, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: color.softInk }}>
        {isGp(t) ? 'Nagyszülők · BUD → BCN' : 'Család · BCN → BUD'}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{deal.label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <Total trip={t} settings={settings} size={20} />
        <span style={{ marginLeft: 'auto', fontFamily: font.mono, fontWeight: 700, color: color.sell }}>{Math.round(deal.delta * 100)}%</span>
      </div>
      <Legs trip={t} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <TierPill tier={deal.tier.key} label={deal.tier.label} />
        <span style={{ fontFamily: font.mono, fontSize: 11.5, color: color.softInk }}>1 felnőtt {fmtEur(t.priceCents)}</span>
      </div>
      <Booking trip={t} settings={settings} />
    </div>
  )
}

// --- 3. Boards as stacked cards -----------------------------------------------------------
function FamilyTab({ board, settings }: { board: Board; settings: FareSettings }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <section>
        <SectionHead title="Szuper ajánlatok" help={<FlightsHelp id="flights.supers" />} />
        {board.supers.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {board.supers.slice(0, 8).map((x) => (
              <DealCard key={x.trip.id} deal={x} settings={settings} />
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13.5, color: color.softInk }}>Most nincs szuper ajánlat ({fmtDay(board.superCutoff)} utáni indulással).</div>
        )}
      </section>
      <section>
        <SectionHead
          title="Család · BCN → BUD"
          help={<FlightsHelp id="flights.family" />}
        />
        <Cards rows={board.family} board={board} settings={settings} />
      </section>
    </div>
  )
}

function GrandparentsTab({ board, settings }: { board: Board; settings: FareSettings }) {
  return (
    <section>
      <SectionHead title="Nagyszülők · BUD → BCN" help={<FlightsHelp id="flights.grandparents" />} />
      {board.grandparents.length <= 1 && (
        <div style={{ fontSize: 13.5, color: color.softInk, marginBottom: 10 }}>A következő 11 hónapban nincs hosszú hétvége.</div>
      )}
      <Cards rows={board.grandparents} board={board} settings={settings} />
    </section>
  )
}

function SectionHead({ title, help }: { title: string; help?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, margin: 0 }}>{title}</h2>
      {help}
    </div>
  )
}

function Cards({ rows, board, settings }: { rows: Row[]; board: Board; settings: FareSettings }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r, i) => (
        <BoardCard key={r.key} row={r} board={board} settings={settings} legend={i === 0} />
      ))}
    </div>
  )
}

function BoardCard({ row, board, settings, legend }: { row: Row; board: Board; settings: FareSettings; legend: boolean }) {
  const best = row.best
  const family = best ? !isGp(best) : !row.key.startsWith('lw-') && row.key !== 'gp-sniper'
  const friendly = best && family ? workFriendly(best, board.windows) : true
  const deltaTone = row.delta == null ? color.faintInk : row.delta < 0 ? color.sell : color.ink
  return (
    <article
      style={{
        border: `1px solid ${row.sniper ? hexA(color.give, 0.6) : color.line}`,
        background: row.sniper ? hexA(color.give, 0.05) : color.cardWhite,
        borderRadius: 12,
        padding: '12px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: font.display, fontWeight: 700, fontSize: 16.5 }}>
            {row.name}
            {row.key === 'summer' && <FlightsHelp id="flights.camp" data={{ today: board.today, settings }} />}
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.softInk }}>{row.note}</div>
          {row.targets.map((t) => (
            <div key={t} style={{ fontFamily: font.mono, fontSize: 11.5, color: color.give }}>
              {t}
            </div>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right', flex: '0 0 auto' }}>
          <div style={{ fontFamily: font.mono, fontWeight: 700, fontSize: 20, color: deltaTone }}>
            {row.delta == null ? '–' : `${row.delta > 0 ? '+' : ''}${Math.round(row.delta * 100)}%`}
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <TierPill tier={row.tier.key} label={row.tier.label} />
            {legend && <FlightsHelp id="flights.tiers" />}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: font.mono, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: color.softInk }}>Átlag</div>
          <div style={{ fontFamily: font.mono, fontWeight: 700, fontSize: 16 }}>{fmtEur(row.avgCents, { whole: true })}</div>
          <div style={{ fontFamily: font.mono, fontSize: 11, color: color.softInk }}>
            1 felnőtt {fmtEur(row.avgAdultCents, { whole: true })} · {row.n < 5 ? `becsült · ${row.n}/5` : `${row.n} út`}
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Sparkline points={row.history} avg={row.avgCents} settings={settings} />
        </div>
      </div>

      {best ? (
        <div style={{ borderTop: `1px solid ${color.hairlineSoft}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: font.mono, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: color.softInk }}>Legjobb élő út</span>
            <Total trip={best} settings={settings} size={16} />
            <span style={{ fontFamily: font.mono, fontSize: 11.5, color: color.softInk }}>1 felnőtt {fmtEur(best.priceCents)}</span>
          </div>
          <Legs trip={best} />
          {!friendly && <div style={{ fontSize: 12, color: color.throw }}>munkanapot érint</div>}
          {row.caveat && <div style={{ fontSize: 12, color: color.throw }}>{row.caveat}</div>}
          <Booking trip={best} settings={settings} />
          {!!row.others?.length && <OtherWeekends list={row.others} board={board} settings={settings} />}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: color.softInk }}>7 napon belül nem látott élő utat</div>
      )}
    </article>
  )
}

// Further cheap weekends under the family sniper's best one: one line each.
function OtherWeekends({ list, board, settings }: { list: NonNullable<Row['others']>; board: Board; settings: FareSettings }) {
  return (
    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontFamily: font.mono, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: color.softInk }}>
        További olcsó hétvégék
      </div>
      {list.map(({ trip, delta }) => {
        const link = bookingLinks(trip, settings)[0]
        return (
          <a
            key={trip.id}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              flexWrap: 'wrap',
              padding: '7px 0',
              borderTop: `1px solid ${color.hairlineSoft}`,
              fontFamily: font.mono,
              fontSize: 12,
              color: color.ink,
              textDecoration: 'none',
            }}
          >
            <span>
              {fmtDay(trip.outDate)} – {fmtDay(trip.retDate)}
            </span>
            {!workFriendly(trip, board.windows) && <span style={{ color: color.throw }}>munkanap</span>}
            <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{fmtEur(totalCents(trip, settings))}</span>
            <span style={{ fontWeight: 700, color: color.sell }}>{Math.round(delta * 100)}%</span>
            <span style={{ color: color.keep }}>↗</span>
          </a>
        )
      })}
    </div>
  )
}

// --- Pieces ----------------------------------------------------------------------------------
function Total({ trip, settings, size }: { trip: Trip; settings: FareSettings; size: number }) {
  return (
    <span style={{ fontFamily: font.mono, fontWeight: 700, fontSize: size }}>
      {fmtEur(totalCents(trip, settings))}
      {totalIsEstimate(trip) && <span style={{ fontSize: 11, fontWeight: 400, color: color.softInk }}> becsült</span>}
    </span>
  )
}

function Legs({ trip }: { trip: Trip }) {
  return (
    <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.mutedInk, lineHeight: 1.5 }}>
      <div>{legText(trip, 'out')}</div>
      <div>{legText(trip, 'ret')}</div>
    </div>
  )
}

function Booking({ trip, settings }: { trip: Trip; settings: FareSettings }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {bookingLinks(trip, settings).map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: color.keep,
            textDecoration: 'none',
            border: `1px solid ${color.line}`,
            borderRadius: 6,
            padding: '3px 9px',
            background: color.cardWhite,
          }}
        >
          {l.label} ↗
        </a>
      ))}
    </div>
  )
}

const TIER_STYLE: Record<TierKey, React.CSSProperties> = {
  err: { background: color.throw, color: color.paper },
  strong: { background: color.sell, color: color.paper },
  below: { color: color.sell, boxShadow: `inset 0 0 0 1.5px ${color.sell}` },
  flat: { color: color.softInk, boxShadow: `inset 0 0 0 1px ${color.line}` },
  none: { color: color.faintInk },
}

function TierPill({ tier, label }: { tier: TierKey; label: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: font.mono,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        ...TIER_STYLE[tier],
      }}
    >
      {label}
    </span>
  )
}

function Sparkline({ points, avg, settings }: { points: Trip[]; avg: number; settings: FareSettings }) {
  const w = 140
  const h = 34
  const p = 4
  if (!points.length) {
    return (
      <svg width={w} height={h} aria-hidden>
        <line x1={p} x2={w - p} y1={h / 2} y2={h / 2} stroke={color.line} strokeDasharray="3 4" />
      </svg>
    )
  }
  const pts = points.map((q) => ({ t: Date.parse(q.foundAt) || 0, v: totalCents(q, settings) })).sort((a, b) => a.t - b.t)
  const vals = [...pts.map((x) => x.v), avg]
  const lo = Math.min(...vals) * 0.92
  const hi = Math.max(...vals) * 1.08
  // One even step per scan, oldest on the left and newest on the right: by the
  // calendar, a few scans days apart would crowd one edge and leave a long gap.
  const steps = [...new Set(pts.map((q) => q.t))]
  const x = (t: number) => (steps.length === 1 ? w / 2 : p + (steps.indexOf(t) / (steps.length - 1)) * (w - 2 * p))
  const y = (v: number) => h - p - ((v - lo) / (hi - lo || 1)) * (h - 2 * p)
  const path = pts.map((q, i) => `${i ? 'L' : 'M'}${x(q.t).toFixed(1)} ${y(q.v).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} role="img" aria-label="Árak időben">
      <line x1={p} x2={w - p} y1={y(avg)} y2={y(avg)} stroke={color.faintInk} strokeDasharray="3 3" />
      {pts.length > 1 && <path d={path} fill="none" stroke={color.mutedInk} strokeOpacity={0.5} strokeWidth={1.2} />}
      {pts.map((q, i) => (
        <circle key={i} cx={x(q.t)} cy={y(q.v)} r={2.6} fill={q.v < avg ? color.sell : color.give} />
      ))}
    </svg>
  )
}

// --- Log -----------------------------------------------------------------------------------------
function LogTab({ board, trips, legs, settings }: { board: Board; trips: Trip[]; legs: Leg[]; settings: FareSettings }) {
  const removeQuote = useFlights((s) => s.removeQuote)
  const [pending, setPending] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const rows = [
    ...trips.map((t) => ({ kind: 'trip' as const, foundAt: t.foundAt, t })),
    ...legs.map((l) => ({ kind: 'leg' as const, foundAt: l.foundAt, l })),
  ]
    .sort((a, b) => (Date.parse(b.foundAt) || 0) - (Date.parse(a.foundAt) || 0))
    .slice(0, 80)

  const remove = async (id: string) => {
    if (pending !== id) {
      setPending(id)
      return
    }
    setPending(null)
    setFailed(!(await removeQuote(id)))
  }

  return (
    <section>
      <SectionHead title="Napló" help={<FlightsHelp id="flights.log" />} />
      {failed && <div style={{ fontSize: 13, color: color.throw, marginBottom: 8 }}>Nem sikerült törölni. Próbáld újra.</div>}
      {rows.length === 0 ? (
        <EmptyState title="Még nincs rögzített út." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((r) => {
            const id = r.kind === 'trip' ? r.t.id : r.l.id
            const seen = new Intl.DateTimeFormat('hu-HU', { month: 'short', day: 'numeric' }).format(new Date(r.foundAt))
            const removeBtn = (
              <button
                type="button"
                onClick={() => remove(id)}
                style={{
                  border: `1px solid ${pending === id ? color.throw : color.line}`,
                  color: pending === id ? color.throw : color.softInk,
                  background: 'transparent',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 12,
                  cursor: 'pointer',
                  flex: '0 0 auto',
                }}
              >
                {pending === id ? 'Biztos törlöd?' : 'Törlés'}
              </button>
            )
            if (r.kind === 'leg') {
              const l = r.l
              return (
                <div key={id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '10px 0', borderBottom: `1px solid ${color.hairlineSoft}`, fontSize: 13 }}>
                  <span style={{ fontFamily: font.mono, color: color.softInk }}>{seen}</span>
                  <span style={{ fontFamily: font.mono }}>
                    {fmtDay(l.travelDate)} {l.direction === 'BUD-BCN' ? 'BUD→BCN' : 'BCN→BUD'} · {l.carrier}
                  </span>
                  <Tag>egyirányú</Tag>
                  <span style={{ marginLeft: 'auto', fontFamily: font.mono }}>{fmtEur(l.priceCents)}</span>
                  {removeBtn}
                </div>
              )
            }
            const t = r.t
            return (
              <div key={id} style={{ padding: '10px 0', borderBottom: `1px solid ${color.hairlineSoft}`, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 13 }}>
                  <span style={{ fontFamily: font.mono, color: color.softInk }}>{seen}</span>
                  <Tag tone={isGp(t) ? color.keep : undefined}>{isGp(t) ? 'nagyszülők' : 'család'}</Tag>
                  {t.source === 'scan' && <Tag>keresés</Tag>}
                  <span style={{ color: color.mutedInk }}>{windowLabel(t, board)}</span>
                  <span style={{ marginLeft: 'auto' }}>
                    <Total trip={t} settings={settings} size={13.5} />
                  </span>
                </div>
                <Legs trip={t} />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: font.mono, fontSize: 11.5, color: color.softInk }}>
                    {daysBetween(t.outDate, t.retDate)} nap · 1 felnőtt {fmtEur(t.priceCents)}
                  </span>
                  {tooLong(t) && <Tag tone={color.throw}>túl hosszú · nem számít</Tag>}
                  {!isGp(t) && (workFriendly(t, board.windows) ? <Tag tone={color.sell}>szabadnapokon</Tag> : <Tag tone={color.throw}>munkanap</Tag>)}
                  <span style={{ marginLeft: 'auto' }}>{removeBtn}</span>
                </div>
                {t.note && <div style={{ fontSize: 12, color: color.softInk }}>{t.note}</div>}
                {t.outDate >= board.today && <Booking trip={t} settings={settings} />}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      style={{
        fontFamily: font.mono,
        fontSize: 10.5,
        padding: '2px 6px',
        borderRadius: 4,
        background: tone ? hexA(tone, 0.12) : color.trackFill,
        color: tone ?? color.mutedInk,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
