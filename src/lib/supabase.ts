import { createClient } from '@supabase/supabase-js'

// Publishable (anon) key — safe to ship in the client. The editor still has to
// authenticate to touch the base tables; anon only reaches the public view.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://tclxgoydthnnzqkoqzek.supabase.co'
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'sb_publishable_aM6a2VC7gEf0hc2ll4eIFg_Dj2ysT_2'

// The shared account. Both people use one login; the screen only asks for the
// password and we supply this email behind the scenes.
export const EDITOR_EMAIL = 'manifest@move.local'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'manifest-auth',
  },
})
