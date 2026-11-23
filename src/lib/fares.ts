// BCN-BUD fare watch: calendars, watch windows, averages, tiers and booking
// links. Ported from the Fare Watch artifact with its behaviour unchanged;
// money is integer cents (INVARIANT [EXP-04]) and "today" is a parameter so
// every rule is testable. Party sizes and starting estimates come from
// app_settings (INVARIANT [PRIV-01]).

export type Party = 'family' | 'grandparents'

export interface Trip {
  id: string
  party: Party
  outDate: string
  retDate: string
  outDep: string
  outArr: string
  retDep: string
  retArr: string
  outCarrier: string
  retCarrier: string
  // one adult, both legs
  priceCents: number
  // the whole party, when a source showed it
  partyPriceCents: number | null
  note: string
  source: 'scan' | 'manual'
  foundAt: string
}

export interface Leg {
  id: string
  travelDate: string
  direction: 'BCN-BUD' | 'BUD-BCN'
  carrier: string
  priceCents: number
  note: string
  source: 'scan' | 'manual'
  foundAt: string
}

export interface FareSettings {
  party: Record<Party, { adults: number; children: number }>
  seeds_cents: {
    next4: number
    christmas: number
    easter: number
    summer: number
    gp_long_weekend: number
    gp_sniper: number
    // optional: until it is set, the family sniper starts from the normal-dates estimate
    fam_sniper?: number
  }
}

// --- Dates: ISO strings, arithmetic in UTC so no time zone can shift a day ---
const DAY = 864e5
const D = (s: string) => new Date(s + 'T00:00:00Z')
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)
export const shift = (s: string, n: number) => iso(addDays(D(s), n))
export const weekday = (s: string) => D(s).getUTCDay()
export const daysBetween = (a: string, b: string) => Math.round((D(b).getTime() - D(a).getTime()) / DAY)

