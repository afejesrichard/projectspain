import type { Person } from '../types'

// Display names. The stored/internal person value stays 'Richard' (it's baked
// into the database's fields); everywhere a human sees it, it reads "Ricsi".
export function personName(p: Person): string {
  return p === 'Richard' ? 'Ricsi' : 'Dorka'
}

export function otherPerson(p: Person): Person {
  return p === 'Richard' ? 'Dorka' : 'Richard'
}
