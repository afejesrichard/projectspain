import { useNavigate } from 'react-router-dom'
import { color, font, DISPOSITIONS, DISPOSITION_ORDER, fmtHUF } from '../theme'
import { useStore } from '../store'
import { PHASES, DAYS_TO_MOVE } from '../data/seed'
import { IconCopy, IconCheck } from '../components/icons'
import { Skeleton } from '../components/primitives'
import { useState } from 'react'

const PUBLIC_PATH = '/nyilvanos'

export function Dashboard() {
  const navigate = useNavigate()
  const items = useStore((s) => s.items)
  const tasks = useStore((s) => s.tasks)
  const loading = useStore((s) => s.loading)

  const total = tasks.length
  const done = tasks.filter((t) => t.done).length
  const pct = total ? Math.round((done / total) * 100) : 0
  const openTasks = total - done

  const phases = PHASES.map((name) => {
    const inPhase = tasks.filter((t) => t.phase === name)
    const d = inPhase.filter((t) => t.done).length
    return { name, done: d, total: inPhase.length, pct: inPhase.length ? Math.round((d / inPhase.length) * 100) : 0 }
  })

  const dispoCounts = DISPOSITION_ORDER.map((k) => ({
    key: k,
    label: DISPOSITIONS[k].label,
    color: DISPOSITIONS[k].color,
    count: items.filter((i) => i.disposition === k).length,
  }))

  const sellItems = items.filter((i) => i.disposition === 'sell')
  const sellPile = sellItems.reduce((a, i) => a + (i.priceHUF || 0), 0)
  const awaitingCount = items.filter((i) => i.awaiting && !i.stamped).length

  if (loading && items.length === 0) return <DashboardSkeleton />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: color.softInk }}>
            Irányítópult
          </div>
          <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 'clamp(52px,9vw,84px)', lineHeight: 0.95, letterSpacing: '-0.02em', marginTop: 6 }}>
            {pct}%
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 13, color: color.mutedInk, marginTop: 4 }}>
            {done} / {total} feladat kész · {DAYS_TO_MOVE} nap a költözésig
          </div>
        </div>
        <DashboardCopyButton path={PUBLIC_PATH} />
      </div>

      {/* Tasks by phase */}
      <div>
        <SectionRule>Feladatok szakaszonként</SectionRule>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
          {phases.map((p) => (
            <div key={p.name} style={{ border: `1px solid ${color.line}`, borderRadius: 10, background: color.cardWhite, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
              <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 26, marginTop: 8 }}>
                {p.done} / {p.total}
              </div>
              <div style={{ height: 4, borderRadius: 4, background: color.trackFill, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${p.pct}%`, background: color.keep, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 22 }}>
        {/* Items by disposition */}
        <div>
          <SectionRule>Tárgyak besorolás szerint</SectionRule>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dispoCounts.map((d) => (
              <button
                key={d.key}
                onClick={() => navigate(`/leltar?dispo=${d.key}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 4px',
                  borderBottom: `1px solid ${color.hairlineSoft}`,
                  background: 'transparent',
                  border: 'none',
                  borderBottomStyle: 'solid',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'inherit',
                }}
              >
                <span style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flex: '0 0 auto' }} />
                <span style={{ fontSize: 14 }}>{d.label}</span>
                <span style={{ marginLeft: 'auto', fontFamily: font.mono, fontWeight: 700, fontSize: 16 }}>{d.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Sell pile value */}
          <div style={{ border: `1px solid ${color.sell}`, borderRadius: 12, background: 'rgba(63,138,91,0.06)', padding: 18 }}>
            <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: color.sell }}>
              Eladó holmik értéke
            </div>
            <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 40, marginTop: 6, letterSpacing: '-0.01em' }}>
              {fmtHUF(sellPile) ?? '0 Ft'}
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 12, color: color.mutedInk, marginTop: 2 }}>
              {sellItems.length} eladásra kínált tárgy
            </div>
          </div>

          {/* Awaiting approval */}
          <button
            onClick={() => navigate('/jovahagyas')}
            style={{
              textAlign: 'left',
              border: `1.5px dashed ${color.give}`,
              borderRadius: 12,
              background: 'rgba(201,138,43,0.06)',
              padding: '16px 18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 30, color: color.give }}>{awaitingCount}</span>
            <span style={{ fontSize: 13.5, color: '#2c3a4b' }}>
              eltávolítás vár jóváhagyásra
              <br />
              <span style={{ color: color.softInk }}>Nézzétek át együtt →</span>
            </span>
          </button>
        </div>
      </div>

      {/* Quick entries */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <QuickEntry onClick={() => navigate('/leltar')} label="Leltár megnyitása" note={`${items.length} tárgy`} />
        <QuickEntry onClick={() => navigate('/feladatok')} label="Feladatok megnyitása" note={`${openTasks} nyitott`} />
      </div>
    </div>
  )
}

function SectionRule({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: font.mono,
        fontSize: 11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: color.softInk,
        paddingBottom: 10,
        borderBottom: `1px solid ${color.line}`,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  )
}

function QuickEntry({ onClick, label, note }: { onClick: () => void; label: string; note: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 150,
        border: `1px solid ${color.line}`,
        background: color.cardWhite,
        borderRadius: 10,
        padding: 16,
        textAlign: 'left',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      {label} <span style={{ color: color.softInk, fontWeight: 400 }}>· {note}</span>
    </button>
  )
}

function DashboardCopyButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + path)
    } catch {
      /* ignore */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
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
      {copied ? 'Link kimásolva' : 'Publikus link másolása'}
    </button>
  )
}

function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <Skeleton w={220} h={80} r={12} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} h={92} r={10} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 22 }}>
        <Skeleton h={220} r={10} />
        <Skeleton h={220} r={12} />
      </div>
    </div>
  )
}
