import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { color, font } from '../theme'
import { useIsDesktop } from '../hooks/useMedia'
import { IconClose } from './icons'
import { resolveHelp, type HelpBlock, type HelpEntry, type HelpMap } from '../help/types'

// INVARIANT [HELP-01] — no explanatory prose on a screen outside a help
// surface. A screen shows labels, numbers, state and controls; any sentence
// that explains how to read something, or why, opens from a <Help> button
// beside its section title (at most one per section) or from the module guide.
// Still allowed inline: a one-line empty state, an error, a status line, a
// destructive-action confirmation, a chart legend.

// Binds a module's help map so screens write <MovingHelp id="box.sealed" />
// with ids checked against that module's entries.
export function helpFor<M extends HelpMap>(map: M) {
  return function BoundHelp<K extends keyof M & string>({
    id,
    data,
  }: {
    id: K
    data?: M[K] extends (d: infer D) => HelpEntry ? D : never
  }) {
    return <Help entry={resolveHelp(map[id], data)} />
  }
}

export function Help({ entry }: { entry: HelpEntry }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => {
    setAnchor(null)
    buttonRef.current?.focus()
  }, [])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Súgó: ${entry.title}`}
        aria-haspopup="dialog"
        aria-expanded={anchor != null}
        onClick={(e) => {
          e.stopPropagation()
          setAnchor((a) => (a ? null : buttonRef.current!.getBoundingClientRect()))
        }}
        style={{
          // 30px hit area around a 22px circle, for thumbs.
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
          width: 30,
          height: 30,
          margin: -4,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          verticalAlign: 'middle',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 11,
            border: `1px solid ${color.line}`,
            background: anchor ? color.ink : color.cardWhite,
            color: anchor ? color.paper : color.mutedInk,
            fontFamily: font.mono,
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          ?
        </span>
      </button>
      {anchor && <HelpSurface entry={entry} anchor={anchor} trigger={buttonRef.current} onClose={close} />}
    </>
  )
}

// Phone: a bottom sheet. Desktop: a popover under the button, or a centred
// dialog for a long guide (no anchor).
export function HelpSurface({
  entry,
  anchor,
  trigger,
  onClose,
}: {
  entry: HelpEntry
  anchor?: DOMRect | null
  trigger?: HTMLElement | null
  onClose: () => void
}) {
  const isDesktop = useIsDesktop()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const popover = isDesktop && anchor != null
  const [pos, setPos] = useState<React.CSSProperties>({ visibility: 'hidden' })

  // Fixed popover placed against its button; recomputed when the page scrolls
  // or resizes so it stays attached instead of drifting or closing.
  const place = useCallback(() => {
    const r = trigger?.getBoundingClientRect() ?? anchor
    if (!r) return
    const width = Math.min(360, window.innerWidth - 24)
    const left = Math.min(Math.max(r.left - 14, 12), window.innerWidth - width - 12)
    const below = window.innerHeight - r.bottom - 20
    const above = r.top - 20
    if (below >= 220 || below >= above) {
      setPos({ top: r.bottom + 8, left, width, maxHeight: below })
    } else {
      setPos({ bottom: window.innerHeight - r.top + 8, left, width, maxHeight: above })
    }
  }, [trigger, anchor])

  useLayoutEffect(() => {
    if (popover) place()
  }, [popover, place])

  useEffect(() => {
    // preventScroll: focusing must not move the page under the surface.
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    if (popover) {
      const onDown = (e: MouseEvent) => {
        const t = e.target as Node
        if (panelRef.current?.contains(t) || trigger?.contains(t)) return
        onClose()
      }
      let frame = 0
      const onMove = () => {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(place)
      }
      document.addEventListener('mousedown', onDown)
      window.addEventListener('scroll', onMove, true)
      window.addEventListener('resize', onMove)
      return () => {
        cancelAnimationFrame(frame)
        window.removeEventListener('keydown', onKey)
        document.removeEventListener('mousedown', onDown)
        window.removeEventListener('scroll', onMove, true)
        window.removeEventListener('resize', onMove)
      }
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [popover, onClose, trigger, place])

  const header = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
      <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: popover ? 16 : 19, margin: 0, flex: 1, lineHeight: 1.25 }}>
        {entry.title}
      </h2>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Bezárás"
        style={{
          display: 'inline-flex',
          border: 'none',
          background: 'transparent',
          color: color.mutedInk,
          cursor: 'pointer',
          padding: 4,
          margin: -4,
        }}
      >
        <IconClose size={18} />
      </button>
    </div>
  )

  if (popover) {
    return createPortal(
      <div
        ref={panelRef}
        role="dialog"
        aria-label={entry.title}
        style={{
          position: 'fixed',
          zIndex: 60,
          overflowY: 'auto',
          background: color.cardWhite,
          color: color.ink,
          border: `1px solid ${color.line}`,
          borderRadius: 12,
          boxShadow: '0 12px 32px rgba(22,32,46,0.18)',
          padding: '14px 16px 16px',
          fontFamily: font.body,
          ...pos,
        }}
      >
        {header}
        <HelpBody blocks={entry.body} />
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,24,36,0.45)' }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={entry.title}
        style={{
          position: 'relative',
          width: isDesktop ? 'min(640px, calc(100vw - 48px))' : '100%',
          maxHeight: isDesktop ? 'calc(100vh - 96px)' : '82vh',
          overflowY: 'auto',
          background: color.paper,
          color: color.ink,
          borderRadius: isDesktop ? 16 : '16px 16px 0 0',
          padding: isDesktop ? '22px 26px 26px' : '22px 18px calc(24px + env(safe-area-inset-bottom))',
          fontFamily: font.body,
          boxShadow: '0 -8px 28px rgba(22,32,46,0.2)',
        }}
      >
        {!isDesktop && (
          <div
            aria-hidden
            style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 38, height: 4, borderRadius: 4, background: color.line }}
          />
        )}
        {header}
        <HelpBody blocks={entry.body} />
      </div>
    </div>,
    document.body,
  )
}

function HelpBody({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.55, color: color.mutedInk }}>
      {blocks.map((b, i) => {
        if (typeof b === 'string') return <p key={i} style={{ margin: 0 }}>{b}</p>
        if ('heading' in b) {
          return (
            <h3
              key={i}
              style={{
                margin: i === 0 ? 0 : '8px 0 0',
                fontFamily: font.mono,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: color.softInk,
              }}
            >
              {b.heading}
            </h3>
          )
        }
        return (
          <ul key={i} style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {b.list.map((li, j) => (
              <li key={j}>{li}</li>
            ))}
          </ul>
        )
      })}
    </div>
  )
}
