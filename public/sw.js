const CACHE = 'nexa-v__BUILD_VERSION__'
const PRECACHE = ['./', './offline.html', './manifest.webmanifest', './favicon.svg', './icons/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined),
  )
  // A freshly deployed build takes over right away instead of sitting in the
  // waiting state while the open tab keeps running stale, now-purged chunks.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Hashed assets are always revalidated against the network: a cached URL
  // that a later deploy purged would otherwise 404 and break lazy routes.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached
          if (request.mode !== 'navigate') return undefined
          // This build's own shell first, then the offline page — the cache is
          // versioned per deploy, so a cached shell can never be stale.
          return caches.match('./').then((shell) => shell ?? caches.match('./offline.html'))
        }),
      ),
  )
})
