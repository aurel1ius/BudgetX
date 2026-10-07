// Goblin service worker: cache the app so it opens offline, refresh it in the background.
const CACHE = 'pocket-ledger-v58';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.open(CACHE).then(async cache => {
      try {
        const res = await Promise.race([fetch(req, { cache: 'no-cache' }), new Promise((_, rej) => setTimeout(rej, 3000))]);
        if (res && res.ok) { cache.put(req, res.clone()); return res; }
      } catch (err) {}
      return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('index.html')) || Response.error();
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { net.catch(() => {}); return hit; }
    const res = await net;
    return res || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
