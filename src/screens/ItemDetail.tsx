import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { color, font, hexA, DISPOSITION_ORDER, DISPOSITIONS } from '../theme'
import { useStore } from '../store'
import { DispositionTag } from '../components/DispositionTag'
import { ApprovalStrip } from '../components/Approval'
import { Toggle } from '../components/AddItemSheet'
import { PhotoPlaceholder, Chip } from '../components/primitives'
import { Lightbox } from '../components/Lightbox'
import { NoteThread } from '../components/NoteThread'
import { IconArrowLeft } from '../components/icons'
import type { ItemStatus } from '../types'

const STATUS: [ItemStatus, string][] = [
  ['available', 'Elérhető'],
  ['reserved', 'Lefoglalva'],
  ['gone', 'Elment'],
]

export function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const items = useStore((s) => s.items)
  const setDisposition = useStore((s) => s.setDisposition)
  const setStatus = useStore((s) => s.setStatus)
  const togglePublished = useStore((s) => s.togglePublished)
  const updateItem = useStore((s) => s.updateItem)
  const removeItem = useStore((s) => s.removeItem)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const item = items.find((i) => i.id === Number(id))
  const [activePhoto, setActivePhoto] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [name, setName] = useState(item?.name ?? '')
  const [price, setPrice] = useState(item?.priceHUF != null ? String(item.priceHUF) : '')

  useEffect(() => {
    if (item) {
      setName(item.name)
      setPrice(item.priceHUF != null ? String(item.priceHUF) : '')
      setActivePhoto(0)
    }
  }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) {
    return (
      <div>
        <BackButton onClick={() => navigate('/leltar')} />
        <div style={{ color: color.softInk }}>Ez a tárgy nem található.</div>
      </div>
    )
  }

  const realPhotos = item.photos.filter((p) => p.startsWith('data:'))
  const isSell = item.disposition === 'sell'
  const publishable = item.disposition === 'sell' || item.disposition === 'give'
  const isGive = item.disposition === 'give'

  const commitName = () => {
    const v = name.trim()
    if (v && v !== item.name) updateItem(item.id, { name: v, cover: v })
    else if (!v) setName(item.name)
  }
  const commitPrice = () => {
    const n = parseInt(price.replace(/\D/g, ''), 10)
    const val = Number.isFinite(n) ? n : null
    if (val !== item.priceHUF) updateItem(item.id, { priceHUF: val })
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <BackButton onClick={() => navigate(-1)} />

      {/* photo(s) — tap opens the uncropped, full-screen view */}
      <button
        type="button"
        onClick={() => realPhotos[activePhoto] && setLightboxOpen(true)}
        aria-label="Fotó megnyitása nagyban"
        disabled={!realPhotos[activePhoto]}
        style={{
          display: 'block',
          width: '100%',
          padding: 0,
          border: 'none',
          background: 'transparent',
          borderRadius: 14,
          overflow: 'hidden',
          marginBottom: 10,
          cursor: realPhotos[activePhoto] ? 'zoom-in' : 'default',
        }}
      >
        <PhotoPlaceholder
          aspect="16/10"
          caption={item.cover}
          fontSize={13}
          photoUrl={realPhotos[activePhoto] ?? null}
        />
      </button>
      {lightboxOpen && realPhotos[activePhoto] && (
        <Lightbox url={realPhotos[activePhoto]} onClose={() => setLightboxOpen(false)} />
      )}
      {(realPhotos.length > 0 ? realPhotos : item.photos).length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          {(realPhotos.length > 0 ? realPhotos : item.photos).map((p, i) => (
            <button
              key={i}
              onClick={() => setActivePhoto(i)}
              aria-label={`Fotó ${i + 1}`}
              style={{
                width: 64,
                height: 52,
                borderRadius: 8,
                padding: 0,
                overflow: 'hidden',
                cursor: 'pointer',
                border: `1px solid ${i === activePhoto ? color.ink : color.line}`,
                background: color.photoBg,
                backgroundImage: p.startsWith('data:')
                  ? `url(${p})`
                  : 'repeating-linear-gradient(45deg,rgba(22,32,46,0.05) 0,rgba(22,32,46,0.05) 6px,transparent 6px,transparent 12px)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          ))}
        </div>
      )}
      {(realPhotos.length > 0 ? realPhotos : item.photos).length <= 1 && <div style={{ marginBottom: 22 }} />}

      {/* name + tag */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Tárgy neve"
          style={{
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: '-0.01em',
            flex: 1,
            minWidth: 200,
            border: '1px solid transparent',
            borderRadius: 8,
            padding: '2px 6px',
            margin: '-2px -6px',
            background: 'transparent',
            outline: 'none',
          }}
          onFocus={(e) => (e.target.style.borderColor = color.line)}
        />
        <DispositionTag disposition={item.disposition} priceHUF={item.priceHUF} awaiting={item.awaiting} stamped={item.stamped} size="lg" />
      </div>

      <ApprovalStrip item={item} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* disposition */}
        <div>
          <FieldLabel>Besorolás</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(84px,1fr))', gap: 8 }}>
            {DISPOSITION_ORDER.map((k) => {
              const d = DISPOSITIONS[k]
              const active = item.disposition === k
              return (
                <button
                  key={k}
                  onClick={() => setDisposition(item.id, k)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    padding: '11px 8px',
                    borderRadius: 9,
                    border: `1.5px solid ${active ? d.color : color.line}`,
                    background: active ? hexA(d.color, 0.08) : color.cardWhite,
                    color: color.ink,
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: d.color, display: 'inline-block' }} />
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* price (sell) */}
        {isSell && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid ${color.hairlineSoft}`, paddingBottom: 16 }}>
            <FieldLabel inline>Irányár</FieldLabel>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              inputMode="numeric"
              aria-label="Irányár forintban"
              style={{
                marginLeft: 'auto',
                textAlign: 'right',
                fontFamily: font.mono,
                fontWeight: 700,
                fontSize: 22,
                width: 160,
                border: `1px solid ${color.line}`,
                borderRadius: 8,
                padding: '6px 10px',
                background: color.cardWhite,
                outline: 'none',
              }}
            />
            <span style={{ fontFamily: font.mono, fontSize: 15, color: color.softInk }}>Ft</span>
          </div>
        )}

        {/* status */}
        <div>
          <FieldLabel>Állapot</FieldLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STATUS.map(([k, label]) => (
              <Chip key={k} active={item.status === k} onClick={() => setStatus(item.id, k)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>

        {/* publish */}
        {publishable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, borderTop: `1px solid ${color.hairlineSoft}`, paddingTop: 18 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Megjelenítés a publikus oldalon</div>
              <div style={{ fontSize: 12.5, color: color.softInk }}>A link birtokában bárki láthatja ezt a tárgyat.</div>
            </div>
            <Toggle on={item.published} onClick={() => togglePublished(item.id)} />
          </div>
        )}

        {/* private note thread — append-only, who wrote what, never public */}
        <NoteThread itemId={item.id} giveHint={isGive} />

        {/* delete — quiet entry, deliberate two-step confirm */}
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
              Tárgy törlése
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, color: color.mutedInk }}>
                Ez végleges — a fotókkal együtt eltűnik.
              </span>
              <button
                onClick={async () => {
                  await removeItem(item.id)
                  navigate('/leltar', { replace: true })
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
      Vissza a leltárhoz
    </button>
  )
}

function FieldLabel({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <div
      style={{
        fontFamily: font.mono,
        fontSize: 10.5,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: color.softInk,
        marginBottom: inline ? 0 : 9,
      }}
    >
      {children}
    </div>
  )
}
