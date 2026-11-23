import { describe, expect, it } from 'vitest'
import {
  bookingLinks,
  camp,
  campOK,
  campReturns,
  checkTripDates,
  computeBoard,
  easter,
  gpWeekends,
  holidayES,
  isOff,
  longWeekends,
  tier,
  blend,
  totalCents,
  type FareSettings,
  type Trip,
} from './fares'

// Synthetic party and estimates: the real ones live in the database (PRIV-01).
const S: FareSettings = {
  party: { family: { adults: 2, children: 2 }, grandparents: { adults: 2, children: 0 } },
  seeds_cents: { next4: 40000, christmas: 70000, easter: 60000, summer: 80000, gp_long_weekend: 20000, gp_sniper: 20000 },
}

let seq = 0
function trip(p: Partial<Trip> & Pick<Trip, 'outDate' | 'retDate' | 'priceCents'>): Trip {
  return {
    id: `t${++seq}`,
    party: 'family',
    outDep: '',
    outArr: '',
    retDep: '',
    retArr: '',
    outCarrier: 'Ryanair',
    retCarrier: 'Ryanair',
    partyPriceCents: null,
    note: '',
    source: 'scan',
    foundAt: '2026-11-19T18:00:00Z',
    ...p,
  }
}

const NOW = Date.parse('2026-11-20T10:00:00Z')

describe('calendars', () => {
  it('computes Easter', () => {
    expect(easter(2026)).toBe('2026-04-05')
    expect(easter(2027)).toBe('2027-03-28')
    expect(easter(2030)).toBe('2030-04-21')
  })

  it('knows the family days off', () => {
    expect(isOff('2026-11-20')).toBe(true) // Friday
    expect(isOff('2026-11-24')).toBe(false) // Tuesday
    expect(isOff('2026-12-08')).toBe(true) // Inmaculada, a Tuesday
    expect(holidayES('2026-12-08')).toBe('Inmaculada Concepción')
    expect(holidayES('2027-03-26')).toBe('Viernes Santo')
    expect(isOff('2027-03-29')).toBe(true) // Easter Monday
  })

  it('finds the Hungarian long weekends the scan lists', () => {
    const lw = gpWeekends('2026-11-20', '2027-12-31').map((l) => `${l.start}/${l.end}`)
    expect(lw).toEqual(
      expect.arrayContaining([
        '2026-12-24/2026-12-27',
        '2027-01-01/2027-01-03',
        '2027-03-13/2027-03-15',
        '2027-03-26/2027-03-29',
        '2027-05-15/2027-05-17',
        '2027-08-20/2027-08-22',
        '2027-10-30/2027-11-01',
        '2027-12-24/2027-12-26',
      ]),
    )
  })

  it('merges a Tuesday holiday with its bridge Monday', () => {
    const [lw] = longWeekends('2026-12-01', '2026-12-10')
    // Inmaculada (Tue 8 Dec) bridges Mon 7 and merges with Sun 6 (Constitución)
    expect(lw.start).toBe('2026-12-05')
    expect(lw.end).toBe('2026-12-08')
    expect(lw.bridges).toEqual(['2026-12-07'])
  })
})

describe('camp rule', () => {
  const c = camp(2027)
  it('is the first full Monday-to-Sunday week of July', () => {
    expect(c.start).toBe('2027-07-05')
    expect(c.end).toBe('2027-07-11')
    expect(c.latestOut).toBe('2027-07-04')
  })

  it('returns on a Sunday or Monday from camp Sunday, within 14 days', () => {
    expect(campReturns(c)).toEqual(['2027-07-11', '2027-07-12', '2027-07-18'])
    expect(campOK({ outDate: '2027-07-04', retDate: '2027-07-18' }, c)).toBe(true)
    expect(campOK({ outDate: '2027-07-03', retDate: '2027-07-18' }, c)).toBe(false) // 15 days
    expect(campOK({ outDate: '2027-07-04', retDate: '2027-07-17' }, c)).toBe(false) // Saturday
    expect(campOK({ outDate: '2027-07-05', retDate: '2027-07-12' }, c)).toBe(false) // out too late
  })
})

