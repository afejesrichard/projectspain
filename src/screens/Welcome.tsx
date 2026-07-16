import { color, font } from '../theme'
import { useStore } from '../store'
import type { Person } from '../types'

// One-time (per device) identity choice after the first login. Not a security
// control — it decides whose name goes on proposals and whose sign-off an
// approval represents. The chosen person becomes this device's default; the
// acting-as switch in the shell can change it any time.
export function Welcome() {
  const setActingAs = useStore((s) => s.setActingAs)

  const choice = (who: Person, label: string) => (
    <button
      key={who}
      onClick={() => setActingAs(who)}
      style={{
        flex: 1,
        minWidth: 130,
        padding: '26px 20px',
        borderRadius: 14,
        border: `1.5px solid ${color.line}`,
        background: color.cardWhite,
        color: color.ink,
        fontFamily: font.display,
        fontWeight: 600,
        fontSize: 22,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      style={{
        minHeight: '100vh',
        background: color.paper,
        color: color.ink,
        fontFamily: font.body,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ fontFamily: font.mono, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: color.softInk }}>
          Project Spain
        </div>
        <h1 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 34, letterSpacing: '-0.02em', margin: '10px 0 8px' }}>
          Ki vagy?
        </h1>
        <p style={{ fontSize: 14.5, color: color.mutedInk, margin: '0 0 26px', lineHeight: 1.5 }}>
          Ez az eszköz mostantól a te nevedben javasol és hagy jóvá. Később bármikor átválthatsz a fejlécben.
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {choice('Dorka', 'Dorka')}
          {choice('Richard', 'Ricsi')}
        </div>
      </div>
    </div>
  )
}
