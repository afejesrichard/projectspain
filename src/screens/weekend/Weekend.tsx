import { useEffect, useMemo, useState } from 'react'
import { color, font, hexA } from '../../theme'
import { useWeekend } from '../../stores/weekend'
import { useIsDesktop } from '../../hooks/useMedia'
import { EmptyState, Skeleton } from '../../components/primitives'
import { helpFor } from '../../components/Help'
import { weekendHelp } from '../../help/weekend'
import {
  DAY_LABEL,
  directionsUrl,
  fmtDate,
  fmtDayLabel,
  fmtKm,
  fmtStamp,
  fmtTemps,
  liveWeather,
  otherNotes,
  fmtWeekend,
  readFilters,
  safeLink,
  splitItems,
  type DayFilter,
  type Filters,
  type WeatherDay,
  type WeatherOutlook,
  type WeekendAlert,
  type WeekendItem,
  type WeekendScreen,
  type ZoneFilter,
} from '../../lib/weekend'

const WeekendHelp = helpFor(weekendHelp)
const FILTER_KEY = 'ps-weekend-filters'

const OFFICIAL: [string, string][] = [
  ['Meteocat', 'https://www.meteo.cat/prediccio/avisos'],
  ['AEMET Catalunya', 'https://www.aemet.es/es/eltiempo/prediccion/avisos?w=hoy&l=69'],
  ['Protecció Civil', 'https://interior.gencat.cat/ca/actualitat/noticies-de-proteccio-civil/'],
  ['@emergenciescat', 'https://x.com/emergenciescat'],
  ['Ajuntament BCN', 'https://www.barcelona.cat/'],
]

const FREE = color.sell
const PAID = color.keep
const WARN = color.give

export function Weekend() {
  const data = useWeekend((s) => s.data)
  const loading = useWeekend((s) => s.loading)
  const error = useWeekend((s) => s.error)

  if (!data) {
    if (error) return <EmptyState title="A hétvégét nem sikerült betölteni." hint="Ellenőrizd a kapcsolatot, és nyisd meg újra." />
    return loading ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Skeleton w={200} h={32} />
        <Skeleton h={52} r={12} />
        <Skeleton h={120} r={12} />
        <Skeleton h={120} r={12} />
      </div>
    ) : null
  }
  if (!data.screen) return <EmptyState title="Még nincs átnézett hétvége." hint="Az első lista csütörtök este érkezik." />

  return <Screen screen={data.screen} stale={data.stale} home={data.home?.address ?? null} weather={liveWeather(data.weather, data.today)} today={data.today} />
}

function Screen({
  screen,
  stale,
  home,
  weather,
  today,
}: {
  screen: WeekendScreen
  stale: boolean
  home: string | null
  weather: WeatherOutlook | null
  today: string
}) {
  const [filters, setFilters] = useState<Filters>(() => {
    try {
      return readFilters(localStorage.getItem(FILTER_KEY))
    } catch {
      return readFilters(null)
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(filters))
    } catch {
      /* remembered for this visit only */
    }
  }, [filters])

  const { free, paid } = useMemo(() => splitItems(screen.items, filters), [screen.items, filters])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 28, margin: 0, letterSpacing: '-0.01em' }}>
            {fmtWeekend(screen.weekend_from, screen.weekend_to)}
          </h1>
          {stale && (
            <span
              style={{
                fontFamily: font.mono,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: WARN,
                border: `1.5px solid ${WARN}`,
                borderRadius: 5,
                padding: '3px 8px',
              }}
            >
              ELAVULT
            </span>
          )}
        </div>
        <div style={{ fontFamily: font.mono, fontSize: 12, color: color.softInk, marginTop: 4 }}>
          átnézve: {fmtDate(screen.screened_at)}
          {screen.next_screen && <> · következő: {fmtDate(screen.next_screen)}</>}
        </div>
      </header>

      <AlertStrip screen={screen} weather={weather} today={today} />

      <FilterBar filters={filters} onChange={setFilters} shown={free.length + paid.length} total={screen.items.length} />

      <Section title="Ingyenes" tone={FREE} items={free} home={home} help={<WeekendHelp id="weekend.free" />} />
      <Section title="Fizetős" tone={PAID} items={paid} home={home} help={<WeekendHelp id="weekend.paid" />} />
    </div>
  )
}

