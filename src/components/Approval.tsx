import { color, font } from '../theme'
import type { Item } from '../types'
import { useStore } from '../store'
import { DispositionTag } from './DispositionTag'
import { PhotoPlaceholder } from './primitives'
import { personName, otherPerson } from '../lib/people'

// Calm approval strip near the tag on the item detail screen.
export function ApprovalStrip({ item }: { item: Item }) {
  const actingAs = useStore((s) => s.actingAs)
  const approve = useStore((s) => s.approve)
  const sendBack = useStore((s) => s.sendBack)
  const pending = item.awaiting && !item.stamped
  if (!pending || !item.proposedBy) return null

  const canApprove = actingAs !== item.proposedBy
  const proposalLine = `${personName(item.proposedBy)} javasolta. Csak akkor számít, ha ${personName(otherPerson(item.proposedBy))} jóváhagyja.`
  const waitingLine = `Várunk, hogy ${personName(otherPerson(item.proposedBy))} jóváhagyja…`

  return (
    <div
      style={{
        border: `1px solid ${color.give}`,
        background: 'rgba(201,138,43,0.07)',
        borderRadius: 12,
        padding: '16px 18px',
        marginBottom: 22,
      }}
    >
      <div
        style={{
          fontFamily: font.mono,
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#a06f1f',
          marginBottom: 6,
        }}
      >
        Jóváhagyásra vár
      </div>
      <div style={{ fontSize: 14, color: '#2c3a4b' }}>{proposalLine}</div>

      {canApprove ? (
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            onClick={() => approve(item.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 20px',
              borderRadius: 8,
              border: 'none',
              background: color.sell,
              color: color.paper,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Jóváhagyom
          </button>
          <button
            onClick={() => sendBack(item.id)}
            style={{
              padding: '11px 18px',
              borderRadius: 8,
              border: `1px solid ${color.line}`,
              background: color.cardWhite,
              color: color.mutedInk,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Visszaküldöm
          </button>
        </div>
      ) : (
        <div style={{ fontFamily: font.mono, fontSize: 12.5, color: color.softInk, marginTop: 10 }}>
          {waitingLine}
        </div>
      )}
    </div>
  )
}

// Compact queue row — thumbnail, name, unstamped tag, proposer, actions.
export function ApprovalRow({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const actingAs = useStore((s) => s.actingAs)
  const approve = useStore((s) => s.approve)
  const sendBack = useStore((s) => s.sendBack)
  const flashId = useStore((s) => s.flashId)
  const canApprove = actingAs !== item.proposedBy

  return (
    <div
      className={flashId === item.id ? 'mf-flash' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 6px',
        borderBottom: `1px solid ${color.hairlineSoft}`,
        flexWrap: 'wrap',
      }}
    >
      <button
        onClick={onOpen}
        style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', width: 64, flex: '0 0 auto' }}
        aria-label={`${item.name} megnyitása`}
      >
        <div style={{ width: 64, height: 50, borderRadius: 8, overflow: 'hidden', border: `1px solid ${color.line}` }}>
          <PhotoPlaceholder caption={item.cover} aspect="64/50" fontSize={8} photoUrl={item.photos[0]?.startsWith('data:') ? item.photos[0] : null} />
        </div>
      </button>

      <button
        onClick={onOpen}
        style={{ flex: 1, minWidth: 140, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit' }}
      >
        <div style={{ fontSize: 14.5, fontWeight: 500 }}>{item.name}</div>
        <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.softInk, marginTop: 3 }}>
          {item.proposedBy ? `${personName(item.proposedBy)} javasolta` : ''}
        </div>
      </button>

      <DispositionTag disposition={item.disposition} priceHUF={item.priceHUF} awaiting stamped={false} size="sm" />

      {canApprove ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => approve(item.id)}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: 'none',
              background: color.sell,
              color: color.paper,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Jóváhagyom
          </button>
          <button
            onClick={() => sendBack(item.id)}
            style={{
              padding: '9px 14px',
              borderRadius: 8,
              border: `1px solid ${color.line}`,
              background: color.cardWhite,
              color: color.mutedInk,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Vissza
          </button>
        </div>
      ) : (
        <div style={{ fontFamily: font.mono, fontSize: 12, color: color.faintInk }}>a te javaslatod</div>
      )}
    </div>
  )
}
