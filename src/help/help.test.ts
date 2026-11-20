import { describe, expect, it } from 'vitest'
import { appHelp } from './app'
import { budgetHelp } from './budget'
import { movingHelp } from './moving'
import { weekendHelp } from './weekend'
import { resolveHelp, type HelpBlock, type HelpMap } from './types'
import { MODULES } from '../modules'

const MAPS: Record<string, HelpMap> = { app: appHelp, budget: budgetHelp, moving: movingHelp, weekend: weekendHelp }

function blockText(b: HelpBlock): string {
  if (typeof b === 'string') return b
  if ('heading' in b) return b.heading
  return b.list.join(' ')
}

describe('help content', () => {
  for (const [name, map] of Object.entries(MAPS)) {
    it(`${name}: every entry has a title and non-empty body`, () => {
      for (const [id, src] of Object.entries(map)) {
        const e = resolveHelp(src)
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
      .flatMap((m) => Object.values(m).map((s) => resolveHelp(s)))
      .flatMap((e) => e.body.map(blockText))
      .join('\n')
    expect(all).not.toMatch(/\b(carrer|calle|utca)\b/i)
    expect(all).not.toMatch(/\d[\d\s.,]*\s?(€|eur|ft|huf)\b/i)
    expect(all).not.toMatch(/\+?\d[\d\s-]{8,}\d/)
  })
})
