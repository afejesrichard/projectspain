import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useStore } from './store'
import { color, font } from './theme'

// Split every screen into its own chunk. The biggest win is the public
// catalogue: strangers opening the shared link no longer download the entire
// editor app, and the editor's own first paint only loads what each route needs.
const AppShell = lazy(() => import('./components/AppShell').then((m) => ({ default: m.AppShell })))
const Login = lazy(() => import('./screens/Login').then((m) => ({ default: m.Login })))
const Welcome = lazy(() => import('./screens/Welcome').then((m) => ({ default: m.Welcome })))
const Dashboard = lazy(() => import('./screens/Dashboard').then((m) => ({ default: m.Dashboard })))
const Inventory = lazy(() => import('./screens/Inventory').then((m) => ({ default: m.Inventory })))
const ItemDetail = lazy(() => import('./screens/ItemDetail').then((m) => ({ default: m.ItemDetail })))
const Todos = lazy(() => import('./screens/Todos').then((m) => ({ default: m.Todos })))
const Boxes = lazy(() => import('./screens/Boxes').then((m) => ({ default: m.Boxes })))
const BoxDetail = lazy(() => import('./screens/BoxDetail').then((m) => ({ default: m.BoxDetail })))
const ApprovalQueue = lazy(() =>
  import('./screens/ApprovalQueue').then((m) => ({ default: m.ApprovalQueue })),
)
const PublicPage = lazy(() => import('./screens/PublicPage').then((m) => ({ default: m.PublicPage })))

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
    <Suspense fallback={<Splash />}>
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
          <Route path="/dobozok" element={<Boxes />} />
          <Route path="/dobozok/:id" element={<BoxDetail />} />
          <Route path="/jovahagyas" element={<ApprovalQueue />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
