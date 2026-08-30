// Kiadások (Expenses) — XML import/export core.
// Store-and-forward for receipt data: the app validates, stores and re-emits
// the interchange format described in docs/expenses-format.md. All analysis
// happens outside the app, on the exported file.

export const MAX_FILE_BYTES = 5 * 1024 * 1024

// Closed category list from the format spec, v1.
export const CATEGORIES = [
  'food',
  'alcohol',
  'household',
  'home-setup',
  'kids',
  'health',
  'transport',
  'eating-out',
  'leisure',
  'housing',
  'admin',
  'other',
] as const

export type ReceiptSource = 'photo' | 'text' | 'manual'
export type ReceiptConfidence = 'high' | 'medium' | 'low'

const SOURCES: ReceiptSource[] = ['photo', 'text', 'manual']
const CONFIDENCES: ReceiptConfidence[] = ['high', 'medium', 'low']

export interface Problem {
  code: string
  message: string
}

// Indexed fields extracted at import, stored alongside the untouched element
// text. Everything needed by the list/filter/export UI without re-parsing XML.
export interface ReceiptRecord {
  id: string
  rawXml: string // the <receipt> element exactly as it appeared in the file
  datetime: string // as given in the file
  localDate: string // YYYY-MM-DD in the receipt's own offset
  merchantName: string
  chain: string | null
  nif: string | null
  receiptNumber: string | null
  totalCents: number
  currency: string
  source: ReceiptSource
  confidence: ReceiptConfidence
  itemCount: number
  searchText: string
  warnings: Problem[]
}

export type ParsedReceipt =
  | { status: 'valid'; index: number; id: string | null; record: ReceiptRecord }
  | { status: 'invalid'; index: number; id: string | null; errors: Problem[] }

export type ParseFileResult =
  | { ok: true; receipts: ParsedReceipt[] }
  | { ok: false; error: Problem }

// --- Money ------------------------------------------------------------------
// INVARIANT [EXP-04]: money is never stored or compared as a float. Amounts are
// parsed from their 2-decimal string form into integer cents with string/int
// arithmetic only; every tolerance check below compares integer cents.
// Floats silently corrupt sums (0.1+0.2), and a receipt store must add up.
// Must survive rewrites.
const AMOUNT_RE = /^-?\d+\.\d{2}$/

export function parseCents(s: string): number | null {
  if (!AMOUNT_RE.test(s)) return null
  const neg = s.startsWith('-')
  const [whole, frac] = (neg ? s.slice(1) : s).split('.')
  const cents = parseInt(whole, 10) * 100 + parseInt(frac, 10)
  return neg ? -cents : cents
}

export function formatCents(cents: number): string {
  const neg = cents < 0
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  return `${neg ? '-' : ''}${whole}.${frac}`
}

// --- Dates ------------------------------------------------------------------
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)$/
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

// INVARIANT [EXP-03]: the calendar date used for range filtering is taken from
// the receipt's own offset — the first ten characters of the ISO string ARE the
// local calendar date, no UTC conversion ever happens. A receipt stamped
// 23:30+02:00 belongs to that evening's day, not to the UTC day.
// Must survive rewrites.
export function localDateOf(datetime: string): string {
  return datetime.slice(0, 10)
}