describe('tiers and averages', () => {
  it('maps the drop against average to a tier', () => {
    expect(tier(null, false).key).toBe('none')
    expect(tier(-0.5, false).key).toBe('err')
    expect(tier(-0.3, false).key).toBe('strong')
    expect(tier(-0.1, false).key).toBe('below')
    expect(tier(0.05, false).key).toBe('flat')
    // the sniper waits for 25%
    expect(tier(-0.1, true).key).toBe('flat')
    expect(tier(-0.25, true).label).toBe('Mesterlövész: vedd')
  })

  it('blends the starting estimate until five trips', () => {
    expect(blend([100, 200], 1000, (x) => x).avg).toBe((1000 * 3 + 300) / 5)
    expect(blend([1, 2, 3, 4, 5], 1000, (x) => x).avg).toBe(3)
  })

  it('totals the party from the shown price, else times the party size', () => {
    expect(totalCents(trip({ outDate: '2026-12-04', retDate: '2026-12-06', priceCents: 5000 }), S)).toBe(20000)
    expect(totalCents(trip({ party: 'grandparents', outDate: '2026-12-04', retDate: '2026-12-06', priceCents: 5000 }), S)).toBe(10000)
    expect(totalCents(trip({ outDate: '2026-12-04', retDate: '2026-12-06', priceCents: 5000, partyPriceCents: 17000 }), S)).toBe(17000)
  })
})

