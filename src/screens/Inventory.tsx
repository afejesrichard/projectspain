import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { color, font } from '../theme'
import { useStore } from '../store'
import { ItemCard } from '../components/ItemCard'
import { AddItemSheet } from '../components/AddItemSheet'
import { Chip, EmptyState, SkeletonCard } from '../components/primitives'
import { IconPlus, IconSearch } from '../components/icons'

const FILTERS: [string, string][] = [
  ['Mind', 'all'],
  ['Marad', 'keep'],
  ['Eladó', 'sell'],
  ['Elajándékoz', 'give'],
  ['Kidob', 'throw'],
  ['Jóváhagyásra vár', 'awaiting'],
  ['Publikus', 'published'],
]

export function Inventory() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const items = useStore((s) => s.items)
  const loading = useStore((s) => s.loading)
  const flashId = useStore((s) => s.flashId)

  const filter = params.get('dispo') ?? 'all'
  const [query, setQuery] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)

  const setFilter = (v: string) => {
    const next = new URLSearchParams(params)
    if (v === 'all') next.delete('dispo')
    else next.set('dispo', v)
    setParams(next, { replace: true })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (q && !it.name.toLowerCase().includes(q)) return false
      if (filter === 'all') return true
      if (filter === 'awaiting') return it.awaiting && !it.stamped
      if (filter === 'published') return it.published
      return it.disposition === filter
    })
  }, [items, filter, query])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 26, margin: 0, letterSpacing: '-0.01em' }}>Leltár</h1>
        <span style={{ fontFamily: font.mono, fontSize: 13, color: color.softInk }}>{filtered.length} látható</span>
        <button
          onClick={() => setSheetOpen(true)}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 18px',
            borderRadius: 9,
            border: 'none',
            background: color.ink,
            color: color.paper,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <IconPlus size={16} />
          Új tárgy
        </button>
      </div>

      {/* sticky filter bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: color.paper,
          padding: '10px 0 12px',
          marginBottom: 6,
          borderBottom: `1px solid ${color.line}`,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {FILTERS.map(([label, v]) => (
          <Chip key={v} active={filter === v} onClick={() => setFilter(v)}>
            {label}
          </Chip>
        ))}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: `1px solid ${color.line}`,
            background: color.cardWhite,
            borderRadius: 8,
            padding: '8px 12px',
            minWidth: 180,
          }}
        >
          <IconSearch size={14} style={{ color: color.faintInk }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés"
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%' }}
          />
        </div>
      </div>

      {loading && items.length === 0 ? (
        <Grid>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </Grid>
      ) : filtered.length === 0 ? (
        <div style={{ paddingTop: 12 }}>
          {items.length === 0 ? (
            <EmptyState title="Még semmi sincs katalogizálva." hint="Fotózd le az elsőt." />
          ) : (
            <EmptyState title="Nincs találat erre a szűrőre." hint="Próbálj másik szűrőt vagy keresést." />
          )}
        </div>
      ) : (
        <Grid>
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} flash={flashId === item.id} onOpen={() => navigate(`/leltar/${item.id}`)} />
          ))}
        </Grid>
      )}

      <AddItemSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16, paddingTop: 8 }}>
      {children}
    </div>
  )
}
