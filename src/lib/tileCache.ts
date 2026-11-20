// The last figures each module saw, kept on this device so the home tiles can
// paint without asking the database anything (INVARIANT [LOAD-01]). Purely a
// convenience: an empty or blocked storage just means the tile shows its
// fallback text.

export type TileKey = 'moving' | 'receipts' | 'budget'

export interface TileFigures {
  moving: { items: number; boxes: number }
  receipts: { month: string; count: number }
  budget: { month: string; spentCents: number; budgetCents: number; verdict: 'good' | 'warn' | 'bad' }
}

const PREFIX = 'ps-tile:'

export function readTile<K extends TileKey>(key: K): TileFigures[K] | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as TileFigures[K]) : null
  } catch {
    return null
  }
}

export function writeTile<K extends TileKey>(key: K, value: TileFigures[K]): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage unavailable: the tile falls back to its label */
  }
}

export function clearTiles(): void {
  try {
    for (const k of ['moving', 'receipts', 'budget'] satisfies TileKey[]) localStorage.removeItem(PREFIX + k)
  } catch {
    /* ignore */
  }
}
