import { DISPOSITIONS, color, hexA, fmtHUF, font, type Disposition } from '../theme'

type Size = 'sm' | 'md' | 'lg'

interface Props {
  disposition: Disposition
  priceHUF?: number | null
  awaiting?: boolean
  stamped?: boolean
  /** Public/read-only never shows the unstamped (pending) state. */
  readOnly?: boolean
  size?: Size
  style?: React.CSSProperties
}

const SCALE: Record<Size, { fs: number; padY: number; padR: number; padL: number; gap: number; hole: number; holeL: number; radius: number }> = {
  sm: { fs: 10.5, padY: 6, padR: 11, padL: 22, gap: 8, hole: 8, holeL: 8, radius: 6 },
  md: { fs: 11.5, padY: 7, padR: 12, padL: 24, gap: 8, hole: 8.5, holeL: 8.5, radius: 6 },
  lg: { fs: 12, padY: 8, padR: 14, padL: 26, gap: 9, hole: 9, holeL: 9, radius: 7 },
}

// The signature luggage/shipping tag. Learn the colour language once:
// blue stays, green sells, amber gifts, brick goes. An unsigned removal reads
// as unstamped (dashed, muted); once approved it stamps solid.
export function DispositionTag({
  disposition,
  priceHUF,
  awaiting = false,
  stamped = true,
  readOnly = false,
  size = 'sm',
  style,
}: Props) {
  const d = DISPOSITIONS[disposition]
  const s = SCALE[size]
  const pending = !readOnly && awaiting && !stamped

  // Only sell items carry a price token; the give tag word already says it's free.
  let price: string | null = null
  if (disposition === 'sell') price = fmtHUF(priceHUF)

  const bg = pending ? hexA(d.color, 0.08) : d.color
  const fg = pending ? d.color : d.fg
  const border = pending ? `1.5px dashed ${d.color}` : `1px solid ${d.color}`

  return (
    <span
      role="img"
      aria-label={`${d.label}${price ? ', ' + price : ''}${pending ? ', jóváhagyásra vár' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        alignSelf: 'flex-start',
        padding: `${s.padY}px ${s.padR}px ${s.padY}px ${s.padL}px`,
        borderRadius: s.radius,
        position: 'relative',
        fontFamily: font.mono,
        fontSize: s.fs,
        fontWeight: 700,
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
        background: bg,
        color: fg,
        border,
        ...style,
      }}
    >
      {/* punched hole */}
      <span
        style={{
          position: 'absolute',
          left: s.holeL,
          top: '50%',
          transform: 'translateY(-50%)',
          width: s.hole,
          height: s.hole,
          borderRadius: '50%',
          background: color.paper,
          boxShadow: 'inset 0 0 0 1.5px rgba(22,32,46,0.3)',
        }}
      />
      <span>{d.word}</span>
      {price && <span style={{ opacity: 0.92 }}>{price}</span>}
      {pending && (
        <span style={{ opacity: 0.72, fontWeight: 400, letterSpacing: 0 }}>· függőben</span>
      )}
    </span>
  )
}
