// Appli Ariadne hors ligne : le réseau d'abord, la dernière copie si le réseau manque (repris de Nutizie).
// Les réservations ne passent pas par ici : elles sont dans le navigateur (localStorage).
const CACHE = 'ariadne-resa-1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'app.css', 'app.js', '../js/demo-store.js', 'manifest.webmanifest', 'icones/icone-192.png',
    '../fonts/afacad-latin-var.woff2', '../fonts/playfair-500.woff2'])));
  self.skipWaiting();
});

self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('./') : Response.error()))));
});
