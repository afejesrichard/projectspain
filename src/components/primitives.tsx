import { color, font, hexA } from '../theme'
import type { Assignee } from '../types'

// --- Chip (filter / segmented) ---------------------------------------------
export function Chip({
  active,
  onClick,
  children,
  color: accent,
}: {
  active: boolean
  onClick?: () => void
  children: React.ReactNode
  color?: string
}) {
  const a = accent || color.ink
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '8px 14px',
        borderRadius: 20,
        border: `1px solid ${active ? a : color.line}`,
        background: active ? a : color.cardWhite,
        color: active ? color.paper : color.mutedInk,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// --- Cross-hatch photo placeholder (prototype stand-in for a real photo) ----
export function PhotoPlaceholder({
  caption,
  radius = 0,
  aspect = '4/3',
  photoUrl,
  fontSize = 11,
  children,
}: {
  caption?: string
  radius?: number
  aspect?: string
  photoUrl?: string | null
  fontSize?: number
  children?: React.ReactNode
}) {
  const hatch = 'repeating-linear-gradient(45deg,rgba(22,32,46,0.04) 0,rgba(22,32,46,0.04) 8px,transparent 8px,transparent 16px)'
  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: aspect,
        borderRadius: radius,
        backgroundColor: color.photoBg,
        backgroundImage: photoUrl ? `url(${photoUrl})` : hatch,
        backgroundSize: photoUrl ? 'cover' : undefined,
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {!photoUrl && caption && (
        <span
          style={{
            fontFamily: font.mono,
            fontSize,
            color: '#8b8577',
            padding: '0 12px',
            textAlign: 'center',
          }}
        >
          {caption}
        </span>
      )}
      {children}
    </div>
  )
}

// --- Assignee chip ----------------------------------------------------------
export function AssigneeChip({ who }: { who: Assignee }) {
  const label = who === 'Both' ? 'Közös' : who
  const tint =
    who === 'Richard' ? color.keep : who === 'Dorka' ? color.give : color.softInk
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11.5,
        fontWeight: 500,
        color: color.mutedInk,
        background: hexA(tint, 0.1),
        border: `1px solid ${hexA(tint, 0.35)}`,
        borderRadius: 20,
        padding: '2px 9px',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: tint }} />
      {label}
    </span>
  )
}

// --- Status badge (Available / Reserved / Gone) -----------------------------
export function StatusBadge({ status }: { status: 'available' | 'reserved' | 'gone' }) {
  const map = {
    available: { label: 'Elérhető', c: color.sell },
    reserved: { label: 'Lefoglalva', c: color.give },
    gone: { label: 'Elment', c: color.softInk },
  } as const
  const m = map[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: font.mono,
        fontSize: 10.5,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: m.c,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.c }} />
      {m.label}
    </span>
  )
}

// --- Empty state (an invitation, in the interface's own voice) --------------
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      style={{
        border: `1px dashed ${color.line}`,
        borderRadius: 12,
        padding: '40px 24px',
        textAlign: 'center',
        background: hexA(color.line, 0.12),
      }}
    >
      <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 17 }}>{title}</div>
      {hint && <div style={{ color: color.softInk, marginTop: 6, fontSize: 13.5 }}>{hint}</div>}
    </div>
  )
}

// --- Skeleton building blocks ----------------------------------------------
export function Skeleton({ w, h, r = 6, style }: { w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="mf-skeleton" style={{ width: w ?? '100%', height: h ?? 14, borderRadius: r, ...style }} />
}

export function SkeletonCard() {
  return (
    <div style={{ border: `1px solid ${color.line}`, borderRadius: 12, overflow: 'hidden', background: color.cardWhite }}>
      <div className="mf-skeleton" style={{ aspectRatio: '4/3', borderRadius: 0 }} />
      <div style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton w="80%" h={15} />
        <Skeleton w={92} h={26} r={6} />
      </div>
    </div>
  )
}