// The calendar date on this device, as an ISO string.
export function localToday(now = new Date()): string {
  return iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

export function easter(Y: number): string {
  const a = Y % 19
  const b = Math.floor(Y / 100)
  const c = Y % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mo = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return iso(new Date(Date.UTC(Y, mo - 1, day)))
}

// Spanish national and Catalan holidays, plus La Merced: the family's calendar.
// Named in Spanish, as they appear on the family's own calendar.
const ES_FIXED: [string, string][] = [
  ['01-01', 'Año Nuevo'],
  ['01-06', 'Reyes'],
  ['05-01', 'Día del Trabajador'],
  ['06-24', 'San Juan'],
  ['08-15', 'Asunción'],
  ['09-11', 'Diada de Cataluña'],
  ['09-24', 'La Merced'],
  ['10-12', 'Fiesta Nacional'],
  ['11-01', 'Todos los Santos'],
  ['12-06', 'Día de la Constitución'],
  ['12-08', 'Inmaculada Concepción'],
  ['12-25', 'Navidad'],
  ['12-26', 'San Esteban'],
]
// Hungarian public holidays: the grandparents' work calendar. Bridge days are
// set each year by decree; Tue/Thu holidays usually get one.
const HU_FIXED: [string, string][] = [
  ['01-01', 'Újév'],
  ['03-15', 'Március 15.'],
  ['05-01', 'Munka ünnepe'],
  ['08-20', 'Augusztus 20.'],
  ['10-23', 'Október 23.'],
  ['11-01', 'Mindenszentek'],
  ['12-24', 'Szenteste'],
  ['12-25', 'Karácsony'],
  ['12-26', 'Karácsony másnapja'],
]

const esCache = new Map<number, Record<string, string>>()
export function holidaysES(Y: number): Record<string, string> {
  let m = esCache.get(Y)
  if (m) return m
  m = {}
  for (const [md, n] of ES_FIXED) m[`${Y}-${md}`] = n
  const e = easter(Y)
  m[shift(e, -2)] = 'Viernes Santo'
  m[shift(e, 1)] = 'Lunes de Pascua'
  esCache.set(Y, m)
  return m
}

const huCache = new Map<number, Record<string, string>>()
export function holidaysHU(Y: number): Record<string, string> {
  let m = huCache.get(Y)
  if (m) return m
  m = {}
  for (const [md, n] of HU_FIXED) m[`${Y}-${md}`] = n
  const e = easter(Y)
  m[shift(e, -2)] = 'Nagypéntek'
  m[shift(e, 1)] = 'Húsvéthétfő'
  m[shift(e, 50)] = 'Pünkösdhétfő'
  huCache.set(Y, m)
  return m
}

export const holidayES = (s: string): string | undefined => holidaysES(+s.slice(0, 4))[s]
export const holidayHU = (s: string): string | undefined => holidaysHU(+s.slice(0, 4))[s]

// The family's days off: Fridays, weekends and Catalan holidays.
export const isOff = (s: string) => {
  const w = weekday(s)
  return w === 5 || w === 6 || w === 0 || !!holidayES(s)
}

// --- Camp: the first full Mon-Sun week of July --------------------------------
export interface Camp {
  start: string
  end: string
  latestOut: string
  earliestOut: string
  latestRet: string
}

export function camp(Y: number): Camp {
  let d = `${Y}-07-01`
  while (weekday(d) !== 1) d = shift(d, 1)
  const start = d
  const end = shift(d, 6)
  const latestOut = shift(d, -1)
  return { start, end, latestOut, earliestOut: shift(end, -14), latestRet: shift(latestOut, 14) }
}

// Out by the Sunday before camp, home on a Sunday or Monday from camp's
// Sunday on, 14 days at most.
export const campOK = (t: Pick<Trip, 'outDate' | 'retDate'>, c: Camp) =>
  t.outDate <= c.latestOut &&
  t.retDate >= c.end &&
  (weekday(t.retDate) === 0 || weekday(t.retDate) === 1) &&
  daysBetween(t.outDate, t.retDate) <= 14

export function campReturns(c: Camp): string[] {
  const r: string[] = []
  for (let s = c.end; s <= c.latestRet; s = shift(s, 1)) if (weekday(s) === 0 || weekday(s) === 1) r.push(s)
  return r
}

// --- Long weekends: a holiday on Fri/Mon makes three days; on Thu/Tue the bridge
// day joins it; overlapping blocks merge. ------------------------------------------
export interface LongWeekend {
  start: string
  end: string
  names: string[]
  bridges: string[]
}

export function longWeekends(fromS: string, toS: string, nameFn: (s: string) => string | undefined = holidayES): LongWeekend[] {
  const blocks: LongWeekend[] = []
  for (let s = fromS; s <= toS; s = shift(s, 1)) {
    const n = nameFn(s)
    if (!n) continue
    const w = weekday(s)
    let a: string
    let b: string
    let bridge: string | null = null
    if (w === 5) {
      a = s
      b = shift(s, 2)
    } else if (w === 1) {
      a = shift(s, -2)
      b = s
    } else if (w === 4) {
      a = s
      b = shift(s, 3)
      bridge = shift(s, 1)
    } else if (w === 2) {
      a = shift(s, -3)
      b = s
      bridge = shift(s, -1)
    } else continue
    blocks.push({ start: a, end: b, names: [n], bridges: bridge && !nameFn(bridge) ? [bridge] : [] })
  }
  blocks.sort((x, y) => (x.start < y.start ? -1 : 1))
  const merged: LongWeekend[] = []
  for (const bl of blocks) {
    const last = merged[merged.length - 1]
    if (last && bl.start <= shift(last.end, 1)) {
      if (bl.end > last.end) last.end = bl.end
      last.names.push(...bl.names)
      last.bridges.push(...bl.bridges)
    } else merged.push({ ...bl, names: [...bl.names], bridges: [...bl.bridges] })
  }
  return merged.filter((m) => m.end >= fromS)
}

export const gpWeekends = (fromS: string, toS: string) => longWeekends(fromS, toS, holidayHU)

// Every grandparent visit, long weekend or sniper, is at least two nights: a
// Saturday-evening-in, Sunday-dawn-out hop is not worth the flights.
export const GP_MIN_NIGHTS = 2

// A visit is for time together, so flight times count as well as dates. Coming
// the evening before the first day off is ideal; flying on that day itself, they
// land by 12:30. A return before 12:30 throws the last day away and does not
// count at all; from 17:00 it is an evening return, which is what we want.
// "HH:MM" strings compare correctly as text. An unknown time is not held
// against a trip here: the card flags it instead.
export const GP_LAND_BY = '12:30'
export const GP_LEAVE_FROM = '12:30'
export const GP_EVENING = '17:00'

type GpProbe = Pick<Trip, 'outDate' | 'retDate'> & Partial<Pick<Trip, 'outArr' | 'retDep'>>

export const gpTimesOK = (t: GpProbe, firstDayOff: string) =>
  !(t.outDate >= firstDayOff && !!t.outArr && t.outArr > GP_LAND_BY) && !(!!t.retDep && t.retDep < GP_LEAVE_FROM)

// Grandparents fly on their own days off: out the evening before the long
// weekend or on its first morning, home on its last day (the day before only
// as a fallback, see gpRank), staying at least two nights.
export const gpMatches = (t: GpProbe, lw: LongWeekend) =>
  t.outDate >= shift(lw.start, -1) &&
  t.outDate <= lw.start &&
  t.retDate >= shift(lw.end, -1) &&
  t.retDate <= lw.end &&
  daysBetween(t.outDate, t.retDate) >= GP_MIN_NIGHTS &&
  gpTimesOK(t, lw.start)

// How well a visit uses its days: going home on the last day off beats the day
// before, and an evening return beats an afternoon one. The best live trip is
// the cheapest among the highest rank on offer.
export const gpRank = (t: GpProbe, lastDay: string | null) =>
  (lastDay == null || t.retDate >= lastDay ? 2 : 0) + (!!t.retDep && t.retDep >= GP_EVENING ? 1 : 0)

// What the best trip gives up, for the card.
export function gpCaveat(t: GpProbe, lastDay: string | null): string | undefined {
  const c: string[] = []
  if (lastDay != null && t.retDate < lastDay) c.push('nem az utolsó napon indul haza')
  if (!t.retDep) c.push('hazaút ideje ismeretlen')
  else if (t.retDep < GP_EVENING) c.push('délutáni hazaút: rövid utolsó nap')
  return c.length ? c.join(' · ') : undefined
}

// --- Trip rules ------------------------------------------------------------------------
export const isGp = (t: Pick<Trip, 'party'>) => t.party === 'grandparents'

export function partySize(t: Pick<Trip, 'party'>, s: FareSettings): number {
  const p = s.party[t.party]
  return p.adults + p.children
}

// The party total: the shown party price, or the 1-adult fare times the party.
export const totalCents = (t: Trip, s: FareSettings) =>
  t.partyPriceCents && t.partyPriceCents > 0 ? t.partyPriceCents : partySize(t, s) * t.priceCents
export const totalIsEstimate = (t: Trip) => !(t.partyPriceCents && t.partyPriceCents > 0)

// Family trips over 16 days and grandparent visits over 10 days are ignored.
export const tooLong = (t: Trip) => daysBetween(t.outDate, t.retDate) > (isGp(t) ? 10 : 16)

// A weekend trip worth sniping, for either party: at least two nights around
// one ordinary weekend. Out on Thursday, Friday or Saturday, home on Sunday or
// Monday, 2 to 4 nights: Fri→Sun, Sat→Mon, Fri→Mon, Thu→Sun, Thu→Mon.
// A Saturday-evening-in, Sunday-dawn-out hop (one night) does not count.

export const isWeekendTrip = (t: Pick<Trip, 'outDate' | 'retDate'>) => {
  const out = weekday(t.outDate)
  const ret = weekday(t.retDate)
  const nights = daysBetween(t.outDate, t.retDate)
  return (out === 4 || out === 5 || out === 6) && (ret === 0 || ret === 1) && nights >= GP_MIN_NIGHTS && nights <= 4
}

// The Saturday a weekend trip is built around: one weekend, one entry.
const weekendOf = (t: Pick<Trip, 'outDate'>) => shift(t.outDate, 6 - weekday(t.outDate))

// The grandparents' ordinary weekend: the same days, plus their flight times
// (a Saturday arrival lands by 12:30, no return before 12:30).
export const isGpWeekend = (t: GpProbe) => isWeekendTrip(t) && gpTimesOK(t, weekendOf(t))

// --- Watch windows ------------------------------------------------------------------------
export type WindowKey = 'next4' | 'christmas' | 'easter' | 'summer'

export interface Window {
  key: WindowKey
  name: string
  start: string
  end: string
  seedCents: number
  note: string
  easterSunday?: string
  camp?: Camp
}

const MD = new Intl.DateTimeFormat('hu-HU', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const WMD = new Intl.DateTimeFormat('hu-HU', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
export const fmtShort = (s: string) => MD.format(D(s))
export const fmtDay = (s: string) => WMD.format(D(s))

export function windows(today: string, s: FareSettings): Window[] {
  const Y = +today.slice(0, 4)
  let xS = `${Y}-12-18`
  let xE = `${Y + 1}-01-07`
  if (today <= `${Y}-01-07`) {
    xS = `${Y - 1}-12-18`
    xE = `${Y}-01-07`
  }
  let eY = Y
  let ez = easter(Y)
  if (today > shift(ez, 8)) {
    eY = Y + 1
    ez = easter(Y + 1)
  }
  let sY = Y
  if (today > camp(Y).latestOut) sY = Y + 1
  const c = camp(sY)
  return [
    { key: 'next4', name: 'Következő 4 hét', start: today, end: shift(today, 28), seedCents: s.seeds_cents.next4, note: 'indulás 28 napon belül' },
    { key: 'christmas', name: 'Karácsony', start: xS, end: xE, seedCents: s.seeds_cents.christmas, note: `indulás ${fmtShort(xS)} – ${fmtShort(xE)}` },
    {
      key: 'easter',
      name: `Húsvét ${eY}`,
      start: shift(ez, -9),
      end: shift(ez, 8),
      seedCents: s.seeds_cents.easter,
      note: `húsvétvasárnap ${fmtShort(ez)}`,
      easterSunday: ez,
    },
    {
      key: 'summer',
      name: `Tábor ${sY}`,
      start: c.earliestOut,
      end: c.latestOut,
      seedCents: s.seeds_cents.summer,
      camp: c,
      note: `indulás ${fmtShort(c.earliestOut)} – ${fmtShort(c.latestOut)} · haza V/H ${fmtShort(c.end)} – ${fmtShort(c.latestRet)}`,
    },
  ]
}

const FESTIVE: WindowKey[] = ['christmas', 'easter', 'summer']

// The festive windows a family trip belongs to (next4 is matched by date).
export function windowsFor(t: Trip, W: Window[]): WindowKey[] {
  if (isGp(t)) return []
  return W.filter((w) => {
    if (w.key === 'next4') return false
    if (w.key === 'summer') return campOK(t, w.camp!)
    return t.outDate >= w.start && t.outDate <= w.end
  }).map((w) => w.key)
}

// A family weekend for the sniper: a weekend trip outside the festive and camp
// windows, which are judged against their own averages.
export const isFamWeekend = (t: Trip, W: Window[]) => !isGp(t) && isWeekendTrip(t) && !windowsFor(t, W).some((k) => FESTIVE.includes(k))

const famSniperSeed = (s: FareSettings) => s.seeds_cents.fam_sniper ?? s.seeds_cents.next4

// Both flights on a family day off (a Monday camp return counts as fine).
export const workFriendly = (t: Trip, W?: Window[]) =>
  isOff(t.outDate) && (isOff(t.retDate) || (!!W && windowsFor(t, W).includes('summer')))

function offDatesIn(a: string, b: string, max: number): string[] {
  const out: string[] = []
  for (let s = a; s <= b && out.length < max; s = shift(s, 1)) if (isOff(s)) out.push(s)
  return out
}

// The dates to aim for in a window, as one line.
export function targets(w: Window): string {
  if (w.key === 'summer') {
    const c = w.camp!
    return `Indulás ${offDatesIn(shift(c.latestOut, -2), c.latestOut, 3).map(fmtDay).join(', ')} · haza ${campReturns(c).map(fmtDay).join(', ')}`
  }
  if (w.key === 'easter') {
    const e = w.easterSunday!
    return `Indulás ${fmtDay(shift(e, -2))} · vissza ${fmtDay(shift(e, 1))}`
  }
  const hs = offDatesIn(w.start, w.end, 40).filter((s) => holidayES(s))
  if (w.key === 'christmas') return 'Ünnepek: ' + hs.map(fmtDay).join(', ')
  return hs.length ? 'Ünnepek: ' + hs.map((s) => `${fmtDay(s)} ${holidayES(s)}`).join(', ') : 'P → V hétvégék'
}

// --- Tiers -------------------------------------------------------------------------
export type TierKey = 'none' | 'err' | 'strong' | 'below' | 'flat'

export interface Tier {
  key: TierKey
  label: string
}

export function tier(delta: number | null, sniper: boolean): Tier {
  if (delta == null) return { key: 'none', label: 'Nincs élő út' }
  if (delta <= -0.5) return { key: 'err', label: 'Hibásár-zóna' }
  if (delta <= -0.25) return { key: 'strong', label: sniper ? 'Mesterlövész: vedd' : 'Erős vétel' }
  if (delta < 0) return sniper ? { key: 'flat', label: 'Várj · −25% kell' } : { key: 'below', label: 'Átlag alatt' }
  return { key: 'flat', label: 'Átlagon / fölött' }
}

// Until a window has 5 trips, its average blends in the starting estimate.
export function blend<T>(list: T[], seed: number, m: (q: T) => number): { n: number; avg: number } {
  const n = list.length
  const sum = list.reduce((acc, q) => acc + m(q), 0)
  return { n, avg: n >= 5 ? sum / n : (seed * (5 - n) + sum) / 5 }
}

// --- The board -------------------------------------------------------------------------
export interface Row {
  key: string
  name: string
  note: string
  targets: string[]
  avgCents: number
  avgAdultCents: number
  n: number
  best: Trip | null
  delta: number | null
  tier: Tier
  history: Trip[]
  sniper: boolean
  // grandparents only: what the best live trip gives up (an earlier day home,
  // an afternoon return, an unknown time)
  caveat?: string
  // family sniper only: further live weekends under the average, cheapest
  // first, one per weekend
  others?: { trip: Trip; delta: number }[]
}

export interface Deal {
  label: string
  trip: Trip
  delta: number
  tier: Tier
}

export interface Board {
  today: string
  windows: Window[]
  family: Row[]
  supers: (Deal & { windowName: string })[]
  superCutoff: string
  grandparents: Row[]
  alerts: Deal[]
  // distinct trips among the alerts
  dealCount: number
  lastScan: string | null
}

const WEEK = 7 * DAY

// A weekday deal needs leave, so it has to depart far enough ahead to arrange it.
export const SUPER_LEAD_DAYS = 21
// Both snipers stay quiet until a weekend is this far under its average.
const SNIPER_DROP = -0.25
// Further cheap weekends listed under the family sniper's best one.
const SNIPER_OTHERS = 4

const SNIPER_NAME = 'Hétvégi mesterlövész'

export function computeBoard(trips: Trip[], legs: Leg[], s: FareSettings, today: string, nowMs: number): Board {
  const W = windows(today, s)
  const total = (t: Trip) => totalCents(t, s)
  const weekAgo = nowMs - WEEK
  // Live: seen in the last seven days and not yet departed.
  const isLive = (t: Trip) => t.outDate >= today && (Date.parse(t.foundAt) || 0) >= weekAgo
  const cheapest = (list: Trip[]) => (list.length ? list.reduce((a, b) => (total(b) < total(a) ? b : a)) : null)
  const fam = trips.filter((t) => !isGp(t) && !tooLong(t))
  const gps = trips.filter((t) => isGp(t) && !tooLong(t))
  const alerts: Deal[] = []
  const avgBy: Record<string, number> = {}

  const family: Row[] = W.map((w) => {
    const inW =
      w.key === 'next4' ? fam.filter((t) => t.outDate >= w.start && t.outDate <= w.end) : fam.filter((t) => windowsFor(t, W).includes(w.key))
    const base = w.key === 'next4' ? fam.filter((t) => !windowsFor(t, W).some((k) => FESTIVE.includes(k))) : inW
    const { n, avg } = blend(base, w.seedCents, total)
    const avgA = blend(base, w.seedCents / 4, (q) => q.priceCents).avg
    avgBy[w.key] = avg
    const live = inW.filter(isLive)
    const friendly = live.filter((t) => workFriendly(t, W))
    const best = cheapest(friendly.length ? friendly : live)
    const delta = best ? (total(best) - avg) / avg : null
    const t = tier(delta, false)
    if (delta != null && delta < 0) alerts.push({ label: w.name, trip: best!, delta, tier: t })
    return { key: w.key, name: w.name, note: w.note, targets: [targets(w)], avgCents: avg, avgAdultCents: avgA, n, best, delta, tier: t, history: inW, sniper: false }
  })

  // Family weekend sniper: any ordinary weekend, out Thu/Fri/Sat and home
  // Sun/Mon after 2 to 4 nights. Festive and camp trips keep to their own
  // windows. The cheapest weekend wins even when it touches a working day (the
  // card says so); it alerts at 25% under, like the grandparents' sniper.
  {
    const famWk = fam.filter((t) => isFamWeekend(t, W))
    const sa = blend(famWk, famSniperSeed(s), total)
    const saA = blend(famWk, famSniperSeed(s) / 4, (q) => q.priceCents).avg
    const live = famWk.filter(isLive).sort((a, b) => total(a) - total(b))
    const best = live[0] ?? null
    const delta = best ? (total(best) - sa.avg) / sa.avg : null
    const t = tier(delta, true)
    if (delta != null && delta <= SNIPER_DROP) alerts.push({ label: SNIPER_NAME, trip: best!, delta, tier: t })
    const seen = new Set(best ? [weekendOf(best)] : [])
    const others: { trip: Trip; delta: number }[] = []
    for (const q of live.slice(1)) {
      const d = (total(q) - sa.avg) / sa.avg
      if (d >= 0 || others.length >= SNIPER_OTHERS) break
      const wk = weekendOf(q)
      if (seen.has(wk)) continue
      seen.add(wk)
      others.push({ trip: q, delta: d })
    }
    family.push({
      key: 'fam-sniper',
      name: SNIPER_NAME,
      note: 'bármely sima hétvége · legalább 2 éjszaka · −25%-nál jelez',
      targets: ['Indulás: csütörtök, péntek vagy szombat', 'Haza: vasárnap vagy hétfő, legalább 2 éjszaka után'],
      avgCents: sa.avg,
      avgAdultCents: saA,
      n: sa.n,
      best,
      delta,
      tier: t,
      history: famWk,
      sniper: true,
      others,
    })
  }

  // Super deals: any day of the week, 3+ weeks out, 35%+ under the matching average.
  const cutoff = shift(today, SUPER_LEAD_DAYS)
  const wname: Record<string, string> = Object.fromEntries(W.map((w) => [w.key, w.key === 'next4' ? 'Normál dátumok' : w.name]))
  const supers = fam
    .filter((t) => isLive(t) && t.outDate >= cutoff)
    .map((t) => {
      const k = windowsFor(t, W).find((x) => FESTIVE.includes(x)) ?? 'next4'
      const avg = avgBy[k]
      const delta = (total(t) - avg) / avg
      return { trip: t, delta, windowName: wname[k], label: 'Szuper ajánlat · ' + wname[k], tier: tier(delta, false) }
    })
    .filter((x) => x.delta <= -0.35)
    .sort((a, b) => a.delta - b.delta)
  supers.slice(0, 3).forEach((x) => alerts.push({ label: x.label, trip: x.trip, delta: x.delta, tier: x.tier }))

  // Grandparents: Hungarian long weekends share one pooled average.
  const LW = gpWeekends(today, shift(today, 330)).slice(0, 8)
  const gpLW = gps.filter((t) => LW.some((l) => gpMatches(t, l)))
  const gpWk = gps.filter((t) => isGpWeekend(t) && !LW.some((l) => gpMatches(t, l)))
  // The cheapest among the trips that use their days best.
  const gpBest = (list: Trip[], lastDay: string | null) => {
    const top = Math.max(...list.map((t) => gpRank(t, lastDay)))
    return cheapest(list.filter((t) => gpRank(t, lastDay) === top))
  }
  const gpAvg = blend(gpLW, s.seeds_cents.gp_long_weekend, total)
  const gpAvgA = blend(gpLW, s.seeds_cents.gp_long_weekend / 2, (q) => q.priceCents).avg

  const grandparents: Row[] = LW.map((lw) => {
    const inW = gps.filter((t) => gpMatches(t, lw))
    const best = gpBest(inW.filter(isLive), lw.end)
    const delta = best ? (total(best) - gpAvg.avg) / gpAvg.avg : null
    const t = tier(delta, false)
    const label = `Hosszú hétvége ${fmtShort(lw.start)} – ${fmtShort(lw.end)}`
    if (delta != null && delta < 0) alerts.push({ label, trip: best!, delta, tier: t })
    const names = [...new Set(lw.names)].join(' + ')
    return {
      key: `lw-${lw.start}`,
      name: `${fmtDay(lw.start)} – ${fmtDay(lw.end)}`,
      note: names + (lw.bridges.length ? ' · híd ' + lw.bridges.map(fmtDay).join(', ') : ''),
      targets: [
        `Érkezés: ${fmtDay(shift(lw.start, -1))} munka után, vagy ${fmtDay(lw.start)} 12:30-ig`,
        `Haza: ${fmtDay(lw.end)} este (17:00-tól); ${fmtDay(shift(lw.end, -1))} csak ha nincs jobb`,
      ],
      caveat: best ? gpCaveat(best, lw.end) : undefined,
      avgCents: gpAvg.avg,
      avgAdultCents: gpAvgA,
      n: gpAvg.n,
      best,
      delta,
      tier: t,
      history: inW,
      sniper: false,
    }
  })
  {
    const sa = blend(gpWk, s.seeds_cents.gp_sniper, total)
    const saA = blend(gpWk, s.seeds_cents.gp_sniper / 2, (q) => q.priceCents).avg
    const best = gpBest(gpWk.filter(isLive), null)
    const delta = best ? (total(best) - sa.avg) / sa.avg : null
    const t = tier(delta, true)
    if (delta != null && delta <= SNIPER_DROP) alerts.push({ label: SNIPER_NAME, trip: best!, delta, tier: t })
    grandparents.push({
      key: 'gp-sniper',
      name: SNIPER_NAME,
      note: 'bármely sima hétvége · legalább 2 éjszaka · −25%-nál jelez',
      targets: ['Érkezés: csütörtök vagy péntek, vagy szombat 12:30-ig', 'Haza: vasárnap vagy hétfő este (17:00-tól), 12:30 előtt soha'],
      avgCents: sa.avg,
      avgAdultCents: saA,
      n: sa.n,
      best,
      delta,
      tier: t,
      history: gpWk,
      sniper: true,
      caveat: best ? gpCaveat(best, null) : undefined,
    })
  }

  alerts.sort((a, b) => a.delta - b.delta)
  const unique = alerts.filter((a, i) => alerts.findIndex((x) => x.trip.id === a.trip.id) === i)
  const scans = [...trips, ...legs].filter((q) => q.source === 'scan').map((q) => Date.parse(q.foundAt) || 0)

  return {
    today,
    windows: W,
    family,
    supers,
    superCutoff: cutoff,
    grandparents,
    alerts: unique,
    dealCount: unique.length,
    lastScan: scans.length ? new Date(Math.max(...scans)).toISOString() : null,
  }
}

// The window a logged trip falls in, for the trip log.
export function windowLabel(t: Trip, board: Board): string {
  const W = board.windows
  if (isGp(t)) {
    const LW = gpWeekends(board.today, shift(board.today, 330)).slice(0, 8)
    const lw = LW.find((l) => gpMatches(t, l))
    return lw ? `Hosszú hétvége ${fmtShort(lw.start)} – ${fmtShort(lw.end)}` : isGpWeekend(t) ? 'Hétvége' : 'Egyéb dátum'
  }
  const names: Record<string, string> = Object.fromEntries(W.map((w) => [w.key, w.name]))
  const ks = windowsFor(t, W).map((k) => names[k])
  if (t.outDate >= W[0].start && t.outDate <= W[0].end) ks.unshift(names.next4)
  if (isFamWeekend(t, W)) ks.push('Hétvége')
  return ks.join(', ') || 'Normál dátumok'
}

// --- Booking links: route, dates and passengers filled in ----------------------------------
export const ends = (t: Pick<Trip, 'party'>): [string, string] => (isGp(t) ? ['BUD', 'BCN'] : ['BCN', 'BUD'])

export function ryanairUrl(from: string, to: string, out: string, back: string | null, a: number, c: number): string {
  const q = new URLSearchParams({
    adults: String(a),
    teens: '0',
    children: String(c),
    infants: '0',
    dateOut: out,
    dateIn: back ?? '',
    isConnectedFlight: 'false',
    discount: '0',
    isReturn: back ? 'true' : 'false',
    promoCode: '',
    originIata: from,
    destinationIata: to,
    tpAdults: String(a),
    tpTeens: '0',
    tpChildren: String(c),
    tpInfants: '0',
    tpStartDate: out,
    tpEndDate: back ?? '',
    tpDiscount: '0',
    tpPromoCode: '',
    tpOriginIata: from,
    tpDestinationIata: to,
  })
  // ie/en is Ryanair's English-language market priced in EUR.
  return 'https://www.ryanair.com/ie/en/trip/flights/select?' + q.toString()
}

export const wizzUrl = (from: string, to: string, out: string, back: string | null, a: number, c: number) =>
  `https://wizzair.com/en-gb/booking/select-flight/${from}/${to}/${out}/${back ?? 'null'}/${a}/${c}/0/null`

// Every carrier on the same dates, with the whole party, nonstop only, cheapest
// first. Kayak takes route, dates and passengers in the path, so the search
// opens filled in. It needs a child's age, not just a count; both airlines
// charge children from 2 a full seat, so a placeholder age of 5 prices them
// correctly without the real ages living in the code (PRIV-01).
const CHILD_AGE_FOR_PRICING = 5

export function kayakUrl(from: string, to: string, out: string, back: string | null, a: number, c: number): string {
  const kids = c > 0 ? `/children-${Array.from({ length: c }, () => CHILD_AGE_FOR_PRICING).join('-')}` : ''
  return `https://www.kayak.com/flights/${from}-${to}/${out}${back ? '/' + back : ''}/${a}adults${kids}?sort=price_a&fs=stops=0`
}

function carrierUrl(carrier: string, from: string, to: string, out: string, back: string | null, a: number, c: number) {
  if (/ryanair/i.test(carrier)) return ryanairUrl(from, to, out, back, a, c)
  if (/wizz/i.test(carrier)) return wizzUrl(from, to, out, back, a, c)
  return kayakUrl(from, to, out, back, a, c)
}

export interface BookingLink {
  label: string
  href: string
}

export function bookingLinks(t: Trip, s: FareSettings): BookingLink[] {
  const [a, b] = ends(t)
  const p = s.party[t.party]
  const links: BookingLink[] = []
  if (t.outCarrier === t.retCarrier && t.outCarrier !== 'Other') {
    links.push({ label: t.outCarrier, href: carrierUrl(t.outCarrier, a, b, t.outDate, t.retDate, p.adults, p.children) })
  } else {
    links.push({ label: `Oda: ${t.outCarrier}`, href: carrierUrl(t.outCarrier, a, b, t.outDate, null, p.adults, p.children) })
    links.push({ label: `Vissza: ${t.retCarrier}`, href: carrierUrl(t.retCarrier, b, a, t.retDate, null, p.adults, p.children) })
  }
  links.push({ label: 'Kayak: minden ár', href: kayakUrl(a, b, t.outDate, t.retDate, p.adults, p.children) })
  return links
}

// "BCN→BUD  P, dec. 4.  06:15 → 09:50  Ryanair"
export function legText(t: Trip, which: 'out' | 'ret'): string {
  const [a, b] = ends(t)
  const [from, to] = which === 'out' ? [a, b] : [b, a]
  const date = which === 'out' ? t.outDate : t.retDate
  const dep = which === 'out' ? t.outDep : t.retDep
  const arr = which === 'out' ? t.outArr : t.retArr
  const carrier = which === 'out' ? t.outCarrier : t.retCarrier
  const time = dep ? `${dep}${arr ? ' → ' + arr : ''}` : 'idő ismeretlen'
  return `${from}→${to} · ${fmtDay(date)} · ${time} · ${carrier}`
}

// --- The "log a trip" form's date checks --------------------------------------------------
export function checkTripDates(party: Party, out: string, ret: string, today: string, s: FareSettings): { ok: boolean; warnings: string[] } {
  if (!out || !ret) return { ok: true, warnings: [] }
  if (ret <= out) return { ok: false, warnings: ['A visszaút legyen az indulás után.'] }
  const W = windows(today, s)
  const msgs: string[] = []
  const probe = { id: '', party, outDate: out, retDate: ret } as Trip
  if (party === 'grandparents') {
    const LW = gpWeekends(today, shift(today, 330))
    if (daysBetween(out, ret) < GP_MIN_NIGHTS)
      msgs.push('Egy éjszakás látogatás: a nagyszülői utak (hosszú hétvége és mesterlövész) legalább 2 éjszakát várnak, ezért egyéb dátumként kerül a naplóba.')
    else if (!LW.some((l) => gpMatches(probe, l)) && !isWeekendTrip(probe))
      msgs.push('Ezek a dátumok nem illeszkednek se magyar hosszú hétvégéhez, se 2 éjszakás hétvégéhez; egyéb dátumként kerül a naplóba.')
  } else {
    const c = W.find((w) => w.key === 'summer')!.camp!
    const Y = c.start.slice(0, 4)
    if (out >= `${Y}-06-15` && out <= `${Y}-07-20` && !campOK(probe, c))
      msgs.push(`Nem illik a táborhoz (indulás ${fmtShort(c.latestOut)}-ig, haza V vagy H ${fmtShort(c.end)}-tól, legfeljebb 14 nap); sima útként kerül a naplóba.`)
    if (!workFriendly(probe, W)) msgs.push('Az egyik dátum munkanap.')
  }
  return { ok: true, warnings: msgs }
}

// --- Help that depends on today's date -----------------------------------------------------
export function upcomingHolidays(today: string, which: 'ES' | 'HU'): [string, string][] {
  const Y = +today.slice(0, 4)
  const horizon = shift(today, 300)
  const fn = which === 'ES' ? holidaysES : holidaysHU
  return [...Object.entries(fn(Y)), ...Object.entries(fn(Y + 1))].filter(([d]) => d >= today && d <= horizon).sort()
}
