import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { color, font } from '../theme'
import { useStore } from '../store'

// Minimal login: one shared account, created by hand. No email, no signup.
export function Login() {
  const login = useStore((s) => s.login)
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<null | { kind: 'bad_password' } | { kind: 'unavailable'; message: string }>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await login(password)
    setBusy(false)
    if (result.ok) navigate('/', { replace: true })
    else if (result.reason === 'bad_password') setError({ kind: 'bad_password' })
    else setError({ kind: 'unavailable', message: result.message })
  }

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
      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div>
          <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em' }}>
            Project Spain
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 12, letterSpacing: '0.04em', color: color.softInk, marginTop: 4 }}>
            richard &amp; dorka · a költözés
          </div>
        </div>

        <div>
          <label
            htmlFor="pw"
            style={{
              display: 'block',
              fontFamily: font.mono,
              fontSize: 10.5,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: color.softInk,
              marginBottom: 8,
            }}
          >
            Jelszó
          </label>
          <input
            id="pw"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            style={{
              width: '100%',
              padding: '13px 14px',
              borderRadius: 10,
              border: `1px solid ${error ? color.throw : color.line}`,
              background: color.cardWhite,
              fontSize: 16,
              outline: 'none',
            }}
          />
          {error?.kind === 'bad_password' && (
            <div style={{ color: color.throw, fontSize: 12.5, marginTop: 8 }}>
              Nem stimmel a jelszó. Próbáld újra.
            </div>
          )}
          {error?.kind === 'unavailable' && (
            <div style={{ color: color.throw, fontSize: 12.5, marginTop: 8, lineHeight: 1.45 }}>
              A jelszó rendben lehet, de a szerver most nem elérhető. Nem a jelszóval van a baj.
              <div style={{ fontFamily: font.mono, fontSize: 11, color: color.softInk, marginTop: 6, wordBreak: 'break-word' }}>
                {error.message}
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: '14px 18px',
            borderRadius: 10,
            border: 'none',
            background: color.ink,
            color: color.paper,
            fontSize: 15,
            fontWeight: 600,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? 'Belépés…' : 'Belépés'}
        </button>
      </form>
    </div>
  )
}
