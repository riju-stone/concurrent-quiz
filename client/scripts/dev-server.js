/**
 * Local development server — serves the contents of public/ with Bun.
 *
 * Bun auto-loads .env so SOCKET_SERVER_URL is available here just like
 * it is during `bun run scripts/inject-socket-url.js`.
 *
 * Run via: bun dev  (which first injects the socket URL, then starts this)
 */

import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const PUBLIC_DIR = join(import.meta.dir, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = join(PUBLIC_DIR, pathname);

    if (!existsSync(filePath)) {
      // Fall back to index.html for any unknown path.
      const index = join(PUBLIC_DIR, 'index.html');
      return new Response(Bun.file(index), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    return new Response(Bun.file(filePath), {
      headers: { 'Content-Type': contentType },
    });
  },
});

console.log(`Dev server running → http://localhost:${PORT}`);