// --- Weather strip: one line, expands to the three days, the warnings and the
// official links. Fed by the daily outlook; the weekly scan only adds notes
// that are not about weather. Screens saved before the daily check existed
// still carry their own weather alerts, shown when no outlook is current.
function AlertStrip({ screen, weather, today }: { screen: WeekendScreen; weather: WeatherOutlook | null; today: string }) {
  const [open, setOpen] = useState(false)
  const status = weather ? weather.status : screen.alert_status
  // Without a current outlook and without a saved title there is nothing to
  // vouch for, so the dot is neutral rather than green.
  const tone = status === 'warn' ? WARN : weather || screen.alert_title ? FREE : color.softInk
  const rows = weather ? [...weather.alerts, ...otherNotes(screen.alerts)] : screen.alerts
  return (
    <section style={{ border: `1px solid ${color.line}`, background: color.cardWhite, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 10 }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 4px 12px 14px',
            border: 'none',
            background: 'transparent',
            textAlign: 'left',
            cursor: 'pointer',
            color: 'inherit',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: tone, flex: '0 0 auto' }} />
          <span style={{ minWidth: 0 }}>{weather ? weather.title : screen.alert_title || 'Nincs friss időjárás-ellenőrzés.'}</span>
          <span aria-hidden style={{ marginLeft: 'auto', color: color.softInk, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
            ▾
          </span>
        </button>
        <WeekendHelp id="weekend.alerts" />
      </div>
      {weather && (
        <div style={{ borderTop: `1px solid ${color.line}` }}>
          {weather.days.map((d) => (
            <DayRow key={d.date} d={d} today={today} />
          ))}
        </div>
      )}
      {open && (
        <div style={{ borderTop: `1px solid ${color.line}` }}>
          {rows.map((a, i) => (
            <AlertRow key={i} a={a} />
          ))}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 14px', background: color.paper, borderTop: `1px solid ${color.line}` }}>
            <div style={{ flexBasis: '100%', fontFamily: font.mono, fontSize: 12, color: color.softInk }}>
              ellenőrizve: {fmtStamp(weather ? weather.checked_at : screen.screened_at)}
            </div>
            {OFFICIAL.map(([label, href]) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, color: color.keep, textDecoration: 'none', border: `1px solid ${color.line}`, background: color.cardWhite, padding: '4px 10px', borderRadius: 6 }}
              >
                {label} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

// One day of the outlook: the day, the temperatures, what to expect.
function DayRow({ d, today }: { d: WeatherDay; today: string }) {
  const tone = d.level === 'warn' ? WARN : FREE
  const temps = fmtTemps(d)
  const extra = [d.rain_pct != null ? `eső ${Math.round(d.rain_pct)}%` : null, d.gust_kmh != null ? `szél ${Math.round(d.gust_kmh)} km/h` : null].filter(Boolean)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: '2px 12px', padding: '9px 14px', borderTop: `1px solid ${color.hairlineSoft}`, fontSize: 13.5 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: tone, alignSelf: 'start', paddingTop: 2 }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: tone, flex: '0 0 auto' }} />
        {fmtDayLabel(d.date, today)}
      </span>
      <span style={{ minWidth: 0 }}>
        {temps && <b style={{ marginRight: 8 }}>{temps}</b>}
        {d.summary}
      </span>
      {extra.length > 0 && <span style={{ gridColumn: 2, fontFamily: font.mono, fontSize: 11.5, color: color.softInk }}>{extra.join(' · ')}</span>}
    </div>
  )
}

function AlertRow({ a }: { a: WeekendAlert }) {
  const tone = a.level === 'warn' ? WARN : a.level === 'ok' ? FREE : color.keep
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', padding: '11px 14px', borderTop: `1px solid ${color.hairlineSoft}`, fontSize: 13.5 }}>
      <span
        style={{
          fontFamily: font.mono,
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '3px 8px',
          borderRadius: 99,
          background: hexA(tone, 0.12),
          color: tone,
          alignSelf: 'start',
          whiteSpace: 'nowrap',
        }}
      >
        {a.tag ?? a.level}
      </span>
      <span style={{ minWidth: 0 }}>{a.text}</span>
      {a.note && <span style={{ gridColumn: 2, color: color.softInk, fontSize: 12.5 }}>{a.note}</span>}
    </div>
  )
}

