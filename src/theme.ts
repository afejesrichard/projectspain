// Design tokens for Manifest — a shipping-desk palette.
// The four disposition colours are the ONLY accents in the app.

export const color = {
  ink: '#16202E', // near-black blue: primary text + app shell
  paper: '#F6F4EF', // cool off-white base background
  line: '#C9CBBE', // muted sage-grey hairlines, dividers, table rules

  // The disposition four — tag colours and category accents.
  keep: '#2F6F8F', // steel blue: staying with us
  sell: '#3F8A5B', // money green
  give: '#C98A2B', // amber: warm, generous
  throw: '#9A5B4E', // muted brick-red, deliberately un-alarming

  // Supporting neutrals derived from ink/paper (not new accents).
  shellPanel: '#0f1824',
  shellHover: '#26344a',
  shellBorder: '#263243',
  shellBorderSoft: '#37455a',
  mutedInk: '#4c5765',
  softInk: '#6b7686',
  faintInk: '#9aa4b0',
  shellMuted: '#8f9bab',
  shellMutedSoft: '#a9b4c2',
  cardWhite: '#ffffff',
  hairlineSoft: '#e7e5de',
  trackFill: '#eae8e1',
  photoBg: '#e9e7e0',
} as const

export const font = {
  display: "'Space Grotesk', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'Space Mono', ui-monospace, monospace",
} as const

// Disposition metadata: word (mono caps), colour, label, foreground on solid fill.
export type Disposition = 'keep' | 'sell' | 'give' | 'throw'

export const DISPOSITIONS: Record<
  Disposition,
  { word: string; color: string; fg: string; label: string; short: string }
> = {
  keep: { word: 'VISSZÜK', color: color.keep, fg: color.paper, label: 'Visszük', short: 'Visszük' },
  sell: { word: 'ELADÓ', color: color.sell, fg: color.paper, label: 'Eladó', short: 'Eladó' },
  give: { word: 'ELAJÁNDÉK', color: color.give, fg: color.ink, label: 'Elajándékoz', short: 'Elaján.' },
  throw: { word: 'KIDOB', color: color.throw, fg: color.paper, label: 'Kidob', short: 'Kidob' },
}

export const DISPOSITION_ORDER: Disposition[] = ['keep', 'sell', 'give', 'throw']

// Only Sell, Give away, and Throw away pass through the unstamped (approval) state.
export const REMOVAL_DISPOSITIONS: Disposition[] = ['sell', 'give', 'throw']

export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

export function fmtHUF(n: number | null | undefined): string | null {
  if (n == null) return null
  return Number(n).toLocaleString('hu-HU').replace(/ /g, ' ') + ' Ft'
}
