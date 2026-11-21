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
  // Set by the daily warnings check; absent until it has run for this weekend.
  alerts_checked_at?: string | null
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

// When the warnings were last looked at: the daily check, or the weekly scan
// if that ran later (a rescan replaces the warnings too).
export function alertsCheckedAt(s: Pick<WeekendScreen, 'screened_at' | 'alerts_checked_at'>): string {
  const a = s.alerts_checked_at
  return a && new Date(a).getTime() > new Date(s.screened_at).getTime() ? a : s.screened_at
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
