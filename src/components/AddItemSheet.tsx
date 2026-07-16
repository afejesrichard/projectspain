import { useEffect, useState } from 'react'
import { color, font, hexA, DISPOSITION_ORDER, DISPOSITIONS, type Disposition } from '../theme'
import { useStore } from '../store'
import { useIsDesktop } from '../hooks/useMedia'
import { PhotoUploader } from './PhotoUploader'
import type { ItemStatus } from '../types'

const REMOVAL: Disposition[] = ['sell', 'give', 'throw']

export function AddItemSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isDesktop = useIsDesktop()
  const addItem = useStore((s) => s.addItem)
  const actingAs = useStore((s) => s.actingAs)
  const other = actingAs === 'Richard' ? 'Dorka' : 'Richard'

  const [name, setName] = useState('')
  const [disposition, setDisposition] = useState<Disposition>('keep')
  const [priceHUF, setPriceHUF] = useState('')
  const [published, setPublished] = useState(false)
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // reset each time the sheet opens
  useEffect(() => {
    if (open) {
      setName('')
      setDisposition('keep')
      setPriceHUF('')
      setPublished(false)
      setDescription('')
      setPhotos([])
      setSaving(false)
    }
  }, [open])

  if (!open) return null

  const publishable = disposition === 'sell' || disposition === 'give'
  const isRemoval = REMOVAL.includes(disposition)
  const canSave = name.trim().length > 0 && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    const priceNum = disposition === 'sell' ? parseInt(priceHUF.replace(/\D/g, ''), 10) : NaN
    const id = await addItem({
      name: name.trim(),
      cover: name.trim(),
      photos,
      disposition,
      priceHUF: Number.isFinite(priceNum) ? priceNum : null,
      status: 'available' as ItemStatus,
      published: publishable ? published : false,
      privateNote: null,
      description: description.trim() || null,
    })
    if (id != null) onClose()
    else setSaving(false)
  }

  const panel: React.CSSProperties = isDesktop
    ? {
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100vh',
        width: 460,
        maxWidth: '100vw',
        borderLeft: `1px solid ${color.line}`,
        borderRadius: 0,
      }
    : {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '92vh',
        borderRadius: '18px 18px 0 0',
        animation: 'sheetUp 0.22s ease-out',
      }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Új tárgy hozzáadása"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(22,32,46,0.44)',
        zIndex: 60,
        display: 'flex',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: color.paper,
          color: color.ink,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          ...panel,
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: color.paper,
            padding: '18px 20px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: `1px solid ${color.line}`,
          }}
        >
          {!isDesktop && (
            <div style={{ position: 'absolute', top: 7, left: '50%', transform: 'translateX(-50%)', width: 38, height: 4, borderRadius: 4, background: color.line }} />
          )}
          <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 19, margin: 0 }}>Új tárgy</h2>
          <button
            onClick={onClose}
            aria-label="Bezárás"
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: color.mutedInk, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '18px 20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* photo first — matches how you actually work */}
          <PhotoUploader photos={photos} onChange={setPhotos} />

          <Field label="Név">
            <input
              autoFocus={isDesktop}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pl. Tölgyfa étkezőasztal"
              style={inputStyle}
            />
          </Field>

          <Field label="Besorolás">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(84px,1fr))', gap: 8 }}>
              {DISPOSITION_ORDER.map((k) => {
                const d = DISPOSITIONS[k]
                const active = disposition === k
                return (
                  <button
                    key={k}
                    onClick={() => setDisposition(k)}
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
          </Field>

          {disposition === 'sell' && (
            <Field label="Irányár (HUF)">
              <input
                value={priceHUF}
                onChange={(e) => setPriceHUF(e.target.value)}
                inputMode="numeric"
                placeholder="Pl. 85000"
                style={{ ...inputStyle, fontFamily: font.mono }}
              />
            </Field>
          )}

          {publishable && (
            <Field label="Rövid leírás (publikus)">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Egy mondat a vevőknek"
                style={inputStyle}
              />
            </Field>
          )}

          {publishable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Megjelenítés a publikus oldalon</div>
                <div style={{ fontSize: 12.5, color: color.softInk }}>A link birtokában bárki láthatja.</div>
              </div>
              <Toggle on={published} onClick={() => setPublished((v) => !v)} />
            </div>
          )}

          {isRemoval && (
            <div style={{ fontFamily: font.mono, fontSize: 12, color: color.softInk, lineHeight: 1.5 }}>
              Ez eltávolítás — {other} jóváhagyására vár, mielőtt véglegessé válik.
            </div>
          )}

          <button
            onClick={save}
            disabled={!canSave}
            style={{
              padding: '14px 18px',
              borderRadius: 10,
              border: 'none',
              background: canSave ? color.ink : color.line,
              color: color.paper,
              fontSize: 15,
              fontWeight: 600,
              cursor: canSave ? 'pointer' : 'default',
            }}
          >
            {saving ? 'Mentés…' : 'Mentés'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
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
        {label}
      </div>
      {children}
    </div>
  )
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      style={{
        width: 46,
        height: 27,
        borderRadius: 20,
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        marginLeft: 'auto',
        flex: '0 0 auto',
        background: on ? color.sell : color.line,
        transition: 'background 0.15s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 22 : 3,
          width: 21,
          height: 21,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s',
        }}
      />
    </button>
  )
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
