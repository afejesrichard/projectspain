import { Suspense, useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { color, font } from '../theme'
import { useSession } from '../stores/session'
import { useIsDesktop } from '../hooks/useMedia'
import { IconCopy, IconCheck, IconArrowLeft, IconMenu, IconClose, IconHome, IconLogout, IconGuide } from './icons'
import { ModuleIcon } from './ModuleIcon'
import { MODULES, moduleFor, parentOf, type ModuleDef } from '../modules'
import { HelpSurface } from './Help'
import type { HelpEntry } from '../help/types'
import type { Person } from '../types'

import { publicShareUrl } from '../lib/shareUrl'
import { startServiceWorker } from '../lib/pwa'
import { personName } from '../lib/people'

// --- Acting-as switch: not a security control, just whose name goes on a
// proposal and whose sign-off an approval represents. ------------------------
function ActingAsSwitch() {
  const actingAs = useSession((s) => s.actingAs)
  const setActingAs = useSession((s) => s.setActingAs)
  const btn = (who: Person, active: boolean) => (
    <button
      key={who}
      onClick={() => setActingAs(who)}
      aria-pressed={active}
      style={{
        flex: 1,
        padding: '7px 0',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        fontSize: 12.5,
        fontWeight: 600,
        background: active ? color.keep : 'transparent',
        color: active ? color.paper : color.shellMuted,
      }}
    >
      {personName(who)}
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: 6, background: color.shellPanel, borderRadius: 8, padding: 4 }}>
      {btn('Richard', actingAs === 'Richard')}
      {btn('Dorka', actingAs === 'Dorka')}
    </div>
  )
}

const shellButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  justifyContent: 'center',
  padding: '11px 12px',
  borderRadius: 8,
  border: `1px solid ${color.shellBorderSoft}`,
  background: 'transparent',
  color: color.paper,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicShareUrl())
    } catch {
      /* clipboard blocked: the label still confirms intent */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={copy} style={shellButton}>
      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
      {copied ? 'Link kimásolva' : 'Publikus link másolása'}
    </button>
  )
}

function LogoutButton() {
  const logout = useSession((s) => s.logout)
  const navigate = useNavigate()
  return (
    <button
      onClick={async () => {
        await logout()
        navigate('/belepes', { replace: true })
      }}
      style={{ ...shellButton, border: 'none', color: color.shellMutedSoft }}
    >
      <IconLogout size={14} />
      Kijelentkezés
    </button>
  )
}

// The module list, shared by the desktop sidebar and the phone drawer. The
// current module's guide, if it has one, sits under its views.
function ModuleNav({ onGuide }: { onGuide: (m: ModuleDef) => void }) {
  const current = moduleFor(useLocation().pathname)
  return (
    <nav aria-label="Modulok" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <NavLink to="/" end style={navStyle}>
        <IconHome size={16} />
        Kezdőlap
      </NavLink>
      {MODULES.map((m) => {
        // A module with several views highlights the view, not its header.
        const hasViews = (m.views?.length ?? 0) > 1
        return (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <NavLink to={m.path} style={({ isActive }) => navStyle({ isActive: isActive && !hasViews })}>
              <ModuleIcon id={m.id} size={16} />
              {m.title}
            </NavLink>
            {hasViews &&
              m.views!.map((v) => (
                <NavLink key={v.to} to={v.to} end={v.end} style={subNavStyle}>
                  {v.label}
                </NavLink>
              ))}
            {m.guide && current?.id === m.id && (
              <button
                type="button"
                onClick={() => onGuide(m)}
                style={{ ...subNavStyle({ isActive: false }), border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Útmutató
              </button>
            )}
          </div>
        )
      })}
    </nav>
  )
}

function ShellFooter() {
  return (
    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16 }}>
      <CopyLinkButton />
      <div style={{ borderTop: `1px solid ${color.shellBorder}`, paddingTop: 14 }}>
        <div
          style={{
            fontFamily: font.mono,
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: color.shellMuted,
            marginBottom: 7,
          }}
        >
          Most én
        </div>
        <ActingAsSwitch />
      </div>
      <LogoutButton />
    </div>
  )
}

function Brand() {
  return (
    <NavLink to="/" style={{ padding: '6px 8px 18px', color: 'inherit', textDecoration: 'none' }}>
      <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 21, letterSpacing: '-0.01em' }}>Project Spain</div>
      <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: '0.04em', color: color.shellMuted, marginTop: 2 }}>
        richard &amp; dorka · barcelona
      </div>
    </NavLink>
  )
}

