import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { color, font } from '../theme'
import { useStore } from '../store'
import { useIsDesktop } from '../hooks/useMedia'
import { IconGrid, IconBox, IconStamp, IconCopy, IconCheck, IconCheckSquare } from './icons'
import type { Person } from '../types'

import { publicShareUrl } from '../lib/shareUrl'

// --- Acting-as switch: not a security control, just whose name goes on a
// proposal and whose sign-off an approval represents. ------------------------
function ActingAsSwitch({ small = false }: { small?: boolean }) {
  const actingAs = useStore((s) => s.actingAs)
  const setActingAs = useStore((s) => s.setActingAs)
  const btn = (who: Person, active: boolean) => (
    <button
      key={who}
      onClick={() => setActingAs(who)}
      aria-pressed={active}
      style={{
        flex: 1,
        padding: small ? '5px 11px' : '7px 0',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        fontSize: 12.5,
        fontWeight: 600,
        background: active ? color.keep : 'transparent',
        color: active ? color.paper : color.shellMuted,
      }}
    >
      {who}
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: small ? 4 : 6, background: color.shellPanel, borderRadius: 8, padding: small ? 3 : 4 }}>
      {btn('Richard', actingAs === 'Richard')}
      {btn('Dorka', actingAs === 'Dorka')}
    </div>
  )
}

function CopyLinkButton({ variant }: { variant: 'shell' | 'solid' }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicShareUrl())
    } catch {
      /* clipboard blocked — the label still confirms intent */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  const label = copied ? 'Link kimásolva' : 'Publikus link másolása'
  if (variant === 'solid') {
    return (
      <button
        onClick={copy}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '13px 18px',
          borderRadius: 9,
          border: `1px solid ${color.ink}`,
          background: color.ink,
          color: color.paper,
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
        {label}
      </button>
    )
  }
  return (
    <button
      onClick={copy}
      style={{
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
      }}
    >
      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
      {label}
    </button>
  )
}

function CountBadge({ n, tone = 'amber' }: { n: number; tone?: 'amber' | 'small' }) {
  if (!n) return null
  return (
    <span
      style={{
        marginLeft: tone === 'amber' ? 'auto' : undefined,
        fontFamily: font.mono,
        fontSize: tone === 'amber' ? 11 : 10,
        fontWeight: 700,
        background: color.give,
        color: color.ink,
        borderRadius: 20,
        padding: tone === 'amber' ? '1px 8px' : '0 6px',
      }}
    >
      {n}
    </span>
  )
}

type NavItem = { to: string; label: string; short?: string; icon: string; end: boolean; badge?: boolean }

const NAV: NavItem[] = [
  { to: '/', label: 'Áttekintés', icon: 'grid', end: true },
  { to: '/leltar', label: 'Leltár', icon: 'box', end: false },
  { to: '/feladatok', label: 'Feladatok', icon: 'check', end: false },
  { to: '/jovahagyas', label: 'Jóváhagyásra vár', short: 'Jóváhagyás', icon: 'stamp', end: false, badge: true },
]

function NavIcon({ name }: { name: string }) {
  if (name === 'grid') return <IconGrid size={16} />
  if (name === 'box') return <IconBox size={16} />
  if (name === 'check') return <IconCheckSquare size={16} />
  return <IconStamp size={16} />
}

export function AppShell() {
  const isDesktop = useIsDesktop()
  const location = useLocation()
  const awaitingCount = useStore((s) => s.items.filter((i) => i.awaiting && !i.stamped).length)

  const contentPad = isDesktop ? '30px 34px 48px' : '18px 16px 28px'

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
          }}
        >
          <div style={{ padding: '6px 8px 18px' }}>
            <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 21, letterSpacing: '-0.01em' }}>
              Manifest
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: '0.04em', color: color.shellMuted, marginTop: 2 }}>
              richard &amp; dorka · a költözés
            </div>
          </div>

          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} style={navStyle}>
              <NavIcon name={n.icon} />
              {n.label}
              {n.badge && <CountBadge n={awaitingCount} />}
            </NavLink>
          ))}

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16 }}>
            <CopyLinkButton variant="shell" />
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
          </div>
        </aside>
      )}

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!isDesktop && (
          <header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 20,
              background: color.ink,
              color: color.paper,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18 }}>Manifest</div>
            <div style={{ marginLeft: 'auto', width: 168 }}>
              <ActingAsSwitch small />
            </div>
          </header>
        )}

        <div style={{ flex: 1, padding: contentPad, maxWidth: 1180, width: '100%', margin: '0 auto' }}>
          <Outlet key={location.pathname} />
        </div>

        {!isDesktop && (
          <nav
            style={{
              position: 'sticky',
              bottom: 0,
              zIndex: 20,
              background: color.ink,
              display: 'flex',
              padding: '8px 6px calc(8px + env(safe-area-inset-bottom))',
            }}
          >
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} style={tabStyle}>
                {n.short ?? n.label}
                {n.badge && <CountBadge n={awaitingCount} tone="small" />}
              </NavLink>
            ))}
          </nav>
        )}
      </main>
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

function tabStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '9px 4px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 11.5,
    fontWeight: 600,
    textDecoration: 'none',
    background: isActive ? color.shellHover : 'transparent',
    color: isActive ? color.paper : color.shellMuted,
  }
}
