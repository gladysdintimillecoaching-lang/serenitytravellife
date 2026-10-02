// Service worker : coque de l'application en cache pour un chargement instantané
// et un affichage minimal hors connexion. Les données (/api) ne sont jamais mises en cache.
const CACHE = 'multimono-v2';
const SHELL = ['/', '/styles.css', '/js/app.js', '/js/lib.js', '/js/views/shared.js', '/js/views/auth.js',
  '/js/views/member.js', '/js/views/admin.js', '/icons/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api')) return;
  // Réseau d'abord (toujours la dernière version), cache en secours
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))),
  );
});
