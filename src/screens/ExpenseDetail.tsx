import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { color, font, hexA } from '../theme'
import { useStore } from '../store'
import { Skeleton } from '../components/primitives'
import { IconArrowLeft } from '../components/icons'
import { fetchReceiptRaw } from '../data/repo'
import { Badge, CONFIDENCE_TONE, SOURCE_TONE, fmtLocalDate } from './Expenses'
import { formatCents } from '../lib/expenses'

// Read-only view over the stored element. The DOM built here is for DISPLAY
// only — the stored raw_xml is never touched, re-serialised or written back.
export function ExpenseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const receipt = useStore((s) => s.receipts.find((r) => r.id === id))
  const loading = useStore((s) => s.loading)
  const removeReceipt = useStore((s) => s.removeReceipt)

  const [raw, setRaw] = useState<string | null>(null)
  const [rawError, setRawError] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    let alive = true
    fetchReceiptRaw(id)
      .then((r) => {
        if (alive) setRaw(r)
      })
      .catch(() => {
        if (alive) setRawError(true)
      })
    return () => {
      alive = false
    }
  }, [id])

  const doc = useMemo(() => {
    if (!raw) return null
    const d = new DOMParser().parseFromString(raw, 'text/xml')
    return d.getElementsByTagName('parsererror').length > 0 ? null : d.documentElement
  }, [raw])

  if (!receipt) {
    if (loading) return <Skeleton h={200} r={12} />
    return (
      <div>
        <BackLink onClick={() => navigate('/kiadasok')} />
        <p style={{ color: color.softInk }}>Ez a nyugta nincs meg — lehet, hogy törölve lett.</p>
      </div>
    )
  }

  const del = async () => {
    if (deleting) return
    setDeleting(true)
    const ok = await removeReceipt(receipt.id)
    setDeleting(false)
    if (ok) navigate('/kiadasok')
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <BackLink onClick={() => navigate('/kiadasok')} />

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 24, margin: 0 }}>
          {receipt.merchantName}
        </h1>
        <span style={{ fontFamily: font.mono, fontSize: 20, fontWeight: 700 }}>
          {formatCents(receipt.totalCents)} {receipt.currency}
        </span>
        <span style={{ display: 'flex', gap: 5 }}>
          <Badge value={receipt.source} tone={SOURCE_TONE[receipt.source]} />
          <Badge value={receipt.confidence} tone={CONFIDENCE_TONE[receipt.confidence]} />
        </span>
      </div>
      <div style={{ fontFamily: font.mono, fontSize: 12, color: color.softInk, marginTop: 4 }}>
        {receipt.id} · {receipt.datetime}
      </div>

      {receipt.warnings.length > 0 && (
        <div
          style={{
            border: `1px solid ${hexA(color.give, 0.5)}`,
            background: hexA(color.give, 0.07),
            borderRadius: 8,
            padding: '10px 12px',
            marginTop: 14,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Importáláskor rögzített figyelmeztetések</div>
          {receipt.warnings.map((w, i) => (
            <div key={i} style={{ color: color.mutedInk, marginTop: 3 }}>⚠ {w.message}</div>
          ))}
        </div>
      )}

      {rawError && (
        <p style={{ color: color.throw, marginTop: 16 }}>A nyugta tartalmát nem sikerült betölteni.</p>
      )}
      {!raw && !rawError && <Skeleton h={260} r={12} style={{ marginTop: 16 }} />}
      {doc && <ReceiptBody el={doc} currency={receipt.currency} localDate={receipt.localDate} />}

      {/* delete — quiet entry, deliberate two-step confirm */}
      <div style={{ marginTop: 28, paddingTop: 16, borderTop: `1px solid ${color.hairlineSoft}` }}>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={{ ...quietBtn, color: color.throw }}>
            Nyugta törlése…
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: color.mutedInk }}>
              Biztos? Törlés után ugyanez az azonosító újra importálható.
            </span>
            <button
              onClick={del}
              disabled={deleting}
              style={{ ...quietBtn, background: color.throw, color: color.paper, border: 'none' }}
            >
              {deleting ? 'Törlés…' : 'Törlöm'}
            </button>
            <button onClick={() => setConfirmDelete(false)} style={quietBtn}>
              Mégse
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Rendering the stored element -------------------------------------------
function kids(el: Element, name: string): Element[] {
  const out: Element[] = []
  for (let i = 0; i < el.children.length; i++) {
    if (el.children[i].localName === name) out.push(el.children[i])
  }
  return out
}
const kid = (el: Element | null, name: string): Element | null => (el ? kids(el, name)[0] ?? null : null)
const txt = (el: Element | null): string => el?.textContent?.trim() ?? ''

