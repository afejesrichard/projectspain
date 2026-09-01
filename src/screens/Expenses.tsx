import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { color, font, hexA } from '../theme'
import { useStore } from '../store'
import { Chip, EmptyState, Skeleton } from '../components/primitives'
import { IconDownload, IconSearch, IconUpload } from '../components/icons'
import type { Receipt } from '../types'
import {
  MAX_FILE_BYTES,
  buildExportXml,
  exportFilename,
  formatCents,
  parseExpensesFile,
  type Problem,
  type ReceiptRecord,
} from '../lib/expenses'
import { fetchReceiptRawsInRange } from '../data/repo'

export const APP_GENERATOR = 'project-spain/0.1.0'

// --- Shared formatting -------------------------------------------------------
export function fmtLocalDate(localDate: string): string {
  const d = new Date(localDate + 'T00:00:00')
  return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function Badge({ value, tone }: { value: string; tone: string }) {
  return (
    <span
      style={{
        fontFamily: font.mono,
        fontSize: 10,
        letterSpacing: '0.04em',
        color: tone,
        border: `1px solid ${hexA(tone, 0.45)}`,
        background: hexA(tone, 0.08),
        borderRadius: 4,
        padding: '1px 6px',
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </span>
  )
}

export const SOURCE_TONE: Record<Receipt['source'], string> = {
  photo: color.keep,
  text: color.give,
  manual: color.softInk,
}
export const CONFIDENCE_TONE: Record<Receipt['confidence'], string> = {
  high: color.sell,
  medium: color.give,
  low: color.throw,
}

// --- Date range --------------------------------------------------------------
type RangePreset = 'this' | 'last' | 'all' | 'custom'

function monthRange(offset: number): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(first), to: iso(last) }
}

// --- Import plan -------------------------------------------------------------
interface PlanEntry {
  index: number
  id: string | null
  label: string
  errors: Problem[]
  warnings: Problem[]
  nifDup: boolean
  record: ReceiptRecord | null
  // user choices
  override: boolean // "import anyway" despite warnings
  nifImport: boolean // import despite nif + receipt-number match (default: skip)
}

interface ImportOutcome {
  label: string
  outcome: 'imported' | 'skipped' | 'rejected'
  reason: string | null
}

export function Expenses() {
  const navigate = useNavigate()
  const receipts = useStore((s) => s.receipts)
  const loading = useStore((s) => s.loading)
  const importReceipt = useStore((s) => s.importReceipt)

  // --- filters ---
  const [preset, setPreset] = useState<RangePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [query, setQuery] = useState('')

  const range = useMemo((): { from: string; to: string } | null => {
    if (preset === 'this') return monthRange(0)
    if (preset === 'last') return monthRange(-1)
    if (preset === 'custom') {
      if (!customFrom || !customTo) return null
      return { from: customFrom, to: customTo }
    }
    return null // all
  }, [preset, customFrom, customTo])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return receipts
      .filter((r) => {
        // INVARIANT [EXP-03]: date range filtering uses local_date, the
        // calendar date in the receipt's own offset — a receipt at
        // 23:30+02:00 belongs to that calendar day, never to the UTC one.
        // Must survive rewrites.
        if (range && (r.localDate < range.from || r.localDate > range.to)) return false
        if (q && !r.searchText.includes(q)) return false
        return true
      })
      .sort((a, b) => (a.datetime < b.datetime ? 1 : a.datetime > b.datetime ? -1 : 0))
  }, [receipts, range, query])

  // INVARIANT [EXP-02]: the sum of `total` for the visible set is the ONLY
  // aggregation this feature performs — category, VAT, merchant and recurrence
  // analysis happen outside the app, on the exported file. Summed in integer
  // cents, grouped per currency. Must survive rewrites.
  const sums = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of filtered) m.set(r.currency, (m.get(r.currency) ?? 0) + r.totalCents)
    return [...m.entries()]
  }, [filtered])

  // --- import panel ---
  const fileRef = useRef<HTMLInputElement>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [plan, setPlan] = useState<PlanEntry[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [outcomes, setOutcomes] = useState<ImportOutcome[] | null>(null)

  const resetImport = () => {
    setFileError(null)
    setPlan(null)
    setOutcomes(null)
    setPasteText('')
  }

  const analyze = (text: string) => {
    setFileError(null)
    setPlan(null)
    setOutcomes(null)
    const existingIds = new Set(receipts.map((r) => r.id))
    const res = parseExpensesFile(text, { existingIds })
    if (!res.ok) {
      setFileError(res.error.message)
      return
    }
    const entries: PlanEntry[] = res.receipts.map((r) => {
      if (r.status === 'invalid') {
        return {
          index: r.index,
          id: r.id,
          label: r.id ?? `#${r.index + 1}. nyugta`,
          errors: r.errors,
          warnings: [],
          nifDup: false,
          record: null,
          override: false,
          nifImport: false,
        }
      }
      const rec = r.record
      // CONTRACT [EXP-05]: the nif + receipt-number warn rule applies only when
      // BOTH values exist. The !! guards make a receipt with no nif (state fee,
      // tasa 790) or with only a non-receipt-number reference (e.g. type="nrc")
      // skip this rule silently — no false duplicate warning, no null === null
      // match, no crash — while the @id rule still applies at parse time and at
      // the primary key. Must survive rewrites.
      const nifDup =
        !!rec.nif &&
        !!rec.receiptNumber &&
        receipts.some((x) => x.nif === rec.nif && x.receiptNumber === rec.receiptNumber)
      return {
        index: r.index,
        id: rec.id,
        label: `${rec.merchantName} · ${fmtLocalDate(rec.localDate)} · ${formatCents(rec.totalCents)} ${rec.currency}`,
        errors: [],
        warnings: rec.warnings,
        nifDup,
        record: rec,
        override: false,
        nifImport: false,
      }
    })
    setPlan(entries)
  }

  const onFile = async (files: FileList | null) => {
    const f = files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!f) return
    resetImport()
    if (f.size > MAX_FILE_BYTES) {
      setFileError(`A fájl túl nagy (${(f.size / 1024 / 1024).toFixed(1)} MB) — a határ 5 MB.`)
      return
    }
    analyze(await f.text())
  }

  const runImport = async () => {
    if (!plan || importing) return
    setImporting(true)
    const results: ImportOutcome[] = []
    for (const e of plan) {
      if (!e.record) {
        results.push({
          label: e.label,
          outcome: 'rejected',
          reason: e.errors.map((x) => x.message).join(' '),
        })
        continue
      }
      if (e.nifDup && !e.nifImport) {
        results.push({
          label: e.label,
          outcome: 'skipped',
          reason: 'Azonos NIF + nyugtaszám már létezik (kihagyás választva).',
        })
        continue
      }
      if (e.warnings.length > 0 && !e.override) {
        results.push({
          label: e.label,
          outcome: 'skipped',
          reason: 'Számolási figyelmeztetés, nincs bejelölve az „importálás mindenképp”.',
        })
        continue
      }
      const r = await importReceipt(e.record)
      if (r === 'imported') {
        results.push({ label: e.label, outcome: 'imported', reason: null })
      } else if (r === 'duplicate') {
        results.push({ label: e.label, outcome: 'rejected', reason: 'ismétlődő azonosító' })
      } else {
        results.push({ label: e.label, outcome: 'rejected', reason: 'mentési hiba — próbáld újra' })
      }
    }
    setImporting(false)
    setPlan(null)
    setOutcomes(results)
  }

  // --- export ---
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const exportRange = useMemo((): { from: string; to: string } | null => {
    if (range) return range
    if (filtered.length === 0) return null
    let from = filtered[0].localDate
    let to = filtered[0].localDate
    for (const r of filtered) {
      if (r.localDate < from) from = r.localDate
      if (r.localDate > to) to = r.localDate
    }
    return { from, to }
  }, [range, filtered])

  const runExport = async () => {
    if (!exportRange || exporting) return
    setExporting(true)
    setExportError(null)
    try {
      const raws = await fetchReceiptRawsInRange(exportRange.from, exportRange.to)
      if (raws.length === 0) {
        setExportError('Nincs nyugta a kiválasztott időszakban.')
        return
      }
      const xml = buildExportXml({
        from: exportRange.from,
        to: exportRange.to,
        generated: new Date().toISOString(),
        generator: APP_GENERATOR,
        receipts: raws,
      })
      const blob = new Blob([xml], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportFilename(exportRange.from, exportRange.to)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setExportError('Az export nem sikerült — próbáld újra.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 26, margin: 0, letterSpacing: '-0.01em' }}>
          Kiadások
        </h1>
        <span style={{ fontFamily: font.mono, fontSize: 13, color: color.softInk }}>
          {filtered.length} nyugta
          {sums.length > 0 && (
            <> · Σ {sums.map(([cur, cents]) => `${formatCents(cents)} ${cur}`).join(' + ')}</>
          )}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              setImportOpen((v) => !v)
              resetImport()
            }}
            style={{ ...actionBtn, background: color.ink, color: color.paper, border: 'none' }}
          >
            <IconUpload size={15} />
            Import
          </button>
          <button
            onClick={runExport}
            disabled={!exportRange || exporting}
            style={{
              ...actionBtn,
              background: color.cardWhite,
              color: exportRange ? color.ink : color.faintInk,
              border: `1px solid ${color.line}`,
              cursor: exportRange && !exporting ? 'pointer' : 'default',
            }}
          >
            <IconDownload size={15} />
            {exporting ? 'Export…' : 'Export'}
          </button>
        </div>
      </div>

      {exportError && <ErrorBox text={exportError} />}

      {importOpen && (
        <div
          style={{
            border: `1px solid ${color.line}`,
            background: color.cardWhite,
            borderRadius: 12,
            padding: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 16, marginBottom: 10 }}>
            Nyugta XML importálása
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            hidden
            onChange={(e) => onFile(e.target.files)}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ ...actionBtn, background: color.ink, color: color.paper, border: 'none' }}
            >
              XML fájl kiválasztása
            </button>
            <span style={{ fontSize: 12.5, color: color.softInk }}>vagy illeszd be a szöveget:</span>
          </div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="<expenses version=&quot;1&quot; …>"
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginTop: 10,
              border: `1px solid ${color.line}`,
              borderRadius: 8,
              padding: 10,
              fontFamily: font.mono,
              fontSize: 12,
              resize: 'vertical',
            }}
          />
          {pasteText.trim() && !plan && !outcomes && (
            <button
              onClick={() => analyze(pasteText)}
              style={{ ...actionBtn, marginTop: 8, background: color.ink, color: color.paper, border: 'none' }}
            >
              Ellenőrzés
            </button>
          )}

          {fileError && <ErrorBox text={fileError} />}

          {plan && (
            <div style={{ marginTop: 14 }}>
              {plan.map((e, i) => (
                <PlanRow
                  key={i}
                  entry={e}
                  onToggleOverride={() =>
                    setPlan((p) => p!.map((x, j) => (j === i ? { ...x, override: !x.override } : x)))
                  }
                  onNifChoice={(imp) =>
                    setPlan((p) => p!.map((x, j) => (j === i ? { ...x, nifImport: imp } : x)))
                  }
                />
              ))}
              <button
                onClick={runImport}
                disabled={importing}
                style={{ ...actionBtn, marginTop: 12, background: color.sell, color: color.paper, border: 'none' }}
              >
                {importing ? 'Importálás…' : 'Importálás'}
              </button>
            </div>
          )}

          {outcomes && (
            <div style={{ marginTop: 14 }}>
              {outcomes.map((o, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'baseline',
                    padding: '8px 10px',
                    borderTop: i === 0 ? 'none' : `1px solid ${color.hairlineSoft}`,
                    fontSize: 13,
                  }}
                >
                  <span
                    data-outcome={o.outcome}
                    style={{
                      fontFamily: font.mono,
                      fontSize: 11,
                      fontWeight: 700,
                      color: o.outcome === 'imported' ? color.sell : o.outcome === 'skipped' ? color.give : color.throw,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {o.outcome === 'imported' ? 'IMPORTÁLVA' : o.outcome === 'skipped' ? 'KIHAGYVA' : 'ELUTASÍTVA'}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    {o.label}
                    {o.reason && <span style={{ color: color.softInk }}> — {o.reason}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters: date range presets + free text over merchant and item names. */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: color.paper,
          padding: '10px 0 12px',
          marginBottom: 6,
          borderBottom: `1px solid ${color.line}`,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Chip active={preset === 'this'} onClick={() => setPreset('this')}>Ez a hónap</Chip>
        <Chip active={preset === 'last'} onClick={() => setPreset('last')}>Előző hónap</Chip>
        <Chip active={preset === 'all'} onClick={() => setPreset('all')}>Összes</Chip>
        <Chip active={preset === 'custom'} onClick={() => setPreset('custom')}>Egyéni</Chip>
        {preset === 'custom' && (
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={dateInput} />
            <span style={{ color: color.softInk }}>–</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={dateInput} />
          </span>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: `1px solid ${color.line}`,
            background: color.cardWhite,
            borderRadius: 8,
            padding: '8px 12px',
            minWidth: 160,
            flex: 1,
            maxWidth: 320,
          }}
        >
          <IconSearch size={14} style={{ color: color.faintInk }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés boltra vagy tételre"
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%' }}
          />
        </div>
      </div>

      {loading && receipts.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} h={56} r={10} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ paddingTop: 12 }}>
          {receipts.length === 0 ? (
            <EmptyState
              title="Még nincs nyugta."
              hint="Tölts fel egy Claude által készített nyugta-XML fájlt az Import gombbal."
            />
          ) : (
            <EmptyState title="Nincs találat." hint="Próbálj másik időszakot vagy keresést." />
          )}
        </div>
      ) : (
        <div style={{ paddingTop: 8 }}>
          {filtered.map((r) => (
            <ReceiptRow key={r.id} r={r} onOpen={() => navigate(`/kiadasok/${r.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlanRow({
  entry,
  onToggleOverride,
  onNifChoice,
}: {
  entry: PlanEntry
  onToggleOverride: () => void
  onNifChoice: (imp: boolean) => void
}) {
  const status = entry.record
    ? entry.warnings.length > 0 || entry.nifDup
      ? { word: 'FIGYELMEZTETÉS', tone: color.give }
      : { word: 'RENDBEN', tone: color.sell }
    : { word: 'HIBÁS', tone: color.throw }
  return (
    <div
      style={{
        border: `1px solid ${hexA(status.tone, 0.45)}`,
        background: hexA(status.tone, 0.05),
        borderRadius: 8,
        padding: '10px 12px',
        marginTop: 8,
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: font.mono, fontSize: 11, fontWeight: 700, color: status.tone }}>{status.word}</span>
        <span style={{ fontWeight: 500 }}>{entry.label}</span>
        {entry.id && <span style={{ fontFamily: font.mono, fontSize: 11, color: color.softInk }}>{entry.id}</span>}
      </div>
      {entry.errors.map((e, i) => (
        <div key={i} style={{ color: color.throw, marginTop: 5 }}>{e.message}</div>
      ))}
      {entry.warnings.map((w, i) => (
        <div key={i} style={{ color: color.mutedInk, marginTop: 5 }}>⚠ {w.message}</div>
      ))}
      {entry.warnings.length > 0 && entry.record && (
        <label style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 7, cursor: 'pointer' }}>
          <input type="checkbox" checked={entry.override} onChange={onToggleOverride} />
          Importálás mindenképp
        </label>
      )}
      {entry.nifDup && entry.record && (
        <div style={{ marginTop: 7 }}>
          <div style={{ color: color.mutedInk }}>
            ⚠ Azonos NIF + nyugtaszám már szerepel a tárban — lehet, hogy ez a nyugta már megvan.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <Chip active={!entry.nifImport} onClick={() => onNifChoice(false)}>Kihagyom</Chip>
            <Chip active={entry.nifImport} onClick={() => onNifChoice(true)}>Importálom mégis</Chip>
          </div>
        </div>
      )}
    </div>
  )
}

function ReceiptRow({ r, onOpen }: { r: Receipt; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="mf-card-cv"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        border: `1px solid ${color.line}`,
        background: color.cardWhite,
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 8,
        cursor: 'pointer',
        color: 'inherit',
      }}
    >
      <span style={{ fontFamily: font.mono, fontSize: 12, color: color.softInk, whiteSpace: 'nowrap' }}>
        {fmtLocalDate(r.localDate)}
      </span>
      <span style={{ fontSize: 14, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.merchantName}
      </span>
      <span style={{ display: 'flex', gap: 5 }}>
        <Badge value={r.source} tone={SOURCE_TONE[r.source]} />
        <Badge value={r.confidence} tone={CONFIDENCE_TONE[r.confidence]} />
        {r.warnings.length > 0 && <Badge value="⚠" tone={color.give} />}
      </span>
      <span style={{ fontFamily: font.mono, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
        {formatCents(r.totalCents)} {r.currency}
      </span>
    </button>
  )
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div
      role="alert"
      style={{
        border: `1px solid ${hexA(color.throw, 0.5)}`,
        background: hexA(color.throw, 0.07),
        color: color.throw,
        borderRadius: 8,
        padding: '10px 12px',
        marginTop: 10,
        fontSize: 13,
      }}
    >
      {text}
    </div>
  )
}

const actionBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '11px 16px',
  borderRadius: 9,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
}

const dateInput: React.CSSProperties = {
  border: `1px solid ${color.line}`,
  background: color.cardWhite,
  borderRadius: 8,
  padding: '7px 9px',
  fontSize: 13,
  fontFamily: font.mono,
}
