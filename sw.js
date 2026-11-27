/* Service worker SI-PANTAU — cache aset statis; API GAS selalu ke jaringan */
const VERSI = 'sipantau-v1.2.9';
const ASET = ['./', './index.html', './css/app.css?v=1.2.9', './js/config.js?v=1.2.9', './js/core.js?v=1.2.9', './js/pages.js?v=1.2.9', './js/impor.js?v=1.2.9', './js/pengadaan.js?v=1.2.9', './js/progres.js?v=1.2.9',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(ASET)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSI).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Backend Apps Script & Google Drive: jangan pernah di-cache
  if (/script\.google(usercontent)?\.com$|accounts\.google\.com$|googleapis\.com$/.test(url.hostname) && !/fonts\.googleapis\.com$/.test(url.hostname) || url.pathname.endsWith('/exec')) return;
  // config.js: jaringan dulu (agar URL GAS baru langsung terpakai), cadangan cache
  if (url.origin === location.origin && /\/js\/config\.js/.test(url.pathname)) {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(VERSI).then((c) => c.put(req, cp)); return r; }).catch(() => caches.match(req)));
    return;
  }
  // Font Google & pustaka CDN: cache lalu perbarui di latar (stale-while-revalidate)
  if (/fonts\.(googleapis|gstatic)\.com$|cdnjs\.cloudflare\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(VERSI + '-ext').then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  // Aset aplikasi: cache dulu
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: false }).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok) { const cp = r.clone(); caches.open(VERSI).then((c) => c.put(req, cp)); }
      return r;
    }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
  }
});
