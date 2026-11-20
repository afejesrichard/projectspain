// INVARIANT [LOAD-01] — no module fetches data or opens a live channel before
// its route mounts. A module store never loads itself at import time; its
// layout route acquires this lifecycle on mount and releases it on unmount.
//
// Reference counted, so a module that renders through several nested routes
// (or StrictMode's mount/unmount/mount in dev) subscribes once and tears down
// only when the last holder lets go. The channel is opened before the load so
// no change can slip through between the fetch and the subscription.

export interface ModuleLifecycle {
  acquire: () => () => void
  readonly active: boolean
}

export function createModuleLifecycle(opts: {
  load: () => unknown
  subscribe: () => () => void
}): ModuleLifecycle {
  let holders = 0
  let teardown: (() => void) | null = null

  return {
    acquire() {
      holders++
      if (holders === 1) {
        teardown = opts.subscribe()
        void opts.load()
      }
      let released = false
      return () => {
        if (released) return
        released = true
        holders--
        if (holders === 0 && teardown) {
          teardown()
          teardown = null
        }
      }
    },
    get active() {
      return holders > 0
    },
  }
}

// Collapses concurrent calls into one in-flight promise, so a fast remount
// does not fire the same set of queries twice.
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inflight: Promise<T> | null = null
  return () => {
    if (!inflight) {
      inflight = fn().finally(() => {
        inflight = null
      })
    }
    return inflight
  }
}
