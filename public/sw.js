/* TINA — minimal service worker for an offline-resilient app shell.
   Strategy:
   - precache the shell on install,
   - network-first for navigations (so a real connection always wins), falling
     back to the cached index.html when offline,
   - cache-first for hashed static assets (immutable build output),
   - NEVER touch /api or auth/realtime traffic.
*/
const CACHE = 'tina-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/tina-mascot.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;          // only same-origin
    if (url.pathname.startsWith('/api') || url.pathname.includes('supabase')) return; // never cache API/auth

    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req).catch(() => caches.match('/index.html')),
        );
        return;
    }

    // hashed assets: cache-first
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(req).then((hit) => hit || fetch(req).then((res) => {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(req, copy));
                return res;
            })),
        );
        return;
    }
});
