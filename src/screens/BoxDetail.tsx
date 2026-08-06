import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { color, font, hexA } from '../theme'
import { useStore } from '../store'
import { PhotoUploader } from '../components/PhotoUploader'
import { Lightbox } from '../components/Lightbox'
import { Toggle } from '../components/AddItemSheet'
import { PhotoPlaceholder } from '../components/primitives'
import { IconArrowLeft, IconCheck, IconPencil } from '../components/icons'

export function BoxDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const boxes = useStore((s) => s.boxes)
  const items = useStore((s) => s.items)
  const updateBox = useStore((s) => s.updateBox)
  const removeBox = useStore((s) => s.removeBox)
  const renumberBox = useStore((s) => s.renumberBox)

  const box = boxes.find((b) => b.id === Number(id))
  const [label, setLabel] = useState(box?.label ?? '')
  const [room, setRoom] = useState(box?.room ?? '')
  const [note, setNote] = useState(box?.note ?? '')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingNumber, setEditingNumber] = useState(false)
  const [numberDraft, setNumberDraft] = useState('')
  const [numberError, setNumberError] = useState<string | null>(null)
  const [renumbering, setRenumbering] = useState(false)

  useEffect(() => {
    if (box) {
      setLabel(box.label)
      setRoom(box.room)
      setNote(box.note)
    }
    setEditingNumber(false)
    setNumberError(null)
  }, [box?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!box) {
    return (
      <div>
        <BackButton onClick={() => navigate('/dobozok')} />
        <div style={{ color: color.softInk }}>Ez a doboz nem található.</div>
      </div>
    )
  }

  const packed = items.filter((i) => i.boxId === box.id)

  const commit = (patch: Partial<{ label: string; room: string; note: string }>) => {
    const entries = Object.entries(patch) as [keyof typeof patch, string][]
    const changed = entries.some(([k, v]) => (box[k] ?? '') !== v.trim())
    if (changed) updateBox(box.id, Object.fromEntries(entries.map(([k, v]) => [k, v.trim()])))
  }

  const commitNumber = async () => {
    if (renumbering) return
    const n = Number(numberDraft)
    if (!numberDraft || !Number.isInteger(n) || n < 1) {
      setNumberError('Adj meg egy pozitív egész számot.')
      return
    }
    if (n === box.id) {
      setEditingNumber(false)
      setNumberError(null)
      return
    }
    if (boxes.some((b) => b.id === n)) {
      setNumberError(`A #${n} már foglalt — előbb számozd át a másik dobozt.`)
      return
    }
    setRenumbering(true)
    const err = await renumberBox(box.id, n)
    setRenumbering(false)
    if (err === 'taken') {
      setNumberError(`A #${n} már foglalt — előbb számozd át a másik dobozt.`)
      return
    }
    if (err) {
      setNumberError('Nem sikerült átszámozni — próbáld újra.')
      return
    }
    setEditingNumber(false)
    setNumberError(null)
    navigate(`/dobozok/${n}`, { replace: true })
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <BackButton onClick={() => navigate('/dobozok')} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        {editingNumber ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...bigNumberStyle, color: color.softInk }}>#</span>
            <input
              autoFocus
              inputMode="numeric"
              value={numberDraft}
              onChange={(e) => {
                setNumberDraft(e.target.value.replace(/\D/g, ''))
                setNumberError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitNumber()
                if (e.key === 'Escape') {
                  setEditingNumber(false)
                  setNumberError(null)
                }
              }}
              disabled={renumbering}
              style={{
                ...bigNumberStyle,
                width: `${Math.max(numberDraft.length, 1) + 0.5}ch`,
                border: 'none',
                borderBottom: `2px dashed ${color.line}`,
                background: 'transparent',
                outline: 'none',
                padding: 0,
              }}
            />
            <button
              onClick={commitNumber}
              disabled={renumbering}
              title="Átszámozás"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                borderRadius: 9,
                border: 'none',
                background: color.ink,
                color: color.paper,
                cursor: renumbering ? 'default' : 'pointer',
                opacity: renumbering ? 0.6 : 1,
              }}
            >
              <IconCheck size={16} />
            </button>
            <button
              onClick={() => {
                setEditingNumber(false)
                setNumberError(null)
              }}
              disabled={renumbering}
              style={{
                padding: '9px 14px',
                borderRadius: 9,
                border: `1px solid ${color.line}`,
                background: color.cardWhite,
                color: color.mutedInk,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Mégse
            </button>
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span style={bigNumberStyle}>#{box.id}</span>
            <button
              onClick={() => {
                setNumberDraft(String(box.id))
                setEditingNumber(true)
              }}
              title="Átszámozás"
              aria-label="Átszámozás"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 8,
                border: `1px solid ${color.line}`,
                background: 'transparent',
                color: color.softInk,
                cursor: 'pointer',
              }}
            >
              <IconPencil size={14} />
            </button>
          </span>
        )}
        {box.sealed && (
          <span
            style={{
              fontFamily: font.mono,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              border: `1.5px solid ${color.ink}`,
              borderRadius: 5,
              padding: '4px 10px',
              transform: 'rotate(-3deg)',
            }}
          >
            LEZÁRVA
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: font.mono, fontSize: 12.5, color: color.softInk }}>
          {packed.length} tárgy · {box.photos.length} fotó
        </span>
      </div>

      {editingNumber && (
        <div style={{ marginTop: -12, marginBottom: 20, fontSize: 13, color: numberError ? color.throw : color.softInk }}>
          {numberError ??
            'Írd át a számot arra, ami a dobozon szerepel — a benne lévő tárgyak követik.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* photos of the contents */}
        <div>
          <FieldLabel>Mi van benne · fotók</FieldLabel>
          <PhotoUploader
            photos={box.photos}
            onChange={(photos) => updateBox(box.id, { photos })}
            maxPhotos={8}
            maxDim={1024}
            quality={0.65}
            onPhotoClick={setLightboxUrl}
          />
        </div>

        <Field label="Címke">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => commit({ label })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="Pl. konyha — üvegek"
            style={inputStyle}
          />
        </Field>

        <Field label="Szoba">
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            onBlur={() => commit({ room })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="Pl. nappali"
            style={inputStyle}
          />
        </Field>

        <Field label="Jegyzet">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => commit({ note })}
            rows={2}
            placeholder="Pl. törékeny, felül maradjon"
            style={{ ...inputStyle, resize: 'vertical' as const }}
          />
        </Field>

        {/* sealed */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, borderTop: `1px solid ${color.hairlineSoft}`, paddingTop: 18 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Lezárva</div>
            <div style={{ fontSize: 12.5, color: color.softInk }}>Leragasztva, több nem kerül bele.</div>
          </div>
          <Toggle on={box.sealed} onClick={() => updateBox(box.id, { sealed: !box.sealed })} />
        </div>

        {/* packed items */}
        <div>
          <FieldLabel>Becsomagolt tárgyak</FieldLabel>
          {packed.length === 0 ? (
            <div style={{ fontSize: 13.5, color: color.faintInk }}>
              Még nincs tárgy ebben a dobozban. A leltárban egy Visszük tárgy adatlapján tudod ide tenni.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {packed.map((it) => (
                <button
                  key={it.id}
                  onClick={() => navigate(`/leltar/${it.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '9px 4px',
                    borderBottom: `1px solid ${color.hairlineSoft}`,
                    background: 'transparent',
                    border: 'none',
                    borderBottomStyle: 'solid',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'inherit',
                  }}
                >
                  <div style={{ width: 46, height: 36, borderRadius: 6, overflow: 'hidden', border: `1px solid ${color.line}`, flex: '0 0 auto' }}>
                    <PhotoPlaceholder caption="" aspect="46/36" photoUrl={it.photos[0]?.startsWith('data:') ? it.photos[0] : null} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{it.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* delete */}
        <div style={{ borderTop: `1px solid ${color.hairlineSoft}`, paddingTop: 18, marginTop: 4 }}>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: `1px solid ${hexA(color.throw, 0.5)}`,
                background: 'transparent',
                color: color.throw,
                fontSize: 13.5,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Doboz törlése
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, color: color.mutedInk }}>
                Ez végleges — a benne lévő tárgyak kikerülnek belőle, de megmaradnak.
              </span>
              <button
                onClick={async () => {
                  await removeBox(box.id)
                  navigate('/dobozok', { replace: true })
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: color.throw,
                  color: color.paper,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Törlöm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: `1px solid ${color.line}`,
                  background: color.cardWhite,
                  color: color.mutedInk,
                  fontSize: 13.5,
                  cursor: 'pointer',
                }}
              >
                Mégse
              </button>
            </div>
          )}
        </div>
      </div>

      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        background: 'transparent',
        border: 'none',
        color: color.mutedInk,
        fontSize: 13.5,
        cursor: 'pointer',
        padding: '4px 0',
        marginBottom: 14,
      }}
    >
      <IconArrowLeft size={16} />
      Vissza a dobozokhoz
    </button>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: font.mono,
        fontSize: 10.5,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: color.softInk,
        marginBottom: 9,
      }}
    >
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  )
}

const bigNumberStyle: React.CSSProperties = {
  fontFamily: font.mono,
  fontWeight: 700,
  fontSize: 'clamp(40px,8vw,56px)',
  letterSpacing: '-0.02em',
  lineHeight: 1,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 13px',
  borderRadius: 9,
  border: `1px solid ${color.line}`,
  background: color.cardWhite,
  fontSize: 15,
  outline: 'none',
}
