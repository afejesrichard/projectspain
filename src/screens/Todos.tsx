import { useState } from 'react'
import { color, font, hexA } from '../theme'
import { useStore } from '../store'
import { PHASES } from '../data/seed'
import { useIsDesktop } from '../hooks/useMedia'
import { AssigneeChip, Chip } from '../components/primitives'
import { IconCheckSquare, IconPlus } from '../components/icons'
import type { Task, Phase, Assignee } from '../types'

export function Todos() {
  const isDesktop = useIsDesktop()
  const tasks = useStore((s) => s.tasks)
  const actingAs = useStore((s) => s.actingAs)
  const other = actingAs === 'Richard' ? 'Dorka' : 'Richard'

  const [who, setWho] = useState<'all' | 'mine' | 'other'>('all')
  const [hideDone, setHideDone] = useState(false)

  const matchesWho = (t: Task) => {
    if (who === 'all') return true
    const target = who === 'mine' ? actingAs : other
    return t.assignee === target || t.assignee === 'Both'
  }

  const openCount = tasks.filter((t) => !t.done).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 26, margin: 0, letterSpacing: '-0.01em' }}>Feladatok</h1>
        <span style={{ fontFamily: font.mono, fontSize: 13, color: color.softInk }}>{openCount} nyitott</span>
      </div>

      {/* filter bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: color.paper,
          padding: '10px 0 12px',
          marginBottom: 12,
          borderBottom: `1px solid ${color.line}`,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <Chip active={who === 'all'} onClick={() => setWho('all')}>
          Mind
        </Chip>
        <Chip active={who === 'mine'} onClick={() => setWho('mine')}>
          Enyém
        </Chip>
        <Chip active={who === 'other'} onClick={() => setWho('other')}>
          {other}é
        </Chip>
        <button
          onClick={() => setHideDone((v) => !v)}
          aria-pressed={hideDone}
          style={{
            marginLeft: 'auto',
            padding: '8px 14px',
            borderRadius: 20,
            border: `1px solid ${hideDone ? color.ink : color.line}`,
            background: hideDone ? color.ink : color.cardWhite,
            color: hideDone ? color.paper : color.mutedInk,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Kész elrejtése
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? 'repeat(2, 1fr)' : '1fr',
          gap: isDesktop ? 26 : 22,
          alignItems: 'start',
        }}
      >
        {PHASES.map((phase) => (
          <PhaseSection key={phase} phase={phase} matchesWho={matchesWho} hideDone={hideDone} assignDefault={actingAs} />
        ))}
      </div>
    </div>
  )
}

function PhaseSection({
  phase,
  matchesWho,
  hideDone,
  assignDefault,
}: {
  phase: Phase
  matchesWho: (t: Task) => boolean
  hideDone: boolean
  assignDefault: Assignee
}) {
  const tasks = useStore((s) => s.tasks)
  const addTask = useStore((s) => s.addTask)
  const [draft, setDraft] = useState('')

  const inPhase = tasks.filter((t) => t.phase === phase)
  const doneCount = inPhase.filter((t) => t.done).length
  const visible = inPhase.filter((t) => matchesWho(t) && (!hideDone || !t.done))

  const add = () => {
    if (!draft.trim()) return
    addTask(draft, phase, assignDefault)
    setDraft('')
  }

  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingBottom: 8,
          borderBottom: `1px solid ${color.line}`,
          marginBottom: 8,
        }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{phase}</h2>
        <span style={{ marginLeft: 'auto', fontFamily: font.mono, fontSize: 12.5, color: color.softInk }}>
          {doneCount} / {inPhase.length}
        </span>
      </div>

      {/* add-a-task */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px 10px' }}>
        <IconPlus size={15} style={{ color: color.faintInk }} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Új feladat…"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5 }}
        />
      </div>

      {visible.length === 0 ? (
        <div style={{ color: color.faintInk, fontSize: 13, padding: '6px 4px' }}>
          {inPhase.length === 0 ? 'Itt még nincs feladat.' : 'Semmi sem látszik ezzel a szűrővel.'}
        </div>
      ) : (
        visible.map((t) => <TaskRow key={t.id} task={t} />)
      )}
    </section>
  )
}

function TaskRow({ task }: { task: Task }) {
  const toggleTask = useStore((s) => s.toggleTask)
  const flashId = useStore((s) => s.flashId)

  return (
    <div
      className={flashId === task.id ? 'mf-flash' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '9px 4px',
        borderBottom: `1px solid ${color.hairlineSoft}`,
      }}
    >
      <button
        onClick={() => toggleTask(task.id)}
        aria-pressed={task.done}
        aria-label={task.done ? 'Kész, visszavonás' : 'Késznek jelölés'}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: 0,
          color: task.done ? color.sell : color.faintInk,
          display: 'flex',
        }}
      >
        <span style={task.done ? { animation: 'tickPop 0.28s ease-out', display: 'flex' } : { display: 'flex' }}>
          <IconCheckSquare size={19} checked={task.done} />
        </span>
      </button>

      {task.priority === 'high' && !task.done && (
        <span title="Sürgős" style={{ width: 6, height: 6, borderRadius: '50%', background: color.give, flex: '0 0 auto' }} />
      )}

      <span
        style={{
          flex: 1,
          fontSize: 14,
          color: task.done ? color.faintInk : color.ink,
          textDecoration: task.done ? 'line-through' : 'none',
        }}
      >
        {task.title}
      </span>

      {task.due && !task.done && (
        <span style={{ fontFamily: font.mono, fontSize: 11.5, color: dueColor(task.due) }}>{fmtDue(task.due)}</span>
      )}

      <AssigneeChip who={task.assignee} />
    </div>
  )
}

function fmtDue(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }).replace(/ /g, ' ')
}

function dueColor(iso: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(iso + 'T00:00:00')
  const days = (due.getTime() - today.getTime()) / 86400000
  if (days < 0) return color.throw
  if (days <= 7) return color.give
  return hexA(color.mutedInk, 0.9)
}
