/* Service worker — Pauta, versión 20261006-1101
   Página: primero la red (así llegan las versiones nuevas) y, sin conexión, la copia guardada.
   Íconos, manifiesto y fuentes: copia guardada. Datos (Supabase, UF): siempre por la red, nunca en caché. */
const CACHE = 'pauta-20261006-1101';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const same = u.origin === location.origin, fonts = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!same && !fonts) return;                       // API y servicios externos: directo a la red
  const BASE = new URL('./', self.registration.scope).pathname, EXCL = [];
  if (same && (!u.pathname.startsWith(BASE) || EXCL.some(x => u.pathname.startsWith(x)))) return;   // otra app del mismo sitio
  if (same && (u.pathname === BASE || u.pathname === BASE + 'index.html')) {
    e.respondWith(fetch(r, {cache: 'no-store'}).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
    if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
    return res; }).catch(() => hit)));
});
