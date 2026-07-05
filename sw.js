const CACHE_NAME = 'xai-chat-v2';
const API_URL = 'https://xai-fawn-delta.vercel.app/api/xai_chat';

// Fichiers à cacher pour offline
const STATIC_ASSETS = [
  '/',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  console.log('[SW] Install');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Activate');
  e.waitUntil(
    caches.keys().then(keys => 
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // 1. Stratégie Network First pour l'API
  if (url.href.includes(API_URL)) {
    e.respondWith(
      fetch(request)
        .then(res => {
          // Clone et cache la réponse si OK
          if (res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, resClone));
          }
          return res;
        })
        .catch(() => {
          // Fallback sur le cache si offline
          return caches.match(request).then(cached => {
            return cached || new Response(JSON.stringify({
              error: 'Hors ligne',
              message: 'Impossible de contacter XAI'
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // 2. Stratégie Cache First pour les assets statiques
  e.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request).then(res => {
        if (res.ok) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, resClone));
        }
        return res;
      });
    }).catch(() => {
      // Fallback offline page
      if (request.mode === 'navigate') {
        return new Response(`
          <!DOCTYPE html>
          <html><body style="background:#0f172a;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;">
            <div><h1>XAI Chat Hors Ligne</h1><p>Vérifiez votre connexion</p></div>
          </body></html>
        `, { headers: { 'Content-Type': 'text/html' } });
      }
    })
  );
});

// Message du client pour skip waiting
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});