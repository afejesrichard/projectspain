// Photo scaling on the client. Photos live inline in the database as base64
// data URLs, so every byte we store is a byte we pay to ship again on every
// load. Two sizes exist:
//   - the photo itself (≤1280px, ~150 KB) — fetched only when a detail screen
//     or lightbox actually needs it
//   - the thumb (≤THUMB_DIM px, ~10–20 KB) — the cover image on every card,
//     hydrated for the whole grid in one go
// INVARIANT [EGRESS-01] — grids and lists never fetch the `photos` column.
// The free Supabase plan gives 5.5 GB of egress a month; the full photo set
// is ~25 MB, so a couple of hundred app opens burned through it and the whole
// project got cut off. Cards read `thumb`; full photos are loaded per row on
// demand (`ensureItemPhotos` / `ensureBoxPhotos` in the store).

export const THUMB_DIM = 320
export const THUMB_QUALITY = 0.6

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })
}

// Downscale a data URL so its longest side is at most maxDim, re-encoded as
// JPEG. Returns the input untouched if the canvas is unavailable.
export async function scaleDataUrl(dataUrl: string, maxDim: number, quality: number): Promise<string> {
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

// The cover thumbnail for a photo list: the first real photo, scaled down.
// null when there is nothing to show or the browser can't render it — a
// missing thumb is only ever cosmetic, never a reason to fail a write.
export async function makeThumb(photos: string[]): Promise<string | null> {
  const first = photos.find((p) => p.startsWith('data:'))
  if (!first) return null
  if (typeof document === 'undefined') return null
  try {
    return await scaleDataUrl(first, THUMB_DIM, THUMB_QUALITY)
  } catch {
    return null
  }
}

// Which rows still need a thumbnail: they have photos but no thumb yet.
// Legacy rows from before thumbs existed, or rows whose thumb failed to
// render on the device that wrote them.
export function needsThumb(r: { thumb: string | null; photoCount: number }): boolean {
  return r.photoCount > 0 && !r.thumb
}