function ReceiptBody({ el, currency, localDate }: { el: Element; currency: string; localDate: string }) {
  const merchant = kid(el, 'merchant')
  const address = kid(merchant, 'address')
  const datetime = kid(el, 'datetime')
  const payment = kid(el, 'payment')
  const loyalty = kid(el, 'loyalty')
  const totals = kid(el, 'totals')
  const byVat = kid(totals, 'by-vat')
  const recon = kid(totals, 'reconciliation')
  const notes = txt(kid(el, 'notes'))
  const items = kid(el, 'items') ? kids(kid(el, 'items')!, 'item') : []

  const addressLine = address
    ? [txt(kid(address, 'street')), [txt(kid(address, 'postcode')), txt(kid(address, 'city'))].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ')
    : ''

  const paymentLine = payment
    ? [
        { card: 'kártya', cash: 'készpénz', transfer: 'átutalás', bizum: 'Bizum', other: 'egyéb' }[
          payment.getAttribute('method') ?? 'other'
        ] ?? payment.getAttribute('method'),
        payment.getAttribute('card'),
        payment.getAttribute('last4') ? `•••• ${payment.getAttribute('last4')}` : null,
        payment.getAttribute('detail'),
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  const loyaltyLine = loyalty
    ? [
        loyalty.getAttribute('program'),
        loyalty.getAttribute('used') === 'true' ? 'használva' : null,
        loyalty.getAttribute('saving') ? `megtakarítás ${loyalty.getAttribute('saving')}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Section title="Bolt">
        <Line label="Név" value={txt(kid(merchant, 'name'))} />
        <Line label="Cégnév" value={txt(kid(merchant, 'legal-name'))} />
        <Line label="NIF" value={txt(kid(merchant, 'nif'))} mono />
        <Line label="Cím" value={addressLine} />
        <Line label="Lánc" value={merchant?.getAttribute('chain') ?? ''} mono />
      </Section>

      <Section title="Vásárlás">
        <Line label="Időpont" value={txt(datetime)} mono />
        <Line label="Nap" value={fmtLocalDate(localDate)} />
        {kids(el, 'reference').map((r, i) => (
          <Line key={i} label={r.getAttribute('type') ?? 'hivatkozás'} value={txt(r)} mono />
        ))}
        <Line label="Fizetés" value={paymentLine} />
        <Line label="Hűségprogram" value={loyaltyLine} />
      </Section>

      <Section title={`Tételek (${items.length})`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
            <thead>
              <tr>
                {['#', 'Blokkon', 'Név', 'Menny.', 'Nettó', 'Kategória', 'Jelleg', 'ÁFA'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === 'Nettó' ? 'right' : 'left',
                      fontFamily: font.mono,
                      fontSize: 10,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: color.softInk,
                      padding: '4px 8px',
                      borderBottom: `1px solid ${color.line}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td style={cell(true)}>{it.getAttribute('n')}</td>
                  <td style={{ ...cell(true), fontSize: 11 }}>{txt(kid(it, 'label'))}</td>
                  <td style={cell()}>{txt(kid(it, 'name'))}</td>
                  {/* Weighed/measured lines carry qty/@unit (kg, l) — show it with the printed decimals. */}
                  <td style={cell(true)}>
                    {[txt(kid(it, 'qty')), kid(it, 'qty')?.getAttribute('unit')].filter(Boolean).join(' ')}
                  </td>
                  <td style={{ ...cell(true), textAlign: 'right', fontWeight: 700 }}>{txt(kid(it, 'net'))}</td>
                  <td style={cell(true)}>{it.getAttribute('category')}</td>
                  <td style={cell(true)}>{it.getAttribute('recurrence') === 'one-off' ? 'egyszeri' : 'rendszeres'}</td>
                  <td style={cell(true)}>{it.getAttribute('vat')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Összegzés">
        <Line label="Bruttó" value={txt(kid(totals, 'gross'))} mono />
        <Line label="Kedvezmények" value={txt(kid(totals, 'discounts'))} mono />
        <Line label="Végösszeg" value={txt(kid(totals, 'total')) && `${txt(kid(totals, 'total'))} ${currency}`} mono strong />
        <Line label="Fizetve" value={txt(kid(totals, 'paid'))} mono />
        {byVat &&
          kids(byVat, 'class').map((c, i) => (
            <Line
              key={i}
              label={`ÁFA ${c.getAttribute('code')} (${Number(c.getAttribute('rate') ?? 0) * 100}%)`}
              value={txt(c)}
              mono
            />
          ))}
        {recon && (
          <Line
            label="Egyeztetés"
            value={`${recon.getAttribute('status') ?? ''}${txt(recon) ? ' — ' + txt(recon) : ''}`}
          />
        )}
      </Section>

      {notes && (
        <Section title="Megjegyzés">
          <div style={{ fontSize: 13.5 }}>{notes}</div>
        </Section>
      )}
    </div>
  )
}

function cell(mono = false): React.CSSProperties {
  return {
    padding: '6px 8px',
    borderBottom: `1px solid ${color.hairlineSoft}`,
    fontFamily: mono ? font.mono : font.body,
    verticalAlign: 'top',
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${color.line}`, background: color.cardWhite, borderRadius: 12, padding: '12px 14px' }}>
      <div
        style={{
          fontFamily: font.mono,
          fontSize: 10.5,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: color.softInk,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function Line({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 12, padding: '3px 0', fontSize: 13.5 }}>
      <span style={{ color: color.softInk, minWidth: 118, flex: '0 0 118px' }}>{label}</span>
      <span style={{ fontFamily: mono ? font.mono : font.body, fontWeight: strong ? 700 : 400, minWidth: 0 }}>
        {value}
      </span>
    </div>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        border: 'none',
        background: 'transparent',
        color: color.mutedInk,
        fontSize: 13.5,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <IconArrowLeft size={15} />
      Kiadások
    </button>
  )
}

const quietBtn: React.CSSProperties = {
  border: `1px solid ${color.line}`,
  background: 'transparent',
  borderRadius: 8,
  padding: '9px 14px',
  fontSize: 13.5,
  cursor: 'pointer',
  color: color.ink,
}
