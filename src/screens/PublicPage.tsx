import { useEffect, useState } from 'react'
import { color, font } from '../theme'
import { fetchPublicItemsLight, fetchPublicItemPhotos, type PublicItem } from '../data/repo'
import { DispositionTag } from '../components/DispositionTag'
import { Lightbox } from '../components/Lightbox'
import { PhotoPlaceholder, Skeleton } from '../components/primitives'

type Availability = 'all' | 'available' | 'reserved'

export function PublicPage() {
  const [items, setItems] = useState<PublicItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<Availability>('all')

  useEffect(() => {
    document.title = 'Project Spain — jó gazdát keresünk'
    let alive = true
    // Text and layout first, then hydrate photos, so the catalogue appears
    // almost instantly instead of waiting on inline base64 images.
    fetchPublicItemsLight()
      .then((data) => {
        if (!alive) return
        setItems(data)
        fetchPublicItemPhotos()
          .then((photosById) => {
            if (!alive) return
            setItems((prev) =>
              prev
                ? prev.map((i) => (photosById.has(i.id) ? { ...i, photos: photosById.get(i.id)! } : i))
                : prev,
            )
          })
          .catch(() => {
            /* keep placeholders */
          })
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  const all = items ?? []
  const matchesFilter = (i: PublicItem) =>
    filter === 'all' ||
    (filter === 'reserved' ? i.status === 'reserved' : i.status !== 'reserved')

  const reservedCount = all.filter((i) => i.status === 'reserved').length
  const availableCount = all.length - reservedCount

  const forSale = all.filter((i) => i.disposition === 'sell' && matchesFilter(i))
  const free = all.filter((i) => i.disposition === 'give' && matchesFilter(i))
  const nothing = items != null && items.length === 0
  // Everything is filtered out (but the catalogue itself isn't empty).
  const emptyAfterFilter = !nothing && all.length > 0 && forSale.length === 0 && free.length === 0

  return (
    <div style={{ minHeight: '100vh', background: color.paper, color: color.ink, fontFamily: font.body }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '40px 20px 64px' }}>
        <header style={{ marginBottom: 34 }}>
          <div style={{ fontFamily: font.mono, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: color.softInk }}>
            Project Spain
          </div>
          <h1 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 'clamp(28px,5vw,42px)', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '10px 0 0' }}>
            Költözünk, jó gazdát keresünk a holminknak
          </h1>
          <p style={{ fontSize: 15.5, color: color.mutedInk, marginTop: 12, maxWidth: 560 }}>
            Néhány szépen megőrzött darab új otthont keres. Nézz körül nyugodtan.
          </p>
        </header>

        {failed && (
          <div style={{ color: color.throw, fontSize: 14 }}>
            Most nem sikerült betölteni a listát. Frissítsd az oldalt egy kicsit később.
          </div>
        )}

        {items == null && !failed && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 18 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ border: `1px solid ${color.line}`, borderRadius: 14, overflow: 'hidden', background: color.cardWhite }}>
                <div className="mf-skeleton" style={{ aspectRatio: '4/3', borderRadius: 0 }} />
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <Skeleton w="75%" h={16} />
                  <Skeleton w="90%" h={12} />
                  <Skeleton w={96} h={26} />
                </div>
              </div>
            ))}
          </div>
        )}

        {nothing && (
          <div style={{ border: `1px dashed ${color.line}`, borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18 }}>Jelenleg nincs kirakva semmi.</div>
            <div style={{ color: color.softInk, marginTop: 6 }}>Nézz vissza később.</div>
          </div>
        )}

        {items != null && reservedCount > 0 && (
          <FilterBar
            value={filter}
            onChange={setFilter}
            counts={{ all: all.length, available: availableCount, reserved: reservedCount }}
          />
        )}

        {emptyAfterFilter && (
          <div style={{ border: `1px dashed ${color.line}`, borderRadius: 12, padding: '40px 24px', textAlign: 'center', marginTop: 24 }}>
            <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 17 }}>
              {filter === 'available' ? 'Most minden le van foglalva.' : 'Nincs ilyen darab.'}
            </div>
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{
                marginTop: 12,
                fontFamily: font.mono,
                fontSize: 12.5,
                color: color.mutedInk,
                background: 'transparent',
                border: `1px solid ${color.line}`,
                borderRadius: 999,
                padding: '7px 14px',
                cursor: 'pointer',
              }}
            >
              Összes mutatása
            </button>
          </div>
        )}

        {forSale.length > 0 && (
          <Section title="Eladó" accent={color.sell} count={forSale.length}>
            {forSale.map((it) => (
              <PublicCard key={it.id} item={it} />
            ))}
          </Section>
        )}

        {free.length > 0 && (
          <Section title="Ingyen elvihető" accent={color.give} count={free.length}>
            {free.map((it) => (
              <PublicCard key={it.id} item={it} />
            ))}
          </Section>
        )}
      </div>
    </div>
  )
}

