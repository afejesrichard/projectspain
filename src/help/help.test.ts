import { describe, expect, it } from 'vitest'
import { appHelp } from './app'
import { budgetHelp } from './budget'
import { movingHelp } from './moving'
import { weekendHelp } from './weekend'
import { flightsHelp } from './flights'
import { resolveHelp, type HelpBlock, type HelpMap } from './types'
import { MODULES } from '../modules'

// Entries computed from live data get a synthetic sample.
const SAMPLE: Record<string, unknown> = {
  'flights.days': '2026-11-20',
  'flights.camp': {
    today: '2026-11-20',
    settings: {
      party: { family: { adults: 2, children: 1 }, grandparents: { adults: 2, children: 0 } },
      seeds_cents: { next4: 1, christmas: 1, easter: 1, summer: 1, gp_long_weekend: 1, gp_sniper: 1 },
    },
  },
}

const MAPS: Record<string, HelpMap> = { app: appHelp, budget: budgetHelp, moving: movingHelp, weekend: weekendHelp, flights: flightsHelp }

function blockText(b: HelpBlock): string {
  if (typeof b === 'string') return b
  if ('heading' in b) return b.heading
  return b.list.join(' ')
}

describe('help content', () => {
  for (const [name, map] of Object.entries(MAPS)) {
    it(`${name}: every entry has a title and non-empty body`, () => {
      for (const [id, src] of Object.entries(map)) {
        const e = resolveHelp(src, SAMPLE[id])
        expect(e.title.trim(), id).not.toBe('')
        expect(e.body.length, id).toBeGreaterThan(0)
        for (const b of e.body) expect(blockText(b).trim(), id).not.toBe('')
      }
    })
  }

  it('every module guide loads', async () => {
    for (const m of MODULES.filter((x) => x.guide)) {
      const g = await m.guide!()
      expect(g.title, m.id).toBeTruthy()
    }
  })

  // INVARIANT [PRIV-01] in spirit: help ships in a public repo.
  it('help text carries no addresses, amounts or phone numbers', () => {
    const all = Object.values(MAPS)
      .flatMap((m) => Object.entries(m).map(([id, s]) => resolveHelp(s, SAMPLE[id])))
      .flatMap((e) => e.body.map(blockText))
      .join('\n')
    expect(all).not.toMatch(/\b(carrer|calle|utca)\b/i)
    // Personal sums (pay, budget lines) run to three digits or more; generic
    // fees such as "4–10 euró" in the flight guide are fine.
    expect(all).not.toMatch(/\d{3,}[\d\s.,]*\s?(€|eur|ft|huf)/i)
    expect(all).not.toMatch(/\+?\d[\d\s-]{8,}\d/)
  })
})
