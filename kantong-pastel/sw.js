// Kantong service worker: network-first untuk app shell (update selalu masuk saat online),
// fallback ke cache saat offline. Request API (POST ke script.google.com) tidak disentuh.
const CACHE = 'kantong-pastel-v2';
const SHELL = ['./', 'index.html', 'styles.css', 'core.js', 'app.js', 'manifest.webmanifest',
  'fonts/nunito.woff2', 'icons/icon.svg', 'icons/icon-animated.svg', 'icons/icon-32.png', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(req, { signal: ctrl.signal, cache: 'no-cache' });
      clearTimeout(t);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (_) {
      return (await cache.match(req, { ignoreSearch: true })) ||
        (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
    }
  })());
});
