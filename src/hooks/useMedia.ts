import { useSyncExternalStore } from 'react'

// Phone-first: the editor breaks to the two-column / sidebar layout at 900px,
// matching the design mock's isDesktop threshold.
const QUERY = '(min-width: 900px)'

function subscribe(cb: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', cb)
  return () => mql.removeEventListener('change', cb)
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true, // SSR fallback: assume desktop
  )
}
