import { useNavigate } from 'react-router-dom'
import { color, font } from '../theme'
import { useStore } from '../store'
import { ApprovalRow } from '../components/Approval'
import { EmptyState } from '../components/primitives'

export function ApprovalQueue() {
  const navigate = useNavigate()
  const items = useStore((s) => s.items)
  const waiting = items.filter((i) => i.awaiting && !i.stamped)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 26, margin: 0, letterSpacing: '-0.01em' }}>
          Jóváhagyásra vár
        </h1>
        <span style={{ fontFamily: font.mono, fontSize: 13, color: color.softInk }}>{waiting.length} tétel</span>
      </div>
      <p style={{ color: color.softInk, fontSize: 13.5, margin: '0 0 18px' }}>
        Közös ellenőrzőpont — minden eltávolítás, ami a másikatok jóváhagyására vár.
      </p>

      {waiting.length === 0 ? (
        <EmptyState title="Nincs semmi függőben." hint="Egyetértetek mindenben." />
      ) : (
        <div style={{ border: `1px solid ${color.line}`, borderRadius: 12, background: color.cardWhite, padding: '4px 14px' }}>
          {waiting.map((item) => (
            <ApprovalRow key={item.id} item={item} onOpen={() => navigate(`/leltar/${item.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}
