import { Fragment, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { color } from '../theme'
import type { ModuleLifecycle } from '../lib/moduleLifecycle'
import { useIsDesktop } from '../hooks/useMedia'
import { MODULES, parentOf, type ModuleId } from '../modules'

// The parent route of every module. Mounting it is what starts the module's
// load and live channel; unmounting stops the channel (INVARIANT [LOAD-01]).
// It stays mounted while moving between the module's own screens, so the
// channel is not torn down on every tap inside the module.
export function ModuleLayout({ id, lifecycle }: { id: ModuleId; lifecycle?: ModuleLifecycle }) {
  const location = useLocation()
  const isDesktop = useIsDesktop()

  useEffect(() => {
    if (!lifecycle) return
    return lifecycle.acquire()
  }, [lifecycle])

  const views = MODULES.find((m) => m.id === id)?.views ?? []
  // On desktop the sidebar already lists the views.
  const showTabs = !isDesktop && views.length > 1 && parentOf(location.pathname) == null

  return (
    <>
      {showTabs && (
        <nav
          aria-label="Nézetek"
          style={{
            display: 'flex',
            gap: 4,
            padding: 4,
            marginBottom: 20,
            borderRadius: 10,
            background: color.trackFill,
            width: 'fit-content',
            maxWidth: '100%',
            overflowX: 'auto',
          }}
        >
          {views.map((v) => (
            <NavLink key={v.to} to={v.to} end={v.end} style={tabStyle}>
              {v.label}
            </NavLink>
          ))}
        </nav>
      )}
      <Outlet />
    </>
  )
}

// Holds a lifecycle for a group of routes inside a module, when parts of the
// module need different data (Budget: month figures vs the receipts list).
// Moving between routes in the group keeps it held.
export function Hold({ lifecycle }: { lifecycle: ModuleLifecycle }) {
  useEffect(() => lifecycle.acquire(), [lifecycle])
  return <Outlet />
}

// A detail screen opened from another detail screen (item → box → item)
// starts with fresh state rather than the previous one's.
export function Keyed({ children }: { children: React.ReactNode }) {
  return <Fragment key={useLocation().pathname}>{children}</Fragment>
}

function tabStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    padding: '7px 14px',
    borderRadius: 7,
    fontSize: 13.5,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    background: isActive ? color.cardWhite : 'transparent',
    color: isActive ? color.ink : color.mutedInk,
    boxShadow: isActive ? '0 1px 2px rgba(22,32,46,0.12)' : 'none',
  }
}
