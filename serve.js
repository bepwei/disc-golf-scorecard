/**
 * Zero-dependency static server for local use.
 *
 *   node serve.js            -> http://localhost:5173
 *   node serve.js 8080       -> http://localhost:8080
 *
 * Also prints your LAN address so you can open the app on your phone. Service
 * workers only run on localhost or HTTPS, so over the LAN you get the app but
 * not offline caching — that is fine for testing, and works fully once the
 * site is hosted somewhere with HTTPS.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = import.meta.dirname;
const PORT = Number(process.argv[2]) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const rel = decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.join(ROOT, rel);

  // Refuse anything that escapes the served directory.
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, 'index.html')) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      // No caching in dev — the service worker is the only cache we want.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);

  console.log(`\n  Disc Golf Scorecard`);
  console.log(`  local:   http://localhost:${PORT}`);
  for (const address of lan) console.log(`  network: http://${address}:${PORT}   (open this on your phone)`);
  console.log('\n  Ctrl+C to stop.\n');
});
