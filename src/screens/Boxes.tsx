import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { color, font, hexA } from '../theme'
import { useStore } from '../store'
import { EmptyState, Skeleton } from '../components/primitives'
import { IconPlus, IconSearch } from '../components/icons'
import type { Box } from '../types'

export function Boxes() {
  const navigate = useNavigate()
  const boxes = useStore((s) => s.boxes)
  const items = useStore((s) => s.items)
  const loading = useStore((s) => s.loading)
  const addBox = useStore((s) => s.addBox)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return boxes
    return boxes.filter(
      (b) =>
        b.label.toLowerCase().includes(q) ||
        b.room.toLowerCase().includes(q) ||
        String(b.id) === q.replace(/^#/, ''),
    )
  }, [boxes, query])

  const packedCount = (b: Box) => items.filter((i) => i.boxId === b.id).length

  const create = async () => {
    if (creating) return
    setCreating(true)
    const id = await addBox()
    setCreating(false)
    if (id != null) navigate(`/dobozok/${id}`)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 26, margin: 0, letterSpacing: '-0.01em' }}>Dobozok</h1>
        <span style={{ fontFamily: font.mono, fontSize: 13, color: color.softInk }}>
          {boxes.length} doboz · {boxes.filter((b) => b.sealed).length} lezárva
        </span>
        <button
          onClick={create}
          disabled={creating}
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
            cursor: creating ? 'default' : 'pointer',
          }}
        >
          <IconPlus size={16} />
          {creating ? 'Számozás…' : 'Új doboz'}
        </button>
      </div>

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
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: `1px solid ${color.line}`,
            background: color.cardWhite,
            borderRadius: 8,
            padding: '8px 12px',
            minWidth: 180,
            flex: 1,
            maxWidth: 340,
          }}
        >
          <IconSearch size={14} style={{ color: color.faintInk }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés címke, szoba vagy szám szerint"
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%' }}
          />
        </div>
      </div>

      {loading && boxes.length === 0 ? (
        <Grid>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} h={150} r={12} />
          ))}
        </Grid>
      ) : filtered.length === 0 ? (
        <div style={{ paddingTop: 12 }}>
          {boxes.length === 0 ? (
            <EmptyState title="Még nincs doboz." hint="Hozz létre egyet, írd a számát a dobozra, és fotózd, ami belekerül." />
          ) : (
            <EmptyState title="Nincs találat." hint="Próbálj másik keresést." />
          )}
        </div>
      ) : (
        <Grid>
          {filtered.map((b) => (
            <BoxCard key={b.id} box={b} itemCount={packedCount(b)} onOpen={() => navigate(`/dobozok/${b.id}`)} />
          ))}
        </Grid>
      )}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, paddingTop: 8 }}>
      {children}
    </div>
  )
}

function BoxCard({ box, itemCount, onOpen }: { box: Box; itemCount: number; onOpen: () => void }) {
  const photo = box.photos.find((p) => p.startsWith('data:')) ?? null
  const bits: string[] = []
  if (itemCount > 0) bits.push(`${itemCount} tárgy`)
  if (box.photos.length > 0) bits.push(`${box.photos.length} fotó`)

  return (
    <button
      onClick={onOpen}
      style={{
        textAlign: 'left',
        // Sealed boxes are "stamped": solid border. Open boxes stay dashed.
        border: box.sealed ? `1.5px solid ${color.ink}` : `1.5px dashed ${color.line}`,
        background: color.cardWhite,
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        color: 'inherit',
      }}
    >
      <div style={{ padding: '14px 14px 0', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontFamily: font.mono, fontWeight: 700, fontSize: 28, letterSpacing: '-0.01em' }}>#{box.id}</span>
        {box.sealed && (
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: font.mono,
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.08em',
              border: `1.5px solid ${color.ink}`,
              borderRadius: 4,
              padding: '2px 7px',
              transform: 'rotate(-3deg)',
            }}
          >
            LEZÁRVA
          </span>
        )}
      </div>
      <div style={{ padding: '4px 14px 12px', flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, minHeight: 18 }}>{box.label || <span style={{ color: color.faintInk }}>címke nélkül</span>}</div>
        <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.softInk, marginTop: 3 }}>
          {[box.room, ...bits].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>
      {photo && (
        <div
          style={{
            height: 74,
            backgroundImage: `url(${photo})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderTop: `1px solid ${hexA(color.line, 0.6)}`,
          }}
        />
      )}
    </button>
  )
}
