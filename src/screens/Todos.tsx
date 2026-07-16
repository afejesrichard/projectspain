import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { color, font, hexA } from '../theme'
import { useStore } from '../store'
import { PHASES } from '../data/constants'
import { useIsDesktop } from '../hooks/useMedia'
import { AssigneeChip, Chip } from '../components/primitives'
import { personName, otherPerson } from '../lib/people'
import { IconCheckSquare, IconPlus } from '../components/icons'
import type { Task, Phase, Assignee, Person } from '../types'

type WhoFilter = 'all' | 'mine' | 'other'
const FILTER_KEY = 'manifest-todo-filter'

// Task rows cycle assignee in a fixed absolute order.
const NEXT_ASSIGNEE: Record<Assignee, Assignee> = {
  Richard: 'Dorka',
  Dorka: 'Both',
  Both: 'Richard',
}

// Quick-add cycles relative to the current editor: Én → [másik] → Közös.
function nextAddAssignee(cur: Assignee, actingAs: Person): Assignee {
  const order: Assignee[] = [actingAs, otherPerson(actingAs), 'Both']
  const i = order.indexOf(cur)
  return order[(i + 1) % order.length]
}

function readFilter(): WhoFilter {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(FILTER_KEY) : null
  return v === 'mine' || v === 'other' ? v : 'all'
}

export function Todos() {
  const isDesktop = useIsDesktop()
  const [params, setParams] = useSearchParams()
  const tasks = useStore((s) => s.tasks)
  const actingAs = useStore((s) => s.actingAs)
  const other = otherPerson(actingAs)

  // Filter persists per device; a ?nezet=enyem deep-link (from the dashboard)
  // wins on arrival.
  const [who, setWho] = useState<WhoFilter>(() =>
    params.get('nezet') === 'enyem' ? 'mine' : readFilter(),
  )
  const [hideDone, setHideDone] = useState(false)
  // The quick-add target sticks across adds in a session; starts as "me".
  const [addAssignee, setAddAssignee] = useState<Assignee>(actingAs)

  // Clear the deep-link param once consumed, and persist the choice.
  useEffect(() => {
    if (params.get('nezet')) {
      const next = new URLSearchParams(params)
      next.delete('nezet')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, who)
    } catch {
      /* ignore */
    }
  }, [who])

  const isMine = (t: Task) => t.assignee === actingAs || t.assignee === 'Both'
  const matchesWho = (t: Task) => {
    if (who === 'all') return true
    if (who === 'mine') return isMine(t)
    return t.assignee === other || t.assignee === 'Both'
  }

  const openCount = tasks.filter((t) => !t.done).length
  const mineOpen = tasks.filter((t) => !t.done && isMine(t)).length

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
          Enyém · {mineOpen}
        </Chip>
        <Chip active={who === 'other'} onClick={() => setWho('other')}>
          {personName(other)}é
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
          <PhaseSection
            key={phase}
            phase={phase}
            matchesWho={matchesWho}
            hideDone={hideDone}
            actingAs={actingAs}
            addAssignee={addAssignee}
            onCycleAdd={() => setAddAssignee((a) => nextAddAssignee(a, actingAs))}
          />
        ))}
      </div>
    </div>
  )
}

function PhaseSection({
  phase,
  matchesWho,
  hideDone,
  actingAs,
  addAssignee,
  onCycleAdd,
}: {
  phase: Phase
  matchesWho: (t: Task) => boolean
  hideDone: boolean
  actingAs: Person
  addAssignee: Assignee
  onCycleAdd: () => void
}) {
  const tasks = useStore((s) => s.tasks)
  const addTask = useStore((s) => s.addTask)
  const [draft, setDraft] = useState('')

  const inPhase = tasks.filter((t) => t.phase === phase)
  const doneCount = inPhase.filter((t) => t.done).length
  const visible = inPhase.filter((t) => matchesWho(t) && (!hideDone || !t.done))

  const add = () => {
    if (!draft.trim()) return
    addTask(draft, phase, addAssignee)
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
        <AssigneeChip who={addAssignee} perspective={actingAs} onCycle={onCycleAdd} />
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
  const updateTask = useStore((s) => s.updateTask)
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

      <AssigneeChip who={task.assignee} onCycle={() => updateTask(task.id, { assignee: NEXT_ASSIGNEE[task.assignee] })} />
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
