// JuriskPro : cache des fichiers de l'application (démarrage rapide).
// Les données (Supabase) restent toujours en ligne et ne sont jamais mises en cache.
// Pensez à changer VERSION à chaque publication pour forcer la mise à jour du cache.
const VERSION = 'jp-v10';
const SHELL = [
  './', './index.html', './styles.css', './core.js', './catalogue.js', './app.js', './auth-gate.js', './supabase-config.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/logo-96.webp'
];
const CDN_STABLE = ['https://cdnjs.cloudflare.com/']; // versions figées : cache d'abord

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Bibliothèques CDN figées : cache d'abord.
  if (CDN_STABLE.some(p => req.url.startsWith(p))) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // Fichiers du site : affichage immédiat depuis le cache, mise à jour en arrière-plan.
  if (url.origin === location.origin) {
    event.respondWith(caches.open(VERSION).then(async cache => {
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      const net = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    }));
  }
  // Tout le reste (Supabase, polices, etc.) : réseau normal.
});
