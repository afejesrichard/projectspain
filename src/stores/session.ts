import { create } from 'zustand'
import type { Person } from '../types'
import { supabase } from '../lib/supabase'
import * as repo from '../data/repo'
import { clearTiles } from '../lib/tileCache'

// The only state the app touches before a tile is tapped: whether there is a
// session, and who is holding the device. No module data lives here
// (INVARIANT [LOAD-01]).

const ACTING_KEY = 'manifest-acting-as'

function readStoredActingAs(): Person | null {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTING_KEY) : null
  return v === 'Dorka' || v === 'Richard' ? v : null
}

// Module stores register a reset here when their chunk first loads, so signing
// out clears whatever modules were opened without this file importing them.
const resetters = new Set<() => void>()
export function onSignOut(reset: () => void): void {
  resetters.add(reset)
}
function resetModules() {
  for (const r of resetters) r()
  clearTiles()
}

interface SessionState {
  authed: boolean
  actingAs: Person
  // Whether this device has explicitly chosen who it is (welcome screen).
  identityChosen: boolean
  ready: boolean // initial session check finished

  init: () => void
  login: (password: string) => Promise<repo.SignInResult>
  logout: () => Promise<void>
  setActingAs: (p: Person) => void
}

let initialised = false

export const useSession = create<SessionState>((set, get) => ({
  authed: false,
  actingAs: readStoredActingAs() ?? 'Richard',
  identityChosen: readStoredActingAs() != null,
  ready: false,

  init: () => {
    if (initialised) return
    initialised = true
    supabase.auth.getSession().then(({ data }) => {
      set({ authed: !!data.session, ready: true })
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      const authed = !!session
      const wasAuthed = get().authed
      set({ authed })
      if (!authed && wasAuthed) resetModules()
    })
  },

  login: async (password) => {
    const result = await repo.signIn(password)
    if (result.ok) set({ authed: true })
    return result
  },

  logout: async () => {
    await repo.signOut()
    set({ authed: false })
    resetModules()
  },

  setActingAs: (p) => {
    try {
      localStorage.setItem(ACTING_KEY, p)
    } catch {
      /* ignore */
    }
    set({ actingAs: p, identityChosen: true })
  },
}))
