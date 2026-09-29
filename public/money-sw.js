// Offline shell: cache app files, always go to network for the bank API.
const CACHE = 'money-v1'
const FILES = ['/money', '/money/app.js', '/money/style.css', '/money/manifest.webmanifest', '/money/icon-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url)
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/money')) return
  // network first (so updates arrive), cache as fallback when offline
  e.respondWith(
    fetch(e.request).then((r) => {
      const copy = r.clone()
      caches.open(CACHE).then((c) => c.put(e.request, copy))
      return r
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('/money')))
  )
})
