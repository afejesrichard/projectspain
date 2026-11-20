import { describe, expect, it } from 'vitest'
import { directionsUrl, fmtKm, fmtWeekend, readFilters, safeLink, splitItems, type WeekendItem } from './weekend'

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
