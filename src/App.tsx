import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Keyed } from './components/ModuleLayout'
import { useSession } from './stores/session'
import { color, font } from './theme'

// Split every screen into its own chunk. Strangers opening the public link
// never download the editor, and each module's code, store and live channel
// arrive only when one of its routes is opened (INVARIANT [LOAD-01]).
const AppShell = lazy(() => import('./components/AppShell').then((m) => ({ default: m.AppShell })))
const Login = lazy(() => import('./screens/Login').then((m) => ({ default: m.Login })))
const Welcome = lazy(() => import('./screens/Welcome').then((m) => ({ default: m.Welcome })))
const Home = lazy(() => import('./screens/Home').then((m) => ({ default: m.Home })))

// Moving
const MovingModule = lazy(() => import('./screens/modules/MovingModule').then((m) => ({ default: m.MovingModule })))
const MovingOverview = lazy(() => import('./screens/MovingOverview').then((m) => ({ default: m.MovingOverview })))
const Inventory = lazy(() => import('./screens/Inventory').then((m) => ({ default: m.Inventory })))
const ItemDetail = lazy(() => import('./screens/ItemDetail').then((m) => ({ default: m.ItemDetail })))
const Boxes = lazy(() => import('./screens/Boxes').then((m) => ({ default: m.Boxes })))
const BoxDetail = lazy(() => import('./screens/BoxDetail').then((m) => ({ default: m.BoxDetail })))

// Budget
const BudgetModule = lazy(() => import('./screens/modules/BudgetModule').then((m) => ({ default: m.BudgetModule })))
const BudgetHold = lazy(() => import('./screens/modules/BudgetHold').then((m) => ({ default: m.BudgetHold })))
const ReceiptsHold = lazy(() => import('./screens/modules/ReceiptsHold').then((m) => ({ default: m.ReceiptsHold })))
const BudgetMonth = lazy(() => import('./screens/budget/BudgetMonth').then((m) => ({ default: m.BudgetMonth })))
const BudgetLines = lazy(() => import('./screens/budget/BudgetLines').then((m) => ({ default: m.BudgetLines })))
const Expenses = lazy(() => import('./screens/Expenses').then((m) => ({ default: m.Expenses })))
const ExpenseDetail = lazy(() => import('./screens/ExpenseDetail').then((m) => ({ default: m.ExpenseDetail })))

// Weekend
const WeekendModule = lazy(() => import('./screens/modules/WeekendModule').then((m) => ({ default: m.WeekendModule })))
const Weekend = lazy(() => import('./screens/weekend/Weekend').then((m) => ({ default: m.Weekend })))

// Flights
const FlightsModule = lazy(() => import('./screens/modules/FlightsModule').then((m) => ({ default: m.FlightsModule })))
const Flights = lazy(() => import('./screens/flights/Flights').then((m) => ({ default: m.Flights })))

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
  const ready = useSession((s) => s.ready)
  const authed = useSession((s) => s.authed)
  const identityChosen = useSession((s) => s.identityChosen)
  const location = useLocation()
  if (!ready) return <Splash />
  if (!authed) return <Navigate to="/belepes" replace state={{ from: location.pathname }} />
  // First login on this device: ask who is holding it before showing the app.
  if (!identityChosen) return <Welcome />
  return <>{children}</>
}

// Old #/kiadasok links (bookmarks, chat history) keep working.
function LegacyReceiptRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/koltsegvetes/nyugtak/${id ?? ''}`} replace />
}

export default function App() {
  const init = useSession((s) => s.init)
  useEffect(() => {
    init()
  }, [init])

  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        {/* Public catalogue: no login, the shareable page. */}
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
          <Route path="/" element={<Home />} />

          <Route element={<BudgetModule />}>
            {/* Month and Lines read budget_month(); the receipts views read
                the receipts list. Each half loads only its own data. */}
            <Route element={<BudgetHold />}>
              <Route path="/koltsegvetes" element={<BudgetMonth />} />
              <Route path="/koltsegvetes/sorok" element={<BudgetLines />} />
            </Route>
            <Route element={<ReceiptsHold />}>
              <Route path="/koltsegvetes/nyugtak" element={<Expenses />} />
              <Route
                path="/koltsegvetes/nyugtak/:id"
                element={
                  <Keyed>
                    <ExpenseDetail />
                  </Keyed>
                }
              />
            </Route>
          </Route>

          <Route element={<WeekendModule />}>
            <Route path="/hetvege" element={<Weekend />} />
          </Route>
          <Route element={<FlightsModule />}>
            <Route path="/repjegy" element={<Flights />} />
          </Route>

          <Route element={<MovingModule />}>
            <Route path="/koltozes" element={<MovingOverview />} />
            <Route path="/leltar" element={<Inventory />} />
            <Route
              path="/leltar/:id"
              element={
                <Keyed>
                  <ItemDetail />
                </Keyed>
              }
            />
            <Route path="/dobozok" element={<Boxes />} />
            <Route
              path="/dobozok/:id"
              element={
                <Keyed>
                  <BoxDetail />
                </Keyed>
              }
            />
          </Route>

          <Route path="/kiadasok" element={<Navigate to="/koltsegvetes/nyugtak" replace />} />
          <Route path="/kiadasok/:id" element={<LegacyReceiptRedirect />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
