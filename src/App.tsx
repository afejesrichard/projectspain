import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useStore } from './store'
import { color, font } from './theme'
import { AppShell } from './components/AppShell'
import { Login } from './screens/Login'
import { Welcome } from './screens/Welcome'
import { Dashboard } from './screens/Dashboard'
import { Inventory } from './screens/Inventory'
import { ItemDetail } from './screens/ItemDetail'
import { Todos } from './screens/Todos'
import { ApprovalQueue } from './screens/ApprovalQueue'
import { PublicPage } from './screens/PublicPage'

function Splash() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: color.paper,
        color: color.softInk,
        fontFamily: font.mono,
        fontSize: 13,
        letterSpacing: '0.08em',
      }}
    >
      Project Spain…
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const ready = useStore((s) => s.ready)
  const authed = useStore((s) => s.authed)
  const identityChosen = useStore((s) => s.identityChosen)
  const location = useLocation()
  if (!ready) return <Splash />
  if (!authed) return <Navigate to="/belepes" replace state={{ from: location.pathname }} />
  // First login on this device: ask who is holding it before showing the app.
  if (!identityChosen) return <Welcome />
  return <>{children}</>
}

export default function App() {
  const init = useStore((s) => s.init)
  useEffect(() => {
    init()
  }, [init])

  return (
    <Routes>
      {/* Public catalogue — no login, the shareable page. */}
      <Route path="/nyilvanos" element={<PublicPage />} />

      {/* Login. */}
      <Route path="/belepes" element={<Login />} />

      {/* Editor app. */}
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/leltar" element={<Inventory />} />
        <Route path="/leltar/:id" element={<ItemDetail />} />
        <Route path="/feladatok" element={<Todos />} />
        <Route path="/jovahagyas" element={<ApprovalQueue />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