// --- Raw element extraction -------------------------------------------------
// INVARIANT [EXP-01]: the app never alters receipt content. Storage keeps the
// original element text sliced straight out of the uploaded file — the DOM is
// used for validation only and is never re-serialised, because no parser is
// trusted to round-trip byte-for-byte (attribute order, whitespace, entities).
// Must survive rewrites.
//
// The scanner walks the raw text, skipping comments, CDATA, processing
// instructions and quoted attribute values, and records the exact character
// range of every top-level <receipt>…</receipt> element.
export function extractReceiptRanges(xml: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = []
  let i = 0
  let depth = 0
  let start = -1
  while (i < xml.length) {
    const lt = xml.indexOf('<', i)
    if (lt === -1) break
    if (xml.startsWith('<!--', lt)) {
      const e = xml.indexOf('-->', lt + 4)
      i = e === -1 ? xml.length : e + 3
      continue
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const e = xml.indexOf(']]>', lt + 9)
      i = e === -1 ? xml.length : e + 3
      continue
    }
    if (xml.startsWith('<?', lt)) {
      const e = xml.indexOf('?>', lt + 2)
      i = e === -1 ? xml.length : e + 2
      continue
    }
    if (xml.startsWith('<!', lt)) {
      const e = xml.indexOf('>', lt + 2)
      i = e === -1 ? xml.length : e + 1
      continue
    }
    const tag = readTag(xml, lt)
    if (!tag) break
    if (tag.name === 'receipt') {
      if (!tag.closing) {
        if (depth === 0) start = lt
        if (tag.selfClosing) {
          if (depth === 0) ranges.push({ start: lt, end: tag.end + 1 })
        } else {
          depth++
        }
      } else {
        depth--
        if (depth === 0 && start !== -1) {
          ranges.push({ start, end: tag.end + 1 })
          start = -1
        }
      }
    }
    i = tag.end + 1
  }
  return ranges
}

function readTag(
  xml: string,
  lt: number,
): { end: number; name: string; closing: boolean; selfClosing: boolean } | null {
  let j = lt + 1
  let closing = false
  if (xml[j] === '/') {
    closing = true
    j++
  }
  const nameStart = j
  while (j < xml.length && !/[\s/>]/.test(xml[j])) j++
  const name = xml.slice(nameStart, j)
  let quote: string | null = null
  while (j < xml.length) {
    const c = xml[j]
    if (quote) {
      if (c === quote) quote = null
    } else if (c === '"' || c === "'") {
      quote = c
    } else if (c === '>') {
      return { end: j, name, closing, selfClosing: xml[j - 1] === '/' }
    }
    j++
  }
  return null
}

// --- Small DOM helpers ------------------------------------------------------
function childrenNamed(el: Element, name: string): Element[] {
  const out: Element[] = []
  for (let i = 0; i < el.children.length; i++) {
    if (el.children[i].localName === name) out.push(el.children[i])
  }
  return out
}

function childNamed(el: Element, name: string): Element | null {
  return childrenNamed(el, name)[0] ?? null
}

function textOf(el: Element | null): string {
  return el?.textContent?.trim() ?? ''
}

// --- File-level parsing -----------------------------------------------------
export function parseExpensesFile(
  text: string,
  opts: { existingIds?: ReadonlySet<string> } = {},
): ParseFileResult {
  const bytes = new TextEncoder().encode(text).length
  if (bytes > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: {
        code: 'too-large',
        message: `A fájl túl nagy (${(bytes / 1024 / 1024).toFixed(1)} MB) — a határ 5 MB.`,
      },
    }
  }
  if (!text.trim()) {
    return { ok: false, error: { code: 'empty', message: 'Üres bemenet.' } }
  }
  // External entities disabled: browsers' DOMParser never fetches external
  // entities, and we reject any DTD outright as belt-and-braces.
  if (/<!DOCTYPE/i.test(text)) {
    return {
      ok: false,
      error: { code: 'doctype', message: 'DOCTYPE / külső entitás nem engedélyezett.' },
    }
  }

  let doc: Document
  try {
    doc = new DOMParser().parseFromString(text, 'text/xml')
  } catch {
    return { ok: false, error: { code: 'malformed', message: 'Hibás XML: nem dolgozható fel.' } }
  }
  if (doc.getElementsByTagName('parsererror').length > 0 || !doc.documentElement) {
    return { ok: false, error: { code: 'malformed', message: 'Hibás XML: a fájl nem jól formázott.' } }
  }

  const root = doc.documentElement
  if (root.localName !== 'expenses') {
    return {
      ok: false,
      error: { code: 'wrong-root', message: `A gyökérelem "${root.localName}", nem "expenses".` },
    }
  }
  if (root.getAttribute('version') !== '1') {
    return {
      ok: false,
      error: {
        code: 'bad-version',
        message: `Nem támogatott verzió: "${root.getAttribute('version') ?? ''}" (várt: "1").`,
      },
    }
  }

  const receiptEls = childrenNamed(root, 'receipt')
  if (receiptEls.length === 0) {
    return { ok: false, error: { code: 'no-receipts', message: 'A fájl nem tartalmaz nyugtát.' } }
  }

  const ranges = extractReceiptRanges(text)
  if (ranges.length !== receiptEls.length) {
    // Should be impossible on well-formed input; refuse rather than risk
    // storing a mis-sliced element (EXP-01).
    return {
      ok: false,
      error: { code: 'raw-extract-mismatch', message: 'A nyugták nyers kivágása nem egyezik a feldolgozással.' },
    }
  }

  const rootCurrency = root.getAttribute('currency') ?? 'EUR'
  const seenIds = new Set<string>()
  const receipts: ParsedReceipt[] = receiptEls.map((el, index) => {
    const rawXml = text.slice(ranges[index].start, ranges[index].end)
    return parseReceipt(el, rawXml, index, rootCurrency, seenIds, opts.existingIds)
  })

  return { ok: true, receipts }
}

