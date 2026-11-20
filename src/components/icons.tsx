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

export function IconPackage({ size = 16, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M12 6v4" />
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

export function IconPencil({ size = 15, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M4 20h4L20.5 7.5a2.1 2.1 0 0 0-3-3L5 17Z" />
      <path d="m13.5 6.5 4 4" />
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

export function IconImage({ size = 22, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m4 17 4.5-4.5a1.5 1.5 0 0 1 2.1 0L16 18M14 15l1.5-1.5a1.5 1.5 0 0 1 2.1 0L20 16" />
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

// A till receipt: torn bottom edge, ruled lines.
export function IconReceipt({ size = 16, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M6 3h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 20V3Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
    </svg>
  )
}

export function IconDownload({ size = 15, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M12 4v10" />
      <path d="m8 10.5 4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  )
}

export function IconUpload({ size = 15, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M12 14V4" />
      <path d="m8 7.5 4-4 4 4" />
      <path d="M5 19h14" />
    </svg>
  )
}

export function IconMenu({ size = 20, style, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  )
}

export function IconClose({ size = 20, style, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  )
}

export function IconHome({ size = 16, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 9.5V20h12V9.5" />
    </svg>
  )
}

// A wallet with its clasp: the Budget module.
export function IconWallet({ size = 16, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M16 13.5h1.5" />
    </svg>
  )
}

// Sun over a horizon line: the Weekend module.
export function IconSun({ size = 16, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M7 16a5 5 0 0 1 10 0" />
      <path d="M3 19h18" />
      <path d="M12 5v3" />
      <path d="m5.6 9.6 2 1.6" />
      <path d="m18.4 9.6-2 1.6" />
    </svg>
  )
}

export function IconPlane({ size = 16, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  )
}

export function IconLogout({ size = 15, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgProps(size, strokeWidth, style)}>
      <path d="M14 4H6v16h8" />
      <path d="M10 12h10" />
      <path d="m17 8.5 3.5 3.5-3.5 3.5" />
    </svg>
  )
}
