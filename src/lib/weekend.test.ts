import { describe, expect, it } from 'vitest'
import { directionsUrl, fmtDayLabel, fmtStamp, fmtTemps, liveWeather, otherNotes, type WeatherOutlook, fmtKm, fmtWeekend, readFilters, safeLink, splitItems, type WeekendItem } from './weekend'

const item = (p: Partial<WeekendItem> & Pick<WeekendItem, 'name'>): WeekendItem => ({
  type: 'free',
  zone: 'city',
  km: 1,
  days: ['Sat'],
  link: 'https://example.org',
  maps: 'Example',
  ...p,
})

describe('splitItems', () => {
  const items = [
    item({ name: 'far free trip', zone: 'trip', km: 80, days: ['Sat', 'Sun'] }),
    item({ name: 'near free', km: 2, days: ['Fri', 'Sat', 'Sun'] }),
    item({ name: 'paid sunday', type: 'paid', km: 4, days: ['Sun'] }),
    item({ name: 'paid near', type: 'paid', km: 3, days: ['Sat'] }),
  ]

  it('splits free and paid, closest first', () => {
    const r = splitItems(items, { day: 'all', zone: 'all' })
    expect(r.free.map((i) => i.name)).toEqual(['near free', 'far free trip'])
    expect(r.paid.map((i) => i.name)).toEqual(['paid near', 'paid sunday'])
  })

  it('filters by day and zone together', () => {
    const r = splitItems(items, { day: 'Sun', zone: 'city' })
    expect(r.free.map((i) => i.name)).toEqual(['near free'])
    expect(r.paid.map((i) => i.name)).toEqual(['paid sunday'])
    expect(splitItems(items, { day: 'Fri', zone: 'trip' }).free).toEqual([])
  })
})

describe('formatting', () => {
  it('shows tenths under 10 km', () => {
    expect(fmtKm(1.7)).toBe('1,7')
    expect(fmtKm(52)).toBe('52')
    expect(fmtKm(108.4)).toBe('108')
  })

  it('formats a weekend within and across months', () => {
    expect(fmtWeekend('2030-11-15', '2030-11-17')).toBe('nov. 15–17.')
    expect(fmtWeekend('2030-11-29', '2030-12-01')).toMatch(/^nov\. 29\. – dec\. 1\.$/)
  })
})

describe('links', () => {
  it('builds directions with and without a home address', () => {
    expect(directionsUrl('Plaça X', 'Home St 1')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Pla%C3%A7a+X&origin=Home+St+1',
    )
    expect(directionsUrl('Plaça X', null)).not.toContain('origin')
  })

  it('opens only http and https links', () => {
    expect(safeLink('https://a.b/c')).toBe('https://a.b/c')
    expect(safeLink('javascript:alert(1)')).toBeNull()
    expect(safeLink('data:text/html,x')).toBeNull()
  })
})

describe('readFilters', () => {
  it('falls back on anything unexpected', () => {
    expect(readFilters(null)).toEqual({ day: 'all', zone: 'all' })
    expect(readFilters('{"day":"Sat","zone":"trip"}')).toEqual({ day: 'Sat', zone: 'trip' })
    expect(readFilters('{"day":"Mon","zone":"moon"}')).toEqual({ day: 'all', zone: 'all' })
    expect(readFilters('not json')).toEqual({ day: 'all', zone: 'all' })
  })
})

describe('daily weather outlook', () => {
  const outlook: WeatherOutlook = {
    checked_at: '2026-11-22T06:43:00Z',
    status: 'warn',
    title: 'Wind warning today',
    days: [
      { date: '2026-11-22', level: 'warn', summary: 'Windy', tmin: 9.4, tmax: 16.6 },
      { date: '2026-11-23', level: 'ok', summary: 'Calm', tmax: 17 },
      { date: '2026-11-24', level: 'ok', summary: 'Showers late' },
    ],
    alerts: [],
  }

  it('shows the outlook as saved on the day it was checked', () => {
    expect(liveWeather(outlook, '2026-11-22')).toEqual(outlook)
  })

  it('drops days already past, and a warning that went with them', () => {
    const w = liveWeather(outlook, '2026-11-23')
    expect(w?.days.map((d) => d.date)).toEqual(['2026-11-23', '2026-11-24'])
    expect(w?.status).toBe('ok')
  })

  it('is not shown once every day has gone by, or when missing', () => {
    expect(liveWeather(outlook, '2026-11-25')).toBeNull()
    expect(liveWeather(null, '2026-11-22')).toBeNull()
  })

  it('keeps only the weekly notes that are not about weather', () => {
    const notes = otherNotes([
      { level: 'ok', tag: 'Weather', text: 'Sunny' },
      { level: 'info', tag: 'Ended', text: 'Old warning' },
      { level: 'warn', tag: 'Warning', text: 'Wind' },
      { level: 'info', tag: 'Heads-up', text: 'Lights switch on' },
    ])
    expect(notes.map((n) => n.text)).toEqual(['Lights switch on'])
  })

  it('labels days and temperatures', () => {
    expect(fmtDayLabel('2026-11-22', '2026-11-22')).toBe('ma')
    expect(fmtDayLabel('2026-11-23', '2026-11-22')).toBe('holnap')
    expect(fmtDayLabel('2026-11-24', '2026-11-22')).toMatch(/^K\S* 24\.$/)
    expect(fmtTemps(outlook.days[0])).toBe('9–17°')
    expect(fmtTemps(outlook.days[1])).toBe('17°')
    expect(fmtTemps(outlook.days[2])).toBeNull()
  })

  it('formats the check time in Barcelona time', () => {
    expect(fmtStamp('2026-11-22T06:43:00Z')).toMatch(/nov\. 22\..*7:43/)
  })
})