// --- Receipt-level validation ------------------------------------------------
function parseReceipt(
  el: Element,
  rawXml: string,
  index: number,
  rootCurrency: string,
  seenIds: Set<string>,
  existingIds?: ReadonlySet<string>,
): ParsedReceipt {
  const errors: Problem[] = []
  const warnings: Problem[] = []

  const id = el.getAttribute('id')
  if (!id) errors.push({ code: 'missing-id', message: 'Hiányzó @id.' })

  const source = el.getAttribute('source') as ReceiptSource | null
  if (!source || !SOURCES.includes(source)) {
    errors.push({ code: 'bad-source', message: `Érvénytelen @source: "${source ?? ''}".` })
  }
  const confidence = el.getAttribute('confidence') as ReceiptConfidence | null
  if (!confidence || !CONFIDENCES.includes(confidence)) {
    errors.push({ code: 'bad-confidence', message: `Érvénytelen @confidence: "${confidence ?? ''}".` })
  }

  const merchant = childNamed(el, 'merchant')
  const merchantName = textOf(merchant ? childNamed(merchant, 'name') : null)
  if (!merchantName) {
    errors.push({ code: 'missing-merchant-name', message: 'Hiányzó merchant/name.' })
  }

  const datetimeEl = childNamed(el, 'datetime')
  const datetime = textOf(datetimeEl)
  if (!datetimeEl || !datetime) {
    errors.push({ code: 'missing-datetime', message: 'Hiányzó datetime.' })
  } else if (DATETIME_RE.test(datetime)) {
    // full ISO 8601 with offset — fine
  } else if (DATE_ONLY_RE.test(datetime)) {
    if (datetimeEl.getAttribute('precision') !== 'day') {
      errors.push({
        code: 'bad-datetime',
        message: `Csak dátum ("${datetime}") kizárólag precision="day" mellett megengedett.`,
      })
    }
  } else {
    errors.push({
      code: 'bad-datetime',
      message: `Érvénytelen datetime: "${datetime}" (ISO 8601 eltolással, vagy dátum precision="day" mellett).`,
    })
  }

  const itemsEl = childNamed(el, 'items')
  const itemEls = itemsEl ? childrenNamed(itemsEl, 'item') : []
  if (itemEls.length === 0) {
    errors.push({ code: 'missing-items', message: 'Legalább egy items/item kötelező.' })
  }

  const totalsEl = childNamed(el, 'totals')
  const totalStr = textOf(totalsEl ? childNamed(totalsEl, 'total') : null)
  const paidStr = textOf(totalsEl ? childNamed(totalsEl, 'paid') : null)
  if (!totalsEl || !childNamed(totalsEl, 'total')) {
    errors.push({ code: 'missing-total', message: 'Hiányzó totals/total.' })
  } else if (parseCents(totalStr) == null) {
    errors.push({ code: 'bad-amount', message: `Érvénytelen totals/total összeg: "${totalStr}".` })
  }
  if (!totalsEl || !childNamed(totalsEl, 'paid')) {
    errors.push({ code: 'missing-paid', message: 'Hiányzó totals/paid.' })
  } else if (parseCents(paidStr) == null) {
    errors.push({ code: 'bad-amount', message: `Érvénytelen totals/paid összeg: "${paidStr}".` })
  }

  // Items: structure first, arithmetic after.
  const itemNames: string[] = []
  let netSumCents = 0
  const netByVat = new Map<string, number>()
  for (const item of itemEls) {
    const n = item.getAttribute('n') ?? '?'
    if (!item.getAttribute('n')) {
      errors.push({ code: 'missing-item-n', message: 'Tétel @n nélkül.' })
    }
    const category = item.getAttribute('category') ?? ''
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      errors.push({
        code: 'bad-category',
        message: `Tétel ${n}: ismeretlen kategória "${category}".`,
      })
    }
    const nameEl = childNamed(item, 'name')
    if (!nameEl || !textOf(nameEl)) {
      errors.push({ code: 'missing-item-name', message: `Tétel ${n}: hiányzó name.` })
    } else {
      itemNames.push(textOf(nameEl))
    }
    const labelEl = childNamed(item, 'label')
    if (labelEl && textOf(labelEl)) itemNames.push(textOf(labelEl))

    const grossStr = textOf(childNamed(item, 'gross'))
    const netStr = textOf(childNamed(item, 'net'))
    const grossCents = parseCents(grossStr)
    const netCents = parseCents(netStr)
    if (!childNamed(item, 'gross') || grossCents == null) {
      errors.push({ code: 'bad-amount', message: `Tétel ${n}: hiányzó vagy érvénytelen gross ("${grossStr}").` })
    }
    if (!childNamed(item, 'net') || netCents == null) {
      errors.push({ code: 'bad-amount', message: `Tétel ${n}: hiányzó vagy érvénytelen net ("${netStr}").` })
    }

    let discountCents = 0
    let discountsOk = true
    const discountsEl = childNamed(item, 'discounts')
    for (const d of discountsEl ? childrenNamed(discountsEl, 'discount') : []) {
      const dc = parseCents(textOf(d))
      if (dc == null) {
        errors.push({ code: 'bad-amount', message: `Tétel ${n}: érvénytelen discount ("${textOf(d)}").` })
        discountsOk = false
      } else {
        discountCents += dc
      }
    }

    // Arithmetic (warnings, not errors): net = gross − Σdiscount, ±0.005.
    // In integer cents a 0.5-cent tolerance means the difference must be 0.
    if (grossCents != null && netCents != null && discountsOk) {
      const expected = grossCents - discountCents
      if (Math.abs(netCents - expected) > 0.5) {
        warnings.push({
          code: 'item-net-mismatch',
          message: `Tétel ${n}: net (${formatCents(netCents)}) ≠ gross − kedvezmények (${formatCents(expected)}), eltérés ${formatCents(netCents - expected)}.`,
        })
      }
    }
    if (netCents != null) {
      netSumCents += netCents
      const vat = item.getAttribute('vat')
      if (vat) netByVat.set(vat, (netByVat.get(vat) ?? 0) + netCents)
    }
  }

  // Arithmetic: totals/total = Σ item net, tolerance 0.01. With 2-decimal
  // inputs every difference is a whole cent, so a full 0.01 discrepancy is
  // already a mismatch (the spec's failure case is exactly 41.24 vs 41.23).
  const totalCents = parseCents(totalStr)
  if (totalCents != null && itemEls.length > 0) {
    if (Math.abs(totalCents - netSumCents) >= 1) {
      warnings.push({
        code: 'total-mismatch',
        message: `Végösszeg (${formatCents(totalCents)}) ≠ tételek net összege (${formatCents(netSumCents)}), eltérés ${formatCents(totalCents - netSumCents)}.`,
      })
    }
  }

  // Arithmetic: by-vat classes vs per-letter item net sums, ±0.01.
  const byVatEl = totalsEl ? childNamed(totalsEl, 'by-vat') : null
  if (byVatEl) {
    for (const cls of childrenNamed(byVatEl, 'class')) {
      const code = cls.getAttribute('code') ?? '?'
      const clsCents = parseCents(textOf(cls))
      if (clsCents == null) {
        errors.push({ code: 'bad-amount', message: `by-vat ${code}: érvénytelen összeg ("${textOf(cls)}").` })
        continue
      }
      const sum = netByVat.get(code) ?? 0
      if (Math.abs(clsCents - sum) >= 1) {
        warnings.push({
          code: 'by-vat-mismatch',
          message: `ÁFA ${code} osztály (${formatCents(clsCents)}) ≠ tételek net összege (${formatCents(sum)}), eltérés ${formatCents(clsCents - sum)}.`,
        })
      }
    }
  }

  // Generator-declared mismatch: surface as a warning; the generator knows.
  const reconEl = totalsEl ? childNamed(totalsEl, 'reconciliation') : null
  if (reconEl && reconEl.getAttribute('status') === 'mismatch') {
    warnings.push({
      code: 'reconciliation-mismatch',
      message: `A generátor egyeztetési státusza: mismatch. ${textOf(reconEl)}`.trim(),
    })
  }

  // Currency: receipt attribute if present, else the container's. The export
  // container is always EUR, so a non-EUR receipt without its own @currency
  // could not be re-emitted faithfully — reject it rather than mislabel money.
  const currency = el.getAttribute('currency') ?? rootCurrency
  if (currency !== 'EUR' && !el.getAttribute('currency')) {
    errors.push({
      code: 'currency-unrepresentable',
      message: `A konténer pénzneme "${rootCurrency}", de a nyugtán nincs saját @currency — exportkor nem lenne visszaadható.`,
    })
  }

  // Duplicates.
  if (id && seenIds.has(id)) {
    errors.push({ code: 'duplicate-id', message: `Ismétlődő azonosító a fájlban: ${id}.` })
  }
  if (id && existingIds?.has(id)) {
    errors.push({ code: 'duplicate-id', message: `Már létező azonosító: ${id}.` })
  }
  if (id) seenIds.add(id)

  if (errors.length > 0) {
    return { status: 'invalid', index, id, errors }
  }

  const nif = merchant ? textOf(childNamed(merchant, 'nif')) || null : null
  let receiptNumber: string | null = null
  for (const ref of childrenNamed(el, 'reference')) {
    if (ref.getAttribute('type') === 'receipt-number') {
      receiptNumber = textOf(ref) || null
      break
    }
  }

  const record: ReceiptRecord = {
    id: id!,
    rawXml,
    datetime,
    localDate: localDateOf(datetime),
    merchantName,
    chain: merchant?.getAttribute('chain') ?? null,
    nif,
    receiptNumber,
    totalCents: totalCents!,
    currency,
    source: source!,
    confidence: confidence!,
    itemCount: itemEls.length,
    searchText: [merchantName, ...itemNames].join(' ').toLowerCase(),
    warnings,
  }
  return { status: 'valid', index, id, record }
}

// --- Export -----------------------------------------------------------------
export interface ExportReceipt {
  rawXml: string
  datetime: string
}

// Sort key for export ordering only — never used for storage or filtering.
function datetimeEpoch(dt: string): number {
  const t = Date.parse(dt)
  return Number.isNaN(t) ? 0 : t
}

export function buildExportXml(opts: {
  from: string
  to: string
  generated: string
  generator: string
  receipts: ExportReceipt[]
}): string {
  const sorted = [...opts.receipts].sort((a, b) => datetimeEpoch(a.datetime) - datetimeEpoch(b.datetime))
  // INVARIANT [EXP-01]: the app never alters receipt content — each stored
  // element text is re-emitted here byte-for-byte, only the container around
  // it is generated. Must survive rewrites.
  const body = sorted.map((r) => '  ' + r.rawXml).join('\n\n')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<expenses version="1" currency="EUR" generated="${opts.generated}" generator="${opts.generator}">`,
    `  <period from="${opts.from}" to="${opts.to}"/>`,
    '',
    body,
    '',
    '</expenses>',
    '',
  ].join('\n')
}

export function exportFilename(from: string, to: string): string {
  return `expenses_${from}_${to}.xml`
}
