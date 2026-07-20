import type { Disposition } from './theme'

export type Person = 'Richard' | 'Dorka'

export type ItemStatus = 'available' | 'reserved' | 'gone'

export interface Item {
  id: number
  name: string
  cover: string // short descriptive caption for the cover photo placeholder
  photos: string[] // photo ids / data urls (placeholders in the prototype)
  disposition: Disposition
  priceHUF: number | null
  status: ItemStatus
  published: boolean
  awaiting: boolean // a removal proposed but not yet signed off
  stamped: boolean // approved (solid tag)
  proposedBy: Person | null
  privateNote: string | null // "who gets it" — never leaves the detail screen / public page
  description: string | null // one-line public description
  boxId: number | null // Visszük items only: the box they're packed in
}

// A numbered moving box. The id IS the number written on the physical box.
export interface Box {
  id: number
  label: string
  room: string
  note: string
  sealed: boolean
  photos: string[]
}

export interface ItemNote {
  id: number
  itemId: number
  author: Person | null // null = pre-existing note migrated from the old field
  body: string
  createdAt: string // ISO
}

export type Phase =
  | 'Ügyintézés'
  | 'Lakhatás'
  | 'Iskola'
  | 'Pénzügyek'
  | 'Csomagolás'
  | 'Általános'

export type Assignee = Person | 'Both'

export type Priority = 'low' | 'normal' | 'high'

export interface Task {
  id: number
  title: string
  phase: Phase
  assignee: Assignee
  due: string | null // ISO date
  priority: Priority
  done: boolean
}
