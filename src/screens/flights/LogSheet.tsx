import { useEffect, useMemo, useRef, useState } from 'react'
import { color, font } from '../../theme'
import { useIsDesktop } from '../../hooks/useMedia'
import { useFlights } from '../../stores/flights'
import { parseEurInput } from '../../lib/budget'
import { checkTripDates, shift, weekday, type FareSettings, type Party } from '../../lib/fares'
import { IconClose } from '../../components/icons'

// "Log a trip": a sheet on a phone, a dialog on desktop. Keeps the artifact's
// date checks: the return must follow the outbound, and the form warns when
// dates miss a long weekend, the camp rule, or fall on a working weekday.

const CARRIERS = ['Ryanair', 'Wizz Air', 'Other']

function nextFriday(today: string): string {
  let d = shift(today, 7)
  while (weekday(d) !== 5) d = shift(d, 1)
  return d
}

export function LogSheet({ settings, today, onClose }: { settings: FareSettings; today: string; onClose: () => void }) {
  const isDesktop = useIsDesktop()
  const addTrip = useFlights((s) => s.addTrip)
  const firstRef = useRef<HTMLButtonElement>(null)

  const [party, setParty] = useState<Party>('family')
  const [out, setOut] = useState(() => nextFriday(today))
  const [ret, setRet] = useState(() => shift(nextFriday(today), 2))
  const [outCarrier, setOutCarrier] = useState('Ryanair')
  const [retCarrier, setRetCarrier] = useState('Ryanair')
  const [outDep, setOutDep] = useState('')
  const [outArr, setOutArr] = useState('')
  const [retDep, setRetDep] = useState('')
  const [retArr, setRetArr] = useState('')
  const [price, setPrice] = useState('')
  const [partyPrice, setPartyPrice] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const check = useMemo(() => checkTripDates(party, out, ret, today, settings), [party, out, ret, today, settings])
  const gp = party === 'grandparents'
  const p = settings.party[party]
  const who = p.children ? `${p.adults} felnőtt + ${p.children} gyerek` : `${p.adults} felnőtt`

  useEffect(() => {
    firstRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !check.ok) return
    const priceCents = parseEurInput(price)
    const partyCents = partyPrice.trim() ? parseEurInput(partyPrice) : null
    if (!out || !ret || !priceCents) {
      setStatus('Add meg mindkét dátumot és az egy felnőttre eső árat.')
      return
    }
    if (partyPrice.trim() && !partyCents) {
      setStatus('A társaság teljes ára nem érvényes összeg.')
      return
    }
    setBusy(true)
    setStatus('Mentés…')
    const ok = await addTrip({
      party,
      outDate: out,
      retDate: ret,
      outDep,
      outArr,
      retDep,
      retArr,
      outCarrier,
      retCarrier,
      priceCents,
      partyPriceCents: partyCents,
      note: note.trim(),
    })
    setBusy(false)
    if (ok) onClose()
    else setStatus('Nem sikerült menteni. Ellenőrizd a kapcsolatot, és próbáld újra.')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,24,36,0.45)' }} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="Út rögzítése"
        style={{
          position: 'relative',
          width: isDesktop ? 'min(560px, calc(100vw - 48px))' : '100%',
          maxHeight: isDesktop ? 'calc(100vh - 96px)' : '90vh',
          overflowY: 'auto',
          background: color.paper,
          borderRadius: isDesktop ? 16 : '16px 16px 0 0',
          padding: isDesktop ? '20px 22px 22px' : '18px 16px calc(20px + env(safe-area-inset-bottom))',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          fontFamily: font.body,
        }}
      >
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
          <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 19, margin: 0 }}>Út rögzítése</h2>
          <button type="button" onClick={onClose} aria-label="Bezárás" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: color.mutedInk, cursor: 'pointer', padding: 4 }}>
            <IconClose size={18} />
          </button>
        </div>

        <div role="radiogroup" aria-label="Kik utaznak" style={{ gridColumn: '1 / -1', display: 'flex', gap: 6 }}>
          {(['family', 'grandparents'] as Party[]).map((v, i) => (
            <button
              key={v}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              role="radio"
              aria-checked={party === v}
              onClick={() => setParty(v)}
              style={{
                flex: 1,
                padding: '9px 0',
                borderRadius: 8,
                border: `1px solid ${party === v ? color.ink : color.line}`,
                background: party === v ? color.ink : color.cardWhite,
                color: party === v ? color.paper : color.ink,
                fontWeight: 600,
                fontSize: 13.5,
                cursor: 'pointer',
              }}
            >
              {v === 'family' ? 'Család, BCN-ből' : 'Nagyszülők, BUD-ból'}
            </button>
          ))}
        </div>

        <Field label={gp ? 'Oda (BUD → BCN)' : 'Oda (BCN → BUD)'}>
          <input type="date" value={out} onChange={(e) => setOut(e.target.value)} style={input} required />
        </Field>
        <Field label={gp ? 'Vissza (BCN → BUD)' : 'Vissza (BUD → BCN)'}>
          <input type="date" value={ret} onChange={(e) => setRet(e.target.value)} style={input} required />
        </Field>
        <Field label="Légitársaság oda">
          <select value={outCarrier} onChange={(e) => setOutCarrier(e.target.value)} style={input}>
            {CARRIERS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Légitársaság vissza">
          <select value={retCarrier} onChange={(e) => setRetCarrier(e.target.value)} style={input}>
            {CARRIERS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Oda: indul · érkezik">
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="time" value={outDep} onChange={(e) => setOutDep(e.target.value)} style={input} aria-label="Oda indulás" />
            <input type="time" value={outArr} onChange={(e) => setOutArr(e.target.value)} style={input} aria-label="Oda érkezés" />
          </div>
        </Field>
        <Field label="Vissza: indul · érkezik">
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="time" value={retDep} onChange={(e) => setRetDep(e.target.value)} style={input} aria-label="Vissza indulás" />
            <input type="time" value={retArr} onChange={(e) => setRetArr(e.target.value)} style={input} aria-label="Vissza érkezés" />
          </div>
        </Field>
        <Field label="1 felnőtt, mindkét út (€)">
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="59,98" style={input} required />
        </Field>
        <Field label={`Teljes ár, ${who} (€)`}>
          <input inputMode="decimal" value={partyPrice} onChange={(e) => setPartyPrice(e.target.value)} placeholder="nem kötelező" style={input} />
        </Field>
        <Field label="Megjegyzés" full>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="nem kötelező" style={input} />
        </Field>

        {check.warnings.length > 0 && (
          <div style={{ gridColumn: '1 / -1', fontSize: 12.5, color: check.ok ? color.give : color.throw }}>{check.warnings.join(' ')}</div>
        )}
        {status && <div style={{ gridColumn: '1 / -1', fontFamily: font.mono, fontSize: 12, color: color.mutedInk }}>{status}</div>}

        <button
          type="submit"
          disabled={busy || !check.ok}
          style={{
            gridColumn: '1 / -1',
            padding: '12px 0',
            borderRadius: 9,
            border: 'none',
            background: color.ink,
            color: color.paper,
            fontSize: 14.5,
            fontWeight: 600,
            cursor: busy || !check.ok ? 'default' : 'pointer',
            opacity: busy || !check.ok ? 0.5 : 1,
          }}
        >
          Rögzítés
        </button>
      </form>
    </div>
  )
}

const input: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  border: `1px solid ${color.line}`,
  borderRadius: 8,
  padding: '8px 9px',
  fontSize: 14,
  fontFamily: font.body,
  background: color.cardWhite,
  color: color.ink,
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, gridColumn: full ? '1 / -1' : undefined }}>
      <span style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: color.softInk }}>{label}</span>
      {children}
    </label>
  )
}
