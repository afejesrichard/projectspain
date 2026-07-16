import { useEffect } from 'react'
import { color } from '../theme'

// Full-screen, uncropped photo view. Tap anywhere (or Escape) to close.
export function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fotó nagyban"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(22,32,46,0.93)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        cursor: 'zoom-out',
        animation: 'fadeIn 0.12s ease-out',
      }}
    >
      <img
        src={url}
        alt=""
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
      />
      <button
        onClick={onClose}
        aria-label="Bezárás"
        style={{
          position: 'fixed',
          top: 'calc(12px + env(safe-area-inset-top))',
          right: 16,
          width: 38,
          height: 38,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(246,244,239,0.14)',
          color: color.paper,
          fontSize: 22,
          lineHeight: 1,
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  )
}
