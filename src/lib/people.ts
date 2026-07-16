import type { Person, Assignee } from '../types'

// Display names. The stored/internal person value stays 'Richard' (it's baked
// into the database's approval fields); everywhere a human sees it, it reads
// "Ricsi".
export function personName(p: Person): string {
  return p === 'Richard' ? 'Ricsi' : 'Dorka'
}

export function otherPerson(p: Person): Person {
  return p === 'Richard' ? 'Dorka' : 'Richard'
}

// Absolute assignee label for task rows: Ricsi / Dorka / Közös.
export function assigneeLabel(a: Assignee): string {
  return a === 'Both' ? 'Közös' : personName(a)
}