function Drawer({ open, onClose, onGuide }: { open: boolean; onClose: () => void; onGuide: (m: ModuleDef) => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,24,36,0.45)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menü"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(320px, 86vw)',
          background: color.ink,
          color: color.paper,
          display: 'flex',
          flexDirection: 'column',
          padding: '14px 16px calc(18px + env(safe-area-inset-bottom))',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Brand />
          <button onClick={onClose} aria-label="Menü bezárása" style={iconButton}>
            <IconClose />
          </button>
        </div>
        <ModuleNav onGuide={onGuide} />
        <ShellFooter />
      </div>
    </div>
  )
}

const iconButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  margin: -8,
  border: 'none',
  borderRadius: 8,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
}

function TopBar({ onMenu, onGuide }: { onMenu: () => void; onGuide: (m: ModuleDef) => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mod = moduleFor(pathname)
  const parent = parentOf(pathname)

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: color.ink,
        color: color.paper,
        padding: 'calc(10px + env(safe-area-inset-top)) 16px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        minHeight: 52,
      }}
    >
      {parent && (
        <button onClick={() => navigate(parent)} aria-label="Vissza" style={iconButton}>
          <IconArrowLeft size={20} />
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <NavLink
          to="/"
          style={{
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: mod ? 15 : 18,
            color: mod ? color.shellMutedSoft : color.paper,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Project Spain
        </NavLink>
        {mod && (
          <span
            style={{
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 18,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {mod.title}
          </span>
        )}
      </div>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18 }}>
        {mod?.guide && (
          <button onClick={() => onGuide(mod)} aria-label={`${mod.title}: útmutató`} style={iconButton}>
            <IconGuide />
          </button>
        )}
        <button onClick={onMenu} aria-label="Menü" style={iconButton}>
          <IconMenu />
        </button>
      </span>
    </header>
  )
}

export function AppShell() {
  const isDesktop = useIsDesktop()
  const { pathname } = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [guide, setGuide] = useState<HelpEntry | null>(null)

  // Any navigation, including one from inside the drawer, closes it.
  useEffect(() => setDrawerOpen(false), [pathname])

  // Signed in: precache the app shell for instant repeat opens and install.
  useEffect(() => startServiceWorker(), [])

  const openGuide = useCallback((m: ModuleDef) => {
    setDrawerOpen(false)
    m.guide?.().then(setGuide, () => {
      /* chunk failed to load (offline): nothing to show */
    })
  }, [])
  const closeGuide = useCallback(() => setGuide(null), [])

  const contentPad = isDesktop ? '30px 34px 48px' : '18px 16px calc(28px + env(safe-area-inset-bottom))'

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: color.paper,
        color: color.ink,
        fontFamily: font.body,
      }}
    >
      {isDesktop && (
        <aside
          style={{
            width: 248,
            flex: '0 0 248px',
            background: color.ink,
            color: color.paper,
            display: 'flex',
            flexDirection: 'column',
            padding: '22px 16px',
            gap: 6,
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          <Brand />
          <ModuleNav onGuide={openGuide} />
          <ShellFooter />
        </aside>
      )}

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!isDesktop && <TopBar onMenu={() => setDrawerOpen(true)} onGuide={openGuide} />}
        <div style={{ flex: 1, padding: contentPad, maxWidth: 1180, width: '100%', margin: '0 auto' }}>
          {/* The shell stays put while a module's chunk arrives. */}
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {!isDesktop && <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onGuide={openGuide} />}
      {guide && <HelpSurface entry={guide} onClose={closeGuide} />}
    </div>
  )
}

function navStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    width: '100%',
    textAlign: 'left',
    padding: '11px 12px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    textDecoration: 'none',
    background: isActive ? color.shellHover : 'transparent',
    color: isActive ? color.paper : color.shellMutedSoft,
  }
}

function subNavStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    display: 'block',
    padding: '8px 12px 8px 39px',
    borderRadius: 8,
    fontSize: 13.5,
    fontWeight: 500,
    textDecoration: 'none',
    background: isActive ? color.shellHover : 'transparent',
    color: isActive ? color.paper : color.shellMuted,
  }
}
