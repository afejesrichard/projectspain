import { useEffect, useState } from 'react'
import { color, font } from '../theme'
import { fetchPublicItems, type PublicItem } from '../data/repo'
import { DispositionTag } from '../components/DispositionTag'
import { PhotoPlaceholder, Skeleton } from '../components/primitives'

export function PublicPage() {
  const [items, setItems] = useState<PublicItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    document.title = 'Manifest — jó gazdát keresünk'
    let alive = true
    fetchPublicItems()
      .then((data) => alive && setItems(data))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  const forSale = items?.filter((i) => i.disposition === 'sell') ?? []
  const free = items?.filter((i) => i.disposition === 'give') ?? []
  const nothing = items != null && items.length === 0

  return (
    <div style={{ minHeight: '100vh', background: color.paper, color: color.ink, fontFamily: font.body }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '40px 20px 64px' }}>
        <header style={{ marginBottom: 34 }}>
          <div style={{ fontFamily: font.mono, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: color.softInk }}>
            Manifest
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
  return (
    <div
      style={{
        border: `1px solid ${color.line}`,
        borderRadius: 14,
        overflow: 'hidden',
        background: color.cardWhite,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <PhotoPlaceholder caption={item.cover} photoUrl={photoUrl}>
        {reserved && (
          <span
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(22,32,46,0.82)',
              color: color.paper,
              fontFamily: font.mono,
              fontSize: 11,
              letterSpacing: '0.08em',
              textAlign: 'center',
              padding: 5,
            }}
          >
            LEFOGLALVA
          </span>
        )}
      </PhotoPlaceholder>
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
