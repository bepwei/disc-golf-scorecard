/**
 * Service worker — caches the app shell so the scorecard opens with no signal.
 *
 * Strategy: cache-first for the shell (it is tiny and versioned), with a
 * background revalidate so a new deploy is picked up on the next launch.
 * Round data lives in localStorage, which the worker never touches.
 *
 * Bump CACHE_VERSION whenever the shell files change.
 */

const CACHE_VERSION = 'discgolf-v1';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/scoring.js',
  './js/state.js',
  './js/storage.js',
  './js/ui.js',
  './js/views/home.js',
  './js/views/courses.js',
  './js/views/setup.js',
  './js/views/play.js',
  './js/views/shared.js',
  './js/views/summary.js',
  './js/views/history.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // addAll is all-or-nothing; add individually so one 404 cannot block install.
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);

    const network = fetch(request).then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    });

    // Serve from cache immediately, refresh it in the background.
    if (cached) {
      event.waitUntil(network.catch(() => {}));
      return cached;
    }

    try {
      return await network;
    } catch (err) {
      // Offline and never cached — a page load still gets the shell.
      if (request.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
