/**
 * Vercel build step — injects the SOCKET_SERVER_URL environment variable
 * into the socket-server-url <meta> tag in public/index.html.
 *
 * Set SOCKET_SERVER_URL in your Vercel project settings to the URL of
 * your deployed Socket.IO server (e.g. https://concurrent-quiz.up.railway.app).
 * Leave it empty to fall back to window.location.origin (useful for local dev
 * where client and server run on the same origin).
 */

import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('public/index.html', 'utf-8');
const url = (process.env.SOCKET_SERVER_URL || '').trim();

const updated = html.replace(
  /(<meta\s+name="socket-server-url"\s+content=")[^"]*(")/,
  `$1${url}$2`,
);

if (updated === html && !url) {
  // No replacement needed and URL is empty — nothing to do.
  console.log('inject-socket-url: SOCKET_SERVER_URL not set, client will use window.location.origin');
} else {
  writeFileSync('public/index.html', updated);
  console.log(`inject-socket-url: socket-server-url set to "${url || '(empty)'}"`);
}
