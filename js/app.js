/** Router and app shell. Hash routing keeps this a single static file drop. */

import { state } from './state.js';
import * as storage from './storage.js';
import { clear, toast } from './ui.js';
import { homeView } from './views/home.js';
import { coursesView, courseEditorView } from './views/courses.js';
import { roundSetupView } from './views/setup.js';
import { playView } from './views/play.js';
import { summaryView } from './views/summary.js';
import { historyView, historyDetailView } from './views/history.js';

const routes = [
  [/^\/?$/, () => homeView()],
  [/^\/courses$/, () => coursesView()],
  [/^\/courses\/new$/, () => courseEditorView(null)],
  [/^\/courses\/([^/]+)\/edit$/, (id) => courseEditorView(id)],
  [/^\/round\/new$/, () => roundSetupView()],
  [/^\/play$/, () => playView('hole')],
  [/^\/play\/grid$/, () => playView('grid')],
  [/^\/play\/board$/, () => playView('board')],
  [/^\/summary$/, () => summaryView()],
  [/^\/history$/, () => historyView()],
  [/^\/history\/([^/]+)$/, (id) => historyDetailView(id)],
];

const root = document.getElementById('app');

function currentPath() {
  return window.location.hash.replace(/^#/, '') || '/';
}

function render() {
  const path = currentPath();

  // A completed round belongs on the summary screen, not the scoring screens.
  if (path.startsWith('/play') && state.activeRound?.completedAt) {
    window.location.hash = '#/summary';
    return;
  }

  for (const [pattern, view] of routes) {
    const match = path.match(pattern);
    if (match) {
      clear(root).append(view(...match.slice(1)));
      document.getElementById('scroll-body')?.scrollTo(0, 0);
      return;
    }
  }

  window.location.hash = '#/';
}

window.addEventListener('hashchange', render);
document.addEventListener('app:render', render);
document.addEventListener('storage-error', (e) => toast(e.detail));

if (!storage.isAvailable()) {
  setTimeout(() => toast('Storage is blocked — this round will not survive a reload.'), 600);
}

render();

/* ---------------------------------------------------------- offline / PWA */

if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('[sw] registration failed', err);
    });
  });
}
