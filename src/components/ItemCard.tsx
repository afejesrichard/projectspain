import { color, font } from '../theme'
import type { Item } from '../types'
import { DispositionTag } from './DispositionTag'
import { PhotoPlaceholder } from './primitives'

// Editor inventory card: cover photo, name, disposition tag, plus a small
// "published" indicator so we know at a glance what strangers can see.
export function ItemCard({ item, onOpen, flash }: { item: Item; onOpen: () => void; flash?: boolean }) {
  return (
    <button
      onClick={onOpen}
      className={flash ? 'mf-flash' : undefined}
      style={{
        textAlign: 'left',
        border: `1px solid ${color.line}`,
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
      <PhotoPlaceholder caption={item.cover} photoUrl={item.photos[0]?.startsWith('data:') ? item.photos[0] : null}>
        {item.published && (
          <span
            style={{
              position: 'absolute',
              top: 9,
              right: 9,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(246,244,239,0.94)',
              border: `1px solid ${color.line}`,
              borderRadius: 20,
              padding: '3px 9px',
              fontFamily: font.mono,
              fontSize: 9.5,
              letterSpacing: '0.05em',
              color: color.sell,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color.sell }} />
            PUBLIKUS
          </span>
        )}
        {item.status === 'reserved' && (
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
        {item.status === 'gone' && (
          <span
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(154,91,78,0.82)',
              color: color.paper,
              fontFamily: font.mono,
              fontSize: 11,
              letterSpacing: '0.08em',
              textAlign: 'center',
              padding: 5,
            }}
          >
            ELMENT
          </span>
        )}
      </PhotoPlaceholder>
      <div style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.3 }}>{item.name}</div>
        <DispositionTag
          disposition={item.disposition}
          priceHUF={item.priceHUF}
          awaiting={item.awaiting}
          stamped={item.stamped}
          size="sm"
        />
      </div>
    </button>
  )
}