// --- Filters, remembered on this device ------------------------------------------
function FilterBar({ filters, onChange, shown, total }: { filters: Filters; onChange: (f: Filters) => void; shown: number; total: number }) {
  const isDesktop = useIsDesktop()
  const days: [DayFilter, string][] = [['all', 'Minden nap'], ['Fri', 'P'], ['Sat', 'Szo'], ['Sun', 'V']]
  const zones: [ZoneFilter, string][] = [['all', 'Mind'], ['city', 'Barcelona'], ['trip', 'Kirándulás']]
  return (
    <div
      style={{
        position: 'sticky',
        top: isDesktop ? 0 : 'calc(52px + env(safe-area-inset-top))',
        zIndex: 5,
        background: color.paper,
        padding: '8px 0',
        borderBottom: `1px solid ${color.line}`,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px 12px',
      }}
    >
      <Seg label="Nap" options={days} value={filters.day} onChange={(day) => onChange({ ...filters, day })} />
      <Seg label="Terület" options={zones} value={filters.zone} onChange={(zone) => onChange({ ...filters, zone })} />
      <span style={{ marginLeft: 'auto', fontFamily: font.mono, fontSize: 12, color: color.softInk }}>
        {shown} / {total} program
      </span>
    </div>
  )
}

function Seg<T extends string>({ label, options, value, onChange }: { label: string; options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', border: `1px solid ${color.line}`, borderRadius: 8, overflow: 'hidden', background: color.cardWhite }}>
      {options.map(([v, text], i) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          style={{
            border: 'none',
            borderLeft: i === 0 ? 'none' : `1px solid ${color.line}`,
            padding: '7px 11px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            background: value === v ? color.ink : 'transparent',
            color: value === v ? color.paper : color.ink,
          }}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

// --- Free / Paid lists --------------------------------------------------------------
function Section({ title, tone, items, home, help }: { title: string; tone: string; items: WeekendItem[]; home: string | null; help: React.ReactNode }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, margin: 0 }}>{title}</h2>
        <span style={{ fontFamily: font.mono, fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: hexA(tone, 0.12), color: tone }}>
          {items.length}
        </span>
        {help}
      </div>
      {items.length === 0 ? (
        <div style={{ padding: 14, border: `1px dashed ${color.line}`, borderRadius: 10, color: color.softInk, fontSize: 13.5 }}>
          Ezekkel a szűrőkkel nincs ilyen program.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((it) => (
            <Card key={`${it.name}-${it.km}`} it={it} home={home} tone={tone} />
          ))}
        </div>
      )}
    </section>
  )
}

function Card({ it, home, tone }: { it: WeekendItem; home: string | null; tone: string }) {
  const [expanded, setExpanded] = useState(false)
  const link = safeLink(it.link)
  return (
    <article
      style={{
        display: 'grid',
        gridTemplateColumns: '68px 1fr',
        background: color.cardWhite,
        border: `1px solid ${color.line}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '10px 4px',
          background: hexA(color.keep, 0.08),
          color: color.keep,
        }}
      >
        <b style={{ fontFamily: font.display, fontSize: 20, lineHeight: 1 }}>{fmtKm(it.km)}</b>
        <span style={{ fontFamily: font.mono, fontSize: 10.5 }}>km</span>
        {it.time && <span style={{ fontSize: 10.5, color: color.softInk, marginTop: 4, lineHeight: 1.25 }}>{it.time}</span>}
      </div>
      <div style={{ padding: '11px 13px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 600, lineHeight: 1.3 }}>{it.name}</h3>
        {it.where && <div style={{ fontSize: 12.5, color: color.softInk }}>{it.where}</div>}
        {it.desc && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            style={{
              margin: 0,
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              textAlign: 'left',
              font: 'inherit',
              fontSize: 13.5,
              lineHeight: 1.45,
              cursor: 'pointer',
              ...(expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }),
            }}
          >
            {it.desc}
          </button>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Chip bg={hexA(tone, 0.12)} fg={tone} strong>
            {it.type === 'free' ? 'Ingyenes' : it.price ?? 'Fizetős'}
          </Chip>
          <Chip strong>{it.days.map((d) => DAY_LABEL[d]).join(' · ')}</Chip>
          {it.ages && <Chip>{it.ages}</Chip>}
          {it.verify && (
            <Chip bg={hexA(WARN, 0.14)} fg={WARN}>
              Ellenőrizd
            </Chip>
          )}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 2 }}>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" style={actionLink}>
              Program ↗
            </a>
          )}
          <a href={directionsUrl(it.maps, home)} target="_blank" rel="noopener noreferrer" style={actionLink}>
            Útvonal ↗
          </a>
        </div>
      </div>
    </article>
  )
}

const actionLink: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: color.keep, textDecoration: 'none' }

function Chip({ children, bg, fg, strong }: { children: React.ReactNode; bg?: string; fg?: string; strong?: boolean }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: '2px 8px',
        borderRadius: 6,
        background: bg ?? color.paper,
        color: fg ?? color.ink,
        border: bg ? '1px solid transparent' : `1px solid ${color.line}`,
        fontWeight: strong ? 600 : 400,
      }}
    >
      {children}
    </span>
  )
}
