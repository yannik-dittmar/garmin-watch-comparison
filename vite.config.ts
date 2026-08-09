import { cp, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(projectRoot, 'data');

/**
 * The generated snapshot lives at `<root>/data` (design D1) rather than under
 * `public/`, so it is served here explicitly: from disk in dev, copied into the
 * bundle at build time.
 *
 * Only what the site actually fetches is exposed. The rest of `data/` — the raw
 * per-product records, the run reports and above all `raw/.http-cache`, which is
 * ~96 MB of stored upstream responses — is build input, not a site asset, and
 * shipping it would multiply the artifact's size for nothing.
 */
const SITE_DATA = ['catalog.json', 'meta.json', 'models'];

function isSiteData(relativePath: string): boolean {
  const [head] = relativePath.split('/');
  return SITE_DATA.includes(head);
}

function snapshotAssets(): Plugin {
  return {
    name: 'snapshot-assets',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/data/')) return next();
        const rel = decodeURIComponent(req.url.split('?')[0]).slice('/data/'.length);
        // Dev serves exactly what a build would ship, so a path that works here
        // cannot 404 in production.
        if (!isSiteData(rel)) return next();
        const file = path.join(dataDir, rel);
        if (!file.startsWith(dataDir)) return next();
        try {
          await stat(file);
        } catch {
          return next();
        }
        res.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : 'text/plain');
        const { createReadStream } = await import('node:fs');
        createReadStream(file).pipe(res);
      });
    },
    async closeBundle() {
      const target = path.join(projectRoot, 'dist', 'data');
      for (const entry of SITE_DATA) {
        const source = path.join(dataDir, entry);
        try {
          await stat(source);
        } catch {
          continue;
        }
        await cp(source, path.join(target, entry), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  // Root-relative: the app fetches its snapshot with `fetch('/data/…')`, so it needs an
  // http origin either way (`vite preview` or any static server). HashRouter still means
  // no server-side SPA rewrite is required.
  base: '/',
  plugins: [react(), tailwindcss(), snapshotAssets()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
