import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildExportXml,
  extractReceiptRanges,
  formatCents,
  parseCents,
  parseExpensesFile,
} from './expenses'

// vitest runs with the project root as cwd (see vitest.config.ts).
const fixture = readFileSync(
  resolve(process.cwd(), 'fixtures/expenses/expenses_20260830_lidl.xml'),
  'utf8',
)

function wrap(receipts: string, attrs = 'version="1" currency="EUR"'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<expenses ${attrs}>\n${receipts}\n</expenses>\n`
}

const MINIMAL = `  <receipt id="20260830-bar-01" source="text" confidence="medium">
    <merchant><name>Bar Marina</name></merchant>
    <datetime source="user" precision="day">2026-08-30</datetime>
    <items>
      <item n="1" category="eating-out">
        <name lang="en">2 coffees</name>
        <gross>7.40</gross>
        <net>7.40</net>
      </item>
    </items>
    <totals><total>7.40</total><paid>7.40</paid></totals>
  </receipt>`

describe('parseCents / formatCents', () => {
  it('parses two-decimal amounts as integer cents', () => {
    expect(parseCents('41.23')).toBe(4123)
    expect(parseCents('0.99')).toBe(99)
    expect(parseCents('-3.05')).toBe(-305)
    expect(formatCents(4123)).toBe('41.23')
    expect(formatCents(-305)).toBe('-3.05')
  })
  it('rejects anything not matching ^-?\\d+\\.\\d{2}$', () => {
    for (const bad of ['41.2', '41.234', '41', '41,23', ' 41.23', '41.23 ', '4 1.23', 'abc', '']) {
      expect(parseCents(bad)).toBeNull()
    }
  })
})

describe('parseExpensesFile — happy path (Appendix B fixture)', () => {
  it('accepts the Lidl fixture and indexes it correctly', () => {
    const res = parseExpensesFile(fixture)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.receipts).toHaveLength(1)
    const r = res.receipts[0]
    expect(r.status).toBe('valid')
    if (r.status !== 'valid') return
    expect(r.record.id).toBe('20260830-lidl-01')
    expect(r.record.datetime).toBe('2026-08-30T18:01:53+02:00')
    expect(r.record.localDate).toBe('2026-08-30')
    expect(r.record.totalCents).toBe(4123)
    expect(r.record.currency).toBe('EUR')
    expect(r.record.merchantName).toBe('Lidl')
    expect(r.record.chain).toBe('lidl')
    expect(r.record.nif).toBe('A60195278')
    expect(r.record.receiptNumber).toBe('034778670')
    expect(r.record.source).toBe('photo')
    expect(r.record.confidence).toBe('high')
    expect(r.record.itemCount).toBe(12)
    expect(r.record.warnings).toEqual([])
    expect(r.record.searchText).toContain('lidl')
    expect(r.record.searchText).toContain('electric kettle')
  })

  it('stores the <receipt> element byte-for-byte as it appears in the file', () => {
    const res = parseExpensesFile(fixture)
    if (!res.ok || res.receipts[0].status !== 'valid') throw new Error('fixture must parse')
    const raw = res.receipts[0].record.rawXml
    const start = fixture.indexOf('<receipt id=')
    const end = fixture.indexOf('</receipt>') + '</receipt>'.length
    expect(raw).toBe(fixture.slice(start, end))
  })
})

describe('parseExpensesFile — blocking structural failures', () => {
  it('rejects malformed XML (truncated closing tag)', () => {
    const res = parseExpensesFile(fixture.replace('</expenses>', '</expense'))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('malformed')
  })

  it('rejects a wrong root element', () => {
    const res = parseExpensesFile('<?xml version="1.0"?><costs version="1"><receipt/></costs>')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('wrong-root')
  })

  it('rejects version="2"', () => {
    const res = parseExpensesFile(fixture.replace('version="1"', 'version="2"'))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('bad-version')
  })

  it('rejects a DOCTYPE outright', () => {
    const res = parseExpensesFile('<!DOCTYPE expenses [<!ENTITY x "y">]>' + wrap(MINIMAL))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('doctype')
  })

  it('rejects files above 5 MB', () => {
    const big = wrap(MINIMAL).replace('</expenses>', '<!--' + 'x'.repeat(5 * 1024 * 1024) + '--></expenses>')
    const res = parseExpensesFile(big)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('too-large')
  })

  it('flags a receipt with a missing totals/total', () => {
    const res = parseExpensesFile(wrap(MINIMAL.replace('<total>7.40</total>', '')))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.receipts[0].status).toBe('invalid')
    if (res.receipts[0].status !== 'invalid') return
    expect(res.receipts[0].errors.map((e) => e.code)).toContain('missing-total')
  })

  it('flags an unknown item category', () => {
    const res = parseExpensesFile(wrap(MINIMAL.replace('category="eating-out"', 'category="snacks"')))
    if (!res.ok) throw new Error('file should parse')
    expect(res.receipts[0].status).toBe('invalid')
    if (res.receipts[0].status !== 'invalid') return
    expect(res.receipts[0].errors.map((e) => e.code)).toContain('bad-category')
  })

  it('flags an invalid amount format', () => {
    const res = parseExpensesFile(wrap(MINIMAL.replace('<gross>7.40</gross>', '<gross>7.4</gross>')))
    if (!res.ok) throw new Error('file should parse')
    expect(res.receipts[0].status).toBe('invalid')
    if (res.receipts[0].status !== 'invalid') return
    expect(res.receipts[0].errors.map((e) => e.code)).toContain('bad-amount')
  })

  it('accepts a date-only datetime with precision="day" and derives local_date', () => {
    const res = parseExpensesFile(wrap(MINIMAL))
    if (!res.ok) throw new Error('file should parse')
    expect(res.receipts[0].status).toBe('valid')
    if (res.receipts[0].status !== 'valid') return
    expect(res.receipts[0].record.localDate).toBe('2026-08-30')
  })

  it('rejects a date-only datetime without precision="day"', () => {
    const res = parseExpensesFile(wrap(MINIMAL.replace(' precision="day"', '')))
    if (!res.ok) throw new Error('file should parse')
    expect(res.receipts[0].status).toBe('invalid')
    if (res.receipts[0].status !== 'invalid') return
    expect(res.receipts[0].errors.map((e) => e.code)).toContain('bad-datetime')
  })
})

describe('parseExpensesFile — arithmetic warnings (import-anyway overridable)', () => {
  it('warns when item net ≠ gross − discounts', () => {
    const res = parseExpensesFile(wrap(MINIMAL.replace('<net>7.40</net>', '<net>7.30</net>')))
    if (!res.ok) throw new Error('file should parse')
    expect(res.receipts[0].status).toBe('valid')
    if (res.receipts[0].status !== 'valid') return
    const codes = res.receipts[0].record.warnings.map((w) => w.code)
    expect(codes).toContain('item-net-mismatch')
  })

  it('warns when totals/total ≠ sum of item nets, quoting the difference', () => {
    const res = parseExpensesFile(fixture.replace('<total>41.23</total>', '<total>41.24</total>'))
    if (!res.ok) throw new Error('file should parse')
    expect(res.receipts[0].status).toBe('valid')
    if (res.receipts[0].status !== 'valid') return
    const w = res.receipts[0].record.warnings.find((x) => x.code === 'total-mismatch')
    expect(w).toBeDefined()
    expect(w!.message).toContain('0.01')
  })

  it('flags a one-cent total discrepancy (2-decimal inputs make 0.01 a mismatch)', () => {
    const res = parseExpensesFile(wrap(MINIMAL.replace('<net>7.40</net>', '<net>7.39</net>').replace('<gross>7.40</gross>', '<gross>7.39</gross>')))
    if (!res.ok) throw new Error('file should parse')
    if (res.receipts[0].status !== 'valid') throw new Error('should be valid')
    expect(res.receipts[0].record.warnings.map((w) => w.code)).toContain('total-mismatch')
  })

  it('warns when a by-vat class does not match the per-letter net sum', () => {
    const res = parseExpensesFile(fixture.replace('>7.21</class>', '>7.31</class>'))
    if (!res.ok) throw new Error('file should parse')
    if (res.receipts[0].status !== 'valid') throw new Error('should be valid')
    const w = res.receipts[0].record.warnings.find((x) => x.code === 'by-vat-mismatch')
    expect(w).toBeDefined()
    expect(w!.message).toContain('A')
  })

  it('surfaces a declared reconciliation mismatch as a warning', () => {
    const res = parseExpensesFile(fixture.replace('status="ok"', 'status="mismatch"'))
    if (!res.ok) throw new Error('file should parse')
    if (res.receipts[0].status !== 'valid') throw new Error('should be valid')
    expect(res.receipts[0].record.warnings.map((w) => w.code)).toContain('reconciliation-mismatch')
  })
})

describe('parseExpensesFile — multi-receipt and duplicates', () => {
  it('processes each receipt independently: one bad receipt does not sink the file', () => {
    const bad = MINIMAL.replace('20260830-bar-01', '20260830-bad-01').replace('category="eating-out"', 'category="nope"')
    const res = parseExpensesFile(wrap(MINIMAL + '\n' + bad))
    if (!res.ok) throw new Error('file should parse')
    expect(res.receipts).toHaveLength(2)
    expect(res.receipts[0].status).toBe('valid')
    expect(res.receipts[1].status).toBe('invalid')
  })

  it('rejects a duplicate id within the same file', () => {
    const res = parseExpensesFile(wrap(MINIMAL + '\n' + MINIMAL))
    if (!res.ok) throw new Error('file should parse')
    expect(res.receipts[0].status).toBe('valid')
    expect(res.receipts[1].status).toBe('invalid')
    if (res.receipts[1].status !== 'invalid') return
    expect(res.receipts[1].errors.map((e) => e.code)).toContain('duplicate-id')
  })

  it('rejects an id that already exists in the store', () => {
    const res = parseExpensesFile(fixture, { existingIds: new Set(['20260830-lidl-01']) })
    if (!res.ok) throw new Error('file should parse')
    expect(res.receipts[0].status).toBe('invalid')
    if (res.receipts[0].status !== 'invalid') return
    expect(res.receipts[0].errors.map((e) => e.code)).toContain('duplicate-id')
  })
})

describe('parseExpensesFile — currency', () => {
  it('uses a receipt-level currency override when present', () => {
    const res = parseExpensesFile(wrap(MINIMAL.replace('source="text"', 'source="text" currency="HUF"')))
    if (!res.ok) throw new Error('file should parse')
    if (res.receipts[0].status !== 'valid') throw new Error('should be valid')
    expect(res.receipts[0].record.currency).toBe('HUF')
  })

  it('inherits the container currency when the receipt has none', () => {
    const res = parseExpensesFile(wrap(MINIMAL))
    if (!res.ok) throw new Error('file should parse')
    if (res.receipts[0].status !== 'valid') throw new Error('should be valid')
    expect(res.receipts[0].record.currency).toBe('EUR')
  })

  it('rejects a non-EUR container currency without a receipt-level override (not re-emittable)', () => {
    const res = parseExpensesFile(wrap(MINIMAL, 'version="1" currency="HUF"'))
    if (!res.ok) throw new Error('file should parse')
    expect(res.receipts[0].status).toBe('invalid')
    if (res.receipts[0].status !== 'invalid') return
    expect(res.receipts[0].errors.map((e) => e.code)).toContain('currency-unrepresentable')
  })
})

describe('parseExpensesFile — v1 revision additions (31 Aug 2026), all optional', () => {
  it('accepts a weighed line: qty/@unit with printed decimals and per-unit price', () => {
    const weighed = MINIMAL.replace(
      '<name lang="en">2 coffees</name>',
      '<name lang="en">Manchego wedge</name>\n        <qty unit="kg">0.350</qty>\n        <unit-price>21.14</unit-price>',
    )
    const res = parseExpensesFile(wrap(weighed))
    if (!res.ok) throw new Error('file should parse')
    expect(res.receipts[0].status).toBe('valid')
    if (res.receipts[0].status !== 'valid') return
    expect(res.receipts[0].record.warnings).toEqual([])
  })

  // [EXP-05] regression guard: a rewrite once again treating @type as a closed
  // enum would fail here.
  it('accepts open-set reference types and still indexes the receipt-number', () => {
    const withRefs = MINIMAL.replace(
      '<items>',
      '<reference type="booking-id">BK-9981</reference>\n    <reference type="partner-reference">GYG-4471</reference>\n    <reference type="receipt-number">034778670</reference>\n    <items>',
    )
    const res = parseExpensesFile(wrap(withRefs))
    if (!res.ok) throw new Error('file should parse')
    expect(res.receipts[0].status).toBe('valid')
    if (res.receipts[0].status !== 'valid') return
    expect(res.receipts[0].record.receiptNumber).toBe('034778670')
  })
})

// [EXP-05] Canonical state-fee example (spec revision 1 Sep 2026): no merchant
// nif, no item @vat, no by-vat block, cash tender, reference type="nrc".
// Before this fixture existed, nothing exercised a receipt where the nullable
// duplicate-detection keys (nif, receipt-number) are BOTH absent.
describe('parseExpensesFile — state fee (tasa 790, 1 Sep 2026 revision)', () => {
  const tasa = readFileSync(
    resolve(process.cwd(), 'fixtures/expenses/expenses_20260901_tasa790.xml'),
    'utf8',
  )

  it('imports the tasa 790 fixture with zero warnings', () => {
    const res = parseExpensesFile(tasa)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.receipts).toHaveLength(1)
    const r = res.receipts[0]
    expect(r.status).toBe('valid')
    if (r.status !== 'valid') return
    expect(r.record.id).toBe('20260901-policia-01')
    expect(r.record.localDate).toBe('2026-09-01')
    expect(r.record.totalCents).toBe(1608)
    expect(r.record.warnings).toEqual([])
    // CONTRACT [EXP-05]: no nif and no receipt-number — the nrc reference must
    // NOT be indexed as a receipt-number, so the nif + receipt-number duplicate
    // rule cannot fire on it.
    expect(r.record.nif).toBeNull()
    expect(r.record.receiptNumber).toBeNull()
  })

  it('stores and re-exports the nrc reference element byte-for-byte', () => {
    const res = parseExpensesFile(tasa)
    if (!res.ok || res.receipts[0].status !== 'valid') throw new Error('fixture must parse')
    const rec = res.receipts[0].record
    // INVARIANT [EXP-05]: reference/@type is an open set — an unknown-to-the-
    // 31-Aug-spec value like "nrc" is stored and re-emitted exactly as
    // received (EXP-01), never normalised, lowercased, remapped or dropped.
    const refLine = '<reference type="nrc">7900125841833JEQDL8CAP</reference>'
    expect(rec.rawXml).toContain(refLine)
    const xml = buildExportXml({
      from: '2026-09-01',
      to: '2026-09-01',
      generated: '2026-09-01T12:00:00+02:00',
      generator: 'project-spain/0.1.0',
      receipts: [rec],
    })
    expect(xml).toContain(refLine)
    expect(xml).toContain(rec.rawXml)
  })

  it('still rejects a second import of the same @id (the only applicable duplicate rule)', () => {
    const res = parseExpensesFile(tasa, { existingIds: new Set(['20260901-policia-01']) })
    if (!res.ok) throw new Error('file should parse')
    expect(res.receipts[0].status).toBe('invalid')
    if (res.receipts[0].status !== 'invalid') return
    expect(res.receipts[0].errors.map((e) => e.code)).toContain('duplicate-id')
  })
})

describe('extractReceiptRanges', () => {
  it('is not fooled by comments mentioning <receipt>', () => {
    const text = wrap('<!-- a <receipt> in a comment -->\n' + MINIMAL)
    const ranges = extractReceiptRanges(text)
    expect(ranges).toHaveLength(1)
    expect(text.slice(ranges[0].start, ranges[0].end).startsWith('<receipt id="20260830-bar-01"')).toBe(true)
  })

  it('handles attribute values containing ">"', () => {
    const tricky = MINIMAL.replace('<name>Bar Marina</name>', '<name detail="a>b">Bar Marina</name>')
    const ranges = extractReceiptRanges(wrap(tricky))
    expect(ranges).toHaveLength(1)
  })
})

describe('buildExportXml — round-trip contract', () => {
  it('re-emits stored receipt elements byte-identically, ordered by datetime ascending', () => {
    const res = parseExpensesFile(fixture)
    if (!res.ok || res.receipts[0].status !== 'valid') throw new Error('fixture must parse')
    const rec = res.receipts[0].record
    const xml = buildExportXml({
      from: '2026-08-01',
      to: '2026-08-31',
      generated: '2026-08-30T20:00:00+02:00',
      generator: 'project-spain/0.1.0',
      receipts: [rec],
    })
    expect(xml).toContain('<period from="2026-08-01" to="2026-08-31"/>')
    expect(xml).toContain(rec.rawXml)

    // Re-importing the export must reject every receipt as a duplicate id.
    const back = parseExpensesFile(xml, { existingIds: new Set([rec.id]) })
    if (!back.ok) throw new Error('export should parse')
    expect(back.receipts[0].status).toBe('invalid')
    if (back.receipts[0].status !== 'invalid') return
    expect(back.receipts[0].errors.map((e) => e.code)).toContain('duplicate-id')

    // And without the store, the re-imported element is byte-identical.
    const again = parseExpensesFile(xml)
    if (!again.ok || again.receipts[0].status !== 'valid') throw new Error('export should re-parse')
    expect(again.receipts[0].record.rawXml).toBe(rec.rawXml)
  })

  it('orders receipts by datetime ascending', () => {
    const a = { rawXml: '<receipt id="a"/>', datetime: '2026-08-30T18:00:00+02:00' }
    const b = { rawXml: '<receipt id="b"/>', datetime: '2026-08-02' }
    const xml = buildExportXml({
      from: '2026-08-01',
      to: '2026-08-31',
      generated: '2026-08-30',
      generator: 'test',
      receipts: [a, b],
    })
    expect(xml.indexOf('id="b"')).toBeLessThan(xml.indexOf('id="a"'))
  })
})
