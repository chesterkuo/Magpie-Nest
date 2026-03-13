const CACHE_VERSION = 'magpie-v1'
const PRECACHE_URLS = ['/', '/index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Network-only for streaming and file endpoints
  if (url.pathname.startsWith('/api/stream') || url.pathname.startsWith('/api/file')) return

  // Cache-first for thumbnails
  if (url.pathname.startsWith('/api/thumb')) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(res => {
          const clone = res.clone()
          caches.open(CACHE_VERSION).then(c => c.put(event.request, clone))
          return res
        })
      )
    )
    return
  }

  // Network-first for API data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE_VERSION).then(c => c.put(event.request, clone))
          return res
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE_VERSION).then(c => c.put(event.request, clone))
        }
        return res
      })
    )
  )
})
