import { useMemo, useState } from 'react'
import { color, font, hexA } from '../theme'
import { useStore } from '../store'
import { personName } from '../lib/people'
import type { ItemNote } from '../types'

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  return d
    .toLocaleString('hu-HU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(/ /g, ' ')
}

function authorLabel(n: ItemNote): string {
  return n.author ? personName(n.author) : 'korábbi jegyzet'
}

function authorTint(n: ItemNote): string {
  if (n.author === 'Richard') return color.keep
  if (n.author === 'Dorka') return color.give
  return color.softInk
}

// Private note thread — append-only, author + timestamp, never public.
export function NoteThread({ itemId, giveHint }: { itemId: number; giveHint?: boolean }) {
  const allNotes = useStore((s) => s.notes)
  const addNote = useStore((s) => s.addNote)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const notes = useMemo(
    () =>
      allNotes
        .filter((n) => n.itemId === itemId)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id - b.id)),
    [allNotes, itemId],
  )

  const save = async () => {
    if (!draft.trim() || saving) return
    setSaving(true)
    await addNote(itemId, draft)
    setDraft('')
    setSaving(false)
  }

  return (
    <div style={{ border: `1px dashed ${color.line}`, borderRadius: 10, padding: '14px 16px', background: hexA(color.line, 0.14) }}>
      <div
        style={{
          fontFamily: font.mono,
          fontSize: 10.5,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: color.softInk,
          marginBottom: 10,
        }}
      >
        {giveHint ? 'Kié lesz · privát jegyzetek' : 'Privát jegyzetek'}
      </div>

      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ borderLeft: `2px solid ${hexA(authorTint(n), 0.5)}`, paddingLeft: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: authorTint(n) }}>{authorLabel(n)}</span>
                <span style={{ fontFamily: font.mono, fontSize: 10.5, color: color.faintInk }}>{fmtWhen(n.createdAt)}</span>
              </div>
              <div style={{ fontSize: 14, color: color.ink, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{n.body}</div>
            </div>
          ))}
        </div>
      )}

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
        }}
        rows={2}
        placeholder={giveHint ? 'Pl. A szomszéd Nagy családnak ígérve.' : 'Írj egy jegyzetet…'}
        style={{
          width: '100%',
          border: `1px solid ${color.line}`,
          borderRadius: 8,
          padding: '9px 11px',
          background: color.cardWhite,
          fontSize: 14,
          resize: 'vertical',
          outline: 'none',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <button
          onClick={save}
          disabled={!draft.trim() || saving}
          style={{
            padding: '9px 18px',
            borderRadius: 8,
            border: 'none',
            background: draft.trim() && !saving ? color.ink : color.line,
            color: color.paper,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: draft.trim() && !saving ? 'pointer' : 'default',
          }}
        >
          {saving ? 'Mentés…' : 'Mentés'}
        </button>
        <span style={{ fontSize: 11.5, color: color.faintInk }}>Soha nem jelenik meg a publikus oldalon.</span>
      </div>
    </div>
  )
}
