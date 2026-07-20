import { useRef, useState } from 'react'
import { color, font } from '../theme'
import { IconCamera, IconPlus } from './icons'

// Downscale + compress a picked image to a modest JPEG data URL so photos stay
// small enough to live inline in the row. Camera-first on mobile.
async function compress(file: File, maxDim = 1280, quality = 0.72): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(fr.result as string)
    fr.onerror = rej
    fr.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = dataUrl
  })
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

export function PhotoUploader({
  photos,
  onChange,
  maxPhotos = 3,
  maxDim = 1280,
  quality = 0.72,
  onPhotoClick,
}: {
  photos: string[]
  onChange: (photos: string[]) => void
  maxPhotos?: number
  maxDim?: number
  quality?: number
  /** When set, tapping a thumbnail opens it (e.g. in a lightbox). */
  onPhotoClick?: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const real = photos.filter((p) => p.startsWith('data:'))

  const pick = () => inputRef.current?.click()

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return
    setBusy(true)
    try {
      const added: string[] = []
      for (const f of Array.from(files).slice(0, maxPhotos)) {
        added.push(await compress(f, maxDim, quality))
      }
      onChange([...real, ...added].slice(0, maxPhotos))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = (idx: number) => onChange(real.filter((_, i) => i !== idx))

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
      {real.length === 0 ? (
        <button
          type="button"
          onClick={pick}
          style={{
            width: '100%',
            aspectRatio: '16/10',
            borderRadius: 12,
            border: `1.5px dashed ${color.line}`,
            background: color.photoBg,
            backgroundImage:
              'repeating-linear-gradient(45deg,rgba(22,32,46,0.04) 0,rgba(22,32,46,0.04) 10px,transparent 10px,transparent 20px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            color: color.mutedInk,
          }}
        >
          <IconCamera size={26} />
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>
            {busy ? 'Tömörítés…' : 'Fotó készítése vagy választása'}
          </span>
          <span style={{ fontFamily: font.mono, fontSize: 11, color: color.faintInk }}>
            {busy ? '' : `akár ${maxPhotos} kép`}
          </span>
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {real.map((p, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img
                src={p}
                alt={`fotó ${i + 1}`}
                onClick={onPhotoClick ? () => onPhotoClick(p) : undefined}
                style={{
                  width: 92,
                  height: 74,
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: `1px solid ${color.line}`,
                  cursor: onPhotoClick ? 'zoom-in' : undefined,
                  display: 'block',
                }}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Fotó törlése"
                style={{
                  position: 'absolute',
                  top: -7,
                  right: -7,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: 'none',
                  background: color.ink,
                  color: color.paper,
                  cursor: 'pointer',
                  fontSize: 13,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
          {real.length < maxPhotos && (
            <button
              type="button"
              onClick={pick}
              style={{
                width: 92,
                height: 74,
                borderRadius: 8,
                border: `1.5px dashed ${color.line}`,
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: color.mutedInk,
              }}
            >
              {busy ? <span style={{ fontFamily: font.mono, fontSize: 10 }}>…</span> : <IconPlus size={18} />}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
