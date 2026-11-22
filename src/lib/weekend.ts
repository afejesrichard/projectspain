// The weekend screen's logic, pure and testable. The content itself is
// written by the Thursday scan (weekend_save) in the language the scan writes;
// only the app's own labels are Hungarian.

export type WeekendDay = 'Fri' | 'Sat' | 'Sun'
export type DayFilter = 'all' | WeekendDay
export type ZoneFilter = 'all' | 'city' | 'trip'

export interface WeekendItem {
  name: string
  type: 'free' | 'paid'
  zone: 'city' | 'trip'
  km: number
  time?: string
  days: WeekendDay[]
  where?: string
  desc?: string
  ages?: string
  price?: string
  verify?: boolean
  link: string
  maps: string
}

export interface WeekendAlert {
  level: 'ok' | 'warn' | 'info'
  tag?: string
  text: string
  note?: string
}

export interface WeekendScreen {
  weekend_from: string
  weekend_to: string
  screened_at: string
  next_screen: string | null
  alert_status: 'ok' | 'warn'
  alert_title: string
  alerts: WeekendAlert[]
  items: WeekendItem[]
}

// The shape weekend_current() returns.
export interface WeekendCurrent {
  today: string
  screen: WeekendScreen | null
  stale: boolean
  home: { address: string; label?: string } | null
  weather?: WeatherOutlook | null
}

// The daily outlook (weather_save): today and the next two days, checked
// every morning whatever weekend is on screen.
export interface WeatherDay {
  date: string
  level: 'ok' | 'warn'
  summary: string
  tmin?: number
  tmax?: number
  rain_pct?: number
  gust_kmh?: number
}

export interface WeatherOutlook {
  checked_at: string
  status: 'ok' | 'warn'
  title: string
  days: WeatherDay[]
  alerts: WeekendAlert[]
}

export interface Filters {
  day: DayFilter
  zone: ZoneFilter
}

export const DAY_LABEL: Record<WeekendDay, string> = { Fri: 'P', Sat: 'Szo', Sun: 'V' }

// Free and paid lists, each closest first, after the day and zone filters.
export function splitItems(items: WeekendItem[], f: Filters): { free: WeekendItem[]; paid: WeekendItem[] } {
  const keep = items
    .filter((i) => (f.day === 'all' || i.days.includes(f.day)) && (f.zone === 'all' || i.zone === f.zone))
    .sort((a, b) => a.km - b.km)
  return { free: keep.filter((i) => i.type === 'free'), paid: keep.filter((i) => i.type === 'paid') }
}

// 1.7 km under ten, whole kilometres above.
export function fmtKm(km: number): string {
  return km < 10 ? km.toFixed(1).replace('.', ',') : String(Math.round(km))
}

// Directions from home; without a stored home address, the maps app uses
// wherever the phone is.
export function directionsUrl(destination: string, origin?: string | null): string {
  const p = new URLSearchParams({ api: '1', destination })
  if (origin) p.set('origin', origin)
  return `https://www.google.com/maps/dir/?${p.toString()}`
}

// Links come from web pages the scan read; only http(s) is ever opened.
export function safeLink(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null
}

const MONTH_DAY = new Intl.DateTimeFormat('hu-HU', { month: 'short', day: 'numeric' })
const MONTH_SHORT = new Intl.DateTimeFormat('hu-HU', { month: 'short' })

function parse(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

// "nov. 20–22." or "nov. 28. – dec. 1."
export function fmtWeekend(from: string, to: string): string {
  const a = parse(from)
  const b = parse(to)
  if (a.getMonth() === b.getMonth()) return `${MONTH_SHORT.format(a)} ${a.getDate()}–${b.getDate()}.`
  return `${MONTH_DAY.format(a)} – ${MONTH_DAY.format(b)}`
}

export function fmtDate(iso: string): string {
  return MONTH_DAY.format(parse(iso))
}

// The outlook while it still covers today, with the days already past
// dropped. An outlook whose days have all gone by (the daily check has not
// run for a while) is not shown at all: the weekly scan's alerts take over.
export function liveWeather(w: WeatherOutlook | null | undefined, today: string): WeatherOutlook | null {
  if (!w || !Array.isArray(w.days)) return null
  const days = w.days.filter((d) => d.date >= today)
  if (days.length === 0) return null
  // A warning that only applied to a day now past no longer colours the strip.
  const status = days.length === w.days.length ? w.status : days.some((d) => d.level === 'warn') ? 'warn' : 'ok'
  return { ...w, days, status }
}

// The weekly scan's notes that are not about the weather (an upcoming city
// event, say) still belong under a current outlook.
export function otherNotes(alerts: WeekendAlert[]): WeekendAlert[] {
  return alerts.filter((a) => a.level === 'info' && !['Weather', 'Warning', 'Ended'].includes(a.tag ?? ''))
}

const WEEKDAY = new Intl.DateTimeFormat('hu-HU', { weekday: 'short' })

// "ma", "holnap", then the weekday: "K 24."
export function fmtDayLabel(iso: string, today: string): string {
  const d = parse(iso)
  const diff = Math.round((d.getTime() - parse(today).getTime()) / 86400000)
  if (diff === 0) return 'ma'
  if (diff === 1) return 'holnap'
  return `${WEEKDAY.format(d)} ${d.getDate()}.`
}

// "9–17°", or one figure when only one is known.
export function fmtTemps(d: Pick<WeatherDay, 'tmin' | 'tmax'>): string | null {
  const lo = d.tmin == null ? null : Math.round(d.tmin)
  const hi = d.tmax == null ? null : Math.round(d.tmax)
  if (lo != null && hi != null) return `${lo}–${hi}°`
  if (hi != null) return `${hi}°`
  if (lo != null) return `${lo}°`
  return null
}

const STAMP = new Intl.DateTimeFormat('hu-HU', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
})

// "nov. 22. 7:43", in Barcelona time whatever the phone is set to.
export function fmtStamp(iso: string): string {
  return STAMP.format(new Date(iso))
}

// Filters are remembered per device; anything unexpected falls back.
export function readFilters(raw: string | null): Filters {
  try {
    const v = raw ? JSON.parse(raw) : null
    const day: DayFilter = ['all', 'Fri', 'Sat', 'Sun'].includes(v?.day) ? v.day : 'all'
    const zone: ZoneFilter = ['all', 'city', 'trip'].includes(v?.zone) ? v.zone : 'all'
    return { day, zone }
  } catch {
    return { day: 'all', zone: 'all' }
  }
}
