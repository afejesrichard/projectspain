// Installs the service worker that precaches the app shell, so repeat opens
// are instant and the app can be added to the home screen. Called only once
// someone is signed in: the public catalogue never registers it.
let started = false

export function startServiceWorker(): void {
  if (started || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  started = true
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {
      /* no service worker: the app still works, it just loads from the network */
    })
}
