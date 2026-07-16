// Minimal line icons — 1.5px strokes in currentColor, matching the manifest's
// quiet, engineered feel. No filled/decorative glyphs.

interface IconProps {
  size?: number
  style?: React.CSSProperties
  strokeWidth?: number
}

function svgProps(size: number, strokeWidth: number, style?: React.CSSProperties) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    style,
  }
}

export function IconGrid({ size = 16, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function IconBox({ size = 16, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
    </svg>
  )
}

export function IconTag({ size = 16, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M3.5 8.5V5a1.5 1.5 0 0 1 1.5-1.5h3.5a2 2 0 0 1 1.4.6l9 9a1.8 1.8 0 0 1 0 2.5l-4.3 4.3a1.8 1.8 0 0 1-2.5 0l-9-9a2 2 0 0 1-.6-1.4Z" />
      <circle cx="7.2" cy="7.2" r="1.2" />
    </svg>
  )
}

export function IconStamp({ size = 16, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)} strokeDasharray="3 2.4">
      <rect x="3" y="4" width="18" height="16" rx="2" />
    </svg>
  )
}

export function IconPlus({ size = 16, style, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconSearch({ size = 15, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  )
}

export function IconCopy({ size = 15, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  )
}

export function IconCheck({ size = 14, style, strokeWidth = 2.4 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="m4 12.5 5 5 11-12" />
    </svg>
  )
}

export function IconArrowLeft({ size = 16, style, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M19 12H5m6-7-7 7 7 7" />
    </svg>
  )
}

export function IconCamera({ size = 22, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M4 8.5a2 2 0 0 1 2-2h1.6l1-1.6a1 1 0 0 1 .84-.46h3.12a1 1 0 0 1 .84.46l1 1.6H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  )
}

export function IconCheckSquare({ size = 18, style, strokeWidth = 1.6, checked = false }: IconProps & { checked?: boolean }) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      {checked && <path d="m7 12 3.2 3.2L17 8.4" strokeWidth={2.2} />}
    </svg>
  )
}