function FilterBar({
  value,
  onChange,
  counts,
}: {
  value: Availability
  onChange: (v: Availability) => void
  counts: { all: number; available: number; reserved: number }
}) {
  const options: { key: Availability; label: string; count: number }[] = [
    { key: 'all', label: 'Összes', count: counts.all },
    { key: 'available', label: 'Elérhető', count: counts.available },
    { key: 'reserved', label: 'Lefoglalva', count: counts.reserved },
  ]
  return (
    <div
      role="group"
      aria-label="Szűrés elérhetőség szerint"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 26,
        alignItems: 'center',
      }}
    >
      <span
        style={{
          fontFamily: font.mono,
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: color.softInk,
          marginRight: 4,
        }}
      >
        Szűrés
      </span>
      {options.map((o) => {
        const active = value === o.key
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontFamily: font.body,
              fontSize: 13.5,
              fontWeight: 500,
              padding: '8px 14px',
              borderRadius: 999,
              cursor: 'pointer',
              border: `1px solid ${active ? color.ink : color.line}`,
              background: active ? color.ink : color.cardWhite,
              color: active ? color.paper : color.mutedInk,
              transition: 'background 0.12s, color 0.12s, border-color 0.12s',
            }}
          >
            {o.label}
            <span
              style={{
                fontFamily: font.mono,
                fontSize: 11,
                color: active ? color.paper : color.softInk,
                opacity: active ? 0.85 : 1,
              }}
            >
              {o.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Section({
  title,
  accent,
  count,
  children,
}: {
  title: string
  accent: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section style={{ marginTop: 34 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: `1px solid ${color.line}`, marginBottom: 18 }}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: accent }} />
        <h2 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 20, margin: 0 }}>{title}</h2>
        <span style={{ fontFamily: font.mono, fontSize: 13, color: color.softInk, marginLeft: 'auto' }}>{count} db</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 18 }}>{children}</div>
    </section>
  )
}

function PublicCard({ item }: { item: PublicItem }) {
  const photoUrl = item.photos.find((p) => p.startsWith('data:')) ?? null
  const reserved = item.status === 'reserved'
  const [open, setOpen] = useState(false)
  return (
    <div
      className="mf-card-cv"
      style={{
        position: 'relative',
        border: `1px solid ${color.line}`,
        borderRadius: 14,
        overflow: 'hidden',
        background: color.cardWhite,
        display: 'flex',
        flexDirection: 'column',
        // Reserved items recede so the still-available ones stand out.
        opacity: reserved ? 0.7 : 1,
      }}
    >
      {reserved && (
        <span
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 2,
            fontFamily: font.mono,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: color.paper,
            background: color.ink,
            borderRadius: 999,
            padding: '4px 9px',
          }}
        >
          LEFOGLALVA
        </span>
      )}
      <button
        type="button"
        onClick={() => photoUrl && setOpen(true)}
        aria-label={photoUrl ? 'Fotó megnyitása nagyban' : undefined}
        disabled={!photoUrl}
        style={{
          display: 'block',
          width: '100%',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: photoUrl ? 'zoom-in' : 'default',
          textAlign: 'inherit',
        }}
      >
        <PhotoPlaceholder caption={item.cover} photoUrl={photoUrl} />
      </button>
      {open && photoUrl && <Lightbox url={photoUrl} onClose={() => setOpen(false)} />}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.3 }}>{item.name}</div>
        {item.description && <div style={{ fontSize: 13.5, color: color.mutedInk, lineHeight: 1.4 }}>{item.description}</div>}
        <div style={{ marginTop: 'auto', paddingTop: 4 }}>
          <DispositionTag disposition={item.disposition} priceHUF={item.price_huf} readOnly size="md" />
        </div>
      </div>
    </div>
  )
}