describe('computeBoard', () => {
  it('flags a super deal: any weekday, 3+ weeks out, 35%+ under its window', () => {
    // A Tuesday-to-Thursday trip in February: normal dates, needs leave.
    const cheap = trip({ outDate: '2027-02-09', retDate: '2027-02-11', priceCents: 5000 })
    const b = computeBoard([cheap], [], S, '2026-11-20', NOW)
    // 4 x 50 = 200; the trip counts toward its own window's blend:
    // (400 * 4 + 200) / 5 = 360 → −44%
    expect(b.supers).toHaveLength(1)
    expect(b.supers[0].delta).toBeCloseTo(200 / 360 - 1)
    expect(b.supers[0].windowName).toBe('Normál dátumok')
    expect(b.alerts.map((a) => a.trip.id)).toContain(cheap.id)
  })

  it('takes weekday super deals from three weeks out, not sooner', () => {
    // Tue→Thu, today 20 Nov: 21 days out is 11 Dec
    const soon = trip({ outDate: '2026-12-08', retDate: '2026-12-10', priceCents: 5000 })
    const ok = trip({ outDate: '2026-12-15', retDate: '2026-12-17', priceCents: 5000 })
    const b = computeBoard([soon, ok], [], S, '2026-11-20', NOW)
    expect(b.superCutoff).toBe('2026-12-11')
    expect(b.supers.map((x) => x.trip.id)).toEqual([ok.id])
  })

  it('fires the family weekend sniper only at 25% under', () => {
    const sniper = (list: Trip[]) => computeBoard(list, [], S, '2026-11-20', NOW)
    // Fri→Sun in February, 4 x 80 = 320: avg (400*4 + 320)/5 = 384 → −16.7%: hold
    const b1 = sniper([trip({ outDate: '2027-02-12', retDate: '2027-02-14', priceCents: 8000 })])
    const r1 = b1.family.find((r) => r.key === 'fam-sniper')!
    expect(r1.sniper).toBe(true)
    expect(r1.tier.key).toBe('flat')
    expect(b1.alerts.some((a) => a.label === 'Hétvégi mesterlövész')).toBe(false)
    // 4 x 50 = 200: avg 360 → −44%
    const b2 = sniper([trip({ outDate: '2027-02-12', retDate: '2027-02-14', priceCents: 5000 })])
    expect(b2.family.find((r) => r.key === 'fam-sniper')!.tier.key).toBe('strong')
    expect(b2.alerts.some((a) => a.label === 'Hétvégi mesterlövész')).toBe(true)
  })

  it('keeps festive weekends and weekday trips out of the family sniper', () => {
    const wk = trip({ outDate: '2027-02-12', retDate: '2027-02-14', priceCents: 6000 })
    const thuMon = trip({ outDate: '2027-02-18', retDate: '2027-02-22', priceCents: 6000 })
    const xmas = trip({ outDate: '2026-12-18', retDate: '2026-12-20', priceCents: 6000 })
    const weekdays = trip({ outDate: '2027-02-09', retDate: '2027-02-11', priceCents: 6000 })
    const oneNight = trip({ outDate: '2027-02-13', retDate: '2027-02-14', priceCents: 6000 })
    const gp = trip({ party: 'grandparents', outDate: '2027-02-12', retDate: '2027-02-14', priceCents: 6000 })
    const row = computeBoard([wk, thuMon, xmas, weekdays, oneNight, gp], [], S, '2026-11-20', NOW).family.find((r) => r.key === 'fam-sniper')!
    expect(row.history.map((x) => x.id).sort()).toEqual([wk.id, thuMon.id].sort())
  })

  it('lists the other cheap weekends under the sniper, one per weekend', () => {
    const best = trip({ outDate: '2027-02-12', retDate: '2027-02-14', priceCents: 4000 })
    const sameWeekend = trip({ outDate: '2027-02-13', retDate: '2027-02-15', priceCents: 4500 })
    const second = trip({ outDate: '2027-03-05', retDate: '2027-03-07', priceCents: 5000 })
    const dear = trip({ outDate: '2027-04-16', retDate: '2027-04-18', priceCents: 20000 })
    const row = computeBoard([dear, second, sameWeekend, best], [], S, '2026-11-20', NOW).family.find((r) => r.key === 'fam-sniper')!
    expect(row.best?.id).toBe(best.id)
    expect(row.others!.map((o) => o.trip.id)).toEqual([second.id])
  })

  it('ignores trips not seen for a week or already departed', () => {
    const stale = trip({ outDate: '2026-12-11', retDate: '2026-12-13', priceCents: 1000, foundAt: '2026-11-01T00:00:00Z' })
    const gone = trip({ outDate: '2026-11-13', retDate: '2026-11-15', priceCents: 1000 })
    const b = computeBoard([stale, gone], [], S, '2026-11-20', NOW)
    expect(b.family.find((r) => r.key === 'next4')!.best).toBeNull()
    expect(b.dealCount).toBe(0)
  })

  it('prefers a trip on days off over a cheaper one that needs leave', () => {
    const weekday = trip({ outDate: '2026-12-01', retDate: '2026-12-03', priceCents: 3000 })
    const weekend = trip({ outDate: '2026-12-04', retDate: '2026-12-06', priceCents: 4000 })
    const row = computeBoard([weekday, weekend], [], S, '2026-11-20', NOW).family.find((r) => r.key === 'next4')!
    expect(row.best?.id).toBe(weekend.id)
  })

  it('fires the grandparents sniper only at 25% under', () => {
    const at20 = trip({ party: 'grandparents', outDate: '2027-02-12', retDate: '2027-02-14', priceCents: 8000 })
    const b1 = computeBoard([at20], [], S, '2026-11-20', NOW)
    // one weekend trip: avg = (200*4 + 160)/5 = 192 → −16.7%: hold
    expect(b1.grandparents[b1.grandparents.length - 1].tier.key).toBe('flat')
    const at40 = trip({ party: 'grandparents', outDate: '2027-02-12', retDate: '2027-02-14', priceCents: 6000 })
    const b2 = computeBoard([at40], [], S, '2026-11-20', NOW)
    expect(b2.grandparents[b2.grandparents.length - 1].tier.key).toBe('strong')
    expect(b2.alerts.some((a) => a.label === 'Hétvégi mesterlövész')).toBe(true)
  })

  it('counts only weekend visits of at least two nights for the sniper', () => {
    const fri = '2027-02-12'
    const t = (outDate: string, retDate: string) => trip({ party: 'grandparents', outDate, retDate, priceCents: 6000 })
    const sniperIds = (list: Trip[]) => computeBoard(list, [], S, '2026-11-20', NOW).grandparents.find((r) => r.sniper)!.history.map((x) => x.id)
    const ok = [t(fri, '2027-02-14'), t('2027-02-13', '2027-02-15'), t(fri, '2027-02-15'), t('2027-02-11', '2027-02-14'), t('2027-02-11', '2027-02-15')]
    const no = [t('2027-02-13', '2027-02-14'), t(fri, '2027-02-13'), t('2027-02-10', '2027-02-14'), t('2027-02-14', '2027-02-16')]
    expect(sniperIds([...ok, ...no]).sort()).toEqual(ok.map((x) => x.id).sort())
  })

  it('needs two nights on long weekends too', () => {
    // 13-15 Mar 2027 (Sat-Mon): Sat→Sun is one night, Sat→Mon and Fri→Sun count
    const t = (outDate: string, retDate: string) => trip({ party: 'grandparents', outDate, retDate, priceCents: 6000 })
    const row = (list: Trip[]) => computeBoard(list, [], S, '2026-11-20', NOW).grandparents.find((r) => r.key === 'lw-2027-03-13')!
    const oneNight = t('2027-03-13', '2027-03-14')
    expect(row([oneNight]).history).toEqual([])
    const ok = [t('2027-03-13', '2027-03-15'), t('2027-03-12', '2027-03-14')]
    expect(row([oneNight, ...ok]).history.map((x) => x.id).sort()).toEqual(ok.map((x) => x.id).sort())
  })

  it('holds grandparent visits to their flight times', () => {
    // 13-15 Mar 2027 (Sat-Mon). Friday evening in is ideal; Saturday must land by 12:30.
    const t = (outDate: string, outArr: string, retDate: string, retDep: string) =>
      trip({ party: 'grandparents', outDate, retDate, outArr, retDep, priceCents: 6000 })
    const row = (list: Trip[]) => computeBoard(list, [], S, '2026-11-20', NOW).grandparents.find((r) => r.key === 'lw-2027-03-13')!
    const friEvening = t('2027-03-12', '22:40', '2027-03-15', '18:50')
    const satMorning = t('2027-03-13', '11:35', '2027-03-15', '18:50')
    const satEvening = t('2027-03-13', '20:10', '2027-03-15', '18:50')
    const sunMorningHome = t('2027-03-12', '22:40', '2027-03-14', '11:40')
    const dawnHome = t('2027-03-12', '22:40', '2027-03-15', '05:55')
    const ids = row([friEvening, satMorning, satEvening, sunMorningHome, dawnHome]).history.map((x) => x.id).sort()
    expect(ids).toEqual([friEvening.id, satMorning.id].sort())
  })

  it('prefers the last day and an evening return over a cheaper earlier one', () => {
    const t = (retDate: string, retDep: string, priceCents: number) =>
      trip({ party: 'grandparents', outDate: '2027-03-12', outArr: '22:40', retDate, retDep, priceCents })
    const row = (list: Trip[]) => computeBoard(list, [], S, '2026-11-20', NOW).grandparents.find((r) => r.key === 'lw-2027-03-13')!
    const sunEvening = t('2027-03-14', '18:50', 4000)
    const monAfternoon = t('2027-03-15', '14:05', 5000)
    const monEvening = t('2027-03-15', '18:50', 7000)
    const all = row([sunEvening, monAfternoon, monEvening])
    expect(all.best?.id).toBe(monEvening.id)
    expect(all.caveat).toBeUndefined()
    const noEvening = row([sunEvening, monAfternoon])
    expect(noEvening.best?.id).toBe(monAfternoon.id)
    expect(noEvening.caveat).toBe('délutáni hazaút: rövid utolsó nap')
    expect(row([sunEvening]).caveat).toBe('nem az utolsó napon indul haza')
  })

  it('applies the same times to the grandparents sniper', () => {
    const t = (outDate: string, outArr: string, retDate: string, retDep: string) =>
      trip({ party: 'grandparents', outDate, retDate, outArr, retDep, priceCents: 6000 })
    const friSun = t('2027-02-12', '22:40', '2027-02-14', '18:50')
    const satLate = t('2027-02-13', '20:10', '2027-02-15', '18:50')
    const dawn = t('2027-02-12', '22:40', '2027-02-14', '06:10')
    const row = computeBoard([friSun, satLate, dawn], [], S, '2026-11-20', NOW).grandparents.find((r) => r.sniper)!
    expect(row.history.map((x) => x.id)).toEqual([friSun.id])
  })

  it('drops family trips over 16 days', () => {
    const long = trip({ outDate: '2026-12-18', retDate: '2027-01-06', priceCents: 1000 })
    const b = computeBoard([long], [], S, '2026-11-20', NOW)
    expect(b.family.find((r) => r.key === 'christmas')!.best).toBeNull()
  })
})

describe('booking links', () => {
  it('fills in route, dates and the party', () => {
    const t = trip({ outDate: '2026-12-04', retDate: '2026-12-06', priceCents: 5000 })
    const [ryanair, kayak] = bookingLinks(t, S)
    expect(ryanair.href).toContain('originIata=BCN')
    expect(ryanair.href).toContain('adults=2')
    expect(ryanair.href).toContain('children=2')
    expect(ryanair.href).toContain('dateIn=2026-12-06')
    expect(kayak.label).toBe('Kayak: minden ár')
    expect(kayak.href).toBe('https://www.kayak.com/flights/BCN-BUD/2026-12-04/2026-12-06/2adults/children-5-5?sort=price_a&fs=stops=0')
  })

  it('splits mixed carriers into two one-way links', () => {
    const t = trip({ party: 'grandparents', outDate: '2026-12-04', retDate: '2026-12-06', priceCents: 5000, retCarrier: 'Wizz Air' })
    const links = bookingLinks(t, S)
    expect(links).toHaveLength(3)
    expect(links[1].href).toBe('https://wizzair.com/en-gb/booking/select-flight/BCN/BUD/2026-12-06/null/2/0/0/null')
    // grandparents: no children segment
    expect(links[2].href).toBe('https://www.kayak.com/flights/BUD-BCN/2026-12-04/2026-12-06/2adults?sort=price_a&fs=stops=0')
  })
})

describe('log form checks', () => {
  it('rejects a return before the outbound and warns about weekdays', () => {
    expect(checkTripDates('family', '2026-12-06', '2026-12-04', '2026-11-20', S).ok).toBe(false)
    expect(checkTripDates('family', '2026-12-01', '2026-12-03', '2026-11-20', S).warnings).toContain('Az egyik dátum munkanap.')
    expect(checkTripDates('family', '2026-12-04', '2026-12-06', '2026-11-20', S).warnings).toEqual([])
    // grandparents: a one-night weekend hop is called out; Sat→Mon is fine
    expect(checkTripDates('grandparents', '2027-02-13', '2027-02-14', '2026-11-20', S).warnings[0]).toContain('legalább 2 éjszakát')
    expect(checkTripDates('grandparents', '2027-03-13', '2027-03-14', '2026-11-20', S).warnings[0]).toContain('legalább 2 éjszakát')
    expect(checkTripDates('grandparents', '2027-03-13', '2027-03-15', '2026-11-20', S).warnings).toEqual([])
    expect(checkTripDates('grandparents', '2027-02-13', '2027-02-15', '2026-11-20', S).warnings).toEqual([])
  })
})
