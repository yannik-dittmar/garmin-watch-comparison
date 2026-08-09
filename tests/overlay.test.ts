import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

/**
 * 6.2–6.4 — the enlarged view, in a real engine.
 *
 * jsdom implements no `<dialog>`, and the whole point of design G7 is that the
 * platform provides the top layer, the focus trap, `Esc` and `::backdrop`. A
 * stubbed dialog would assert the stub. So this file drives Chromium against the
 * project's own dev server, which serves the same snapshot a build would ship.
 *
 * Imagery is answered locally: every `res.garmin.com` request is fulfilled with a
 * 1×1 PNG, so the suite neither contacts Garmin nor depends on the network — and
 * a route that fails on purpose is how the failure paths are exercised.
 */

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core');

/** Instinct 3 – 45 mm, Solar: two variants, 19 images on the first. */
const MODEL = '1315317';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let server: ViteDevServer;
let browser: Browser;
let origin: string;

beforeAll(async () => {
  server = await createServer({
    // Out of the project's own node_modules: the suite must not race the dev
    // server's dependency cache, or rebuild it as a side effect of running.
    cacheDir: mkdtempSync(path.join(tmpdir(), 'vite-cache-')),
    server: { port: 5233, strictPort: false },
    logLevel: 'error',
  });
  await server.listen();
  origin = server.resolvedUrls!.local[0].replace(/\/$/, '');
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

interface OpenOptions {
  /** Requests whose URL contains one of these fail, as a broken image would. */
  breakUrls?: string[];
}

async function openDetail(options: OpenOptions = {}): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route('**res.garmin.com/**', (route) => {
    const url = route.request().url();
    if (options.breakUrls?.some((fragment) => url.includes(fragment))) return route.abort();
    return route.fulfill({ body: PIXEL, contentType: 'image/png' });
  });
  await page.goto(`${origin}/#/modell/${MODEL}`);
  await page.waitForSelector('button[aria-label*="vergrößern"]');
  return page;
}

const dialogOpen = (page: Page) => page.evaluate(() => !!document.querySelector('dialog[open]'));

describe('enlarged image view', () => {
  it('opens from the hero with Enter and closes on Escape, returning focus', async () => {
    const page = await openDetail();
    const hero = page.locator('button[aria-label*="vergrößern"]');
    await hero.focus();
    await page.keyboard.press('Enter');
    expect(await dialogOpen(page)).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    expect(await dialogOpen(page)).toBe(false);
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toMatch(
      /Bild vergrößern/,
    );
    await page.close();
  });

  it('confines Tab to its own controls while open', async () => {
    const page = await openDetail();
    await page.locator('button[aria-label*="vergrößern"]').click();
    expect(await dialogOpen(page)).toBe(true);

    // Chromium passes through <body> once per cycle in a modal dialog — that is
    // the platform's own wrap point, not an escape. What must never happen is a
    // control behind the dialog taking focus.
    const stops: string[] = [];
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      stops.push(
        await page.evaluate(() => {
          const active = document.activeElement as HTMLElement | null;
          if (!active || active === document.body) return 'body';
          return active.closest('dialog[open]') ? 'dialog' : `outside:${active.outerHTML.slice(0, 80)}`;
        }),
      );
    }
    expect(stops.filter((stop) => stop.startsWith('outside'))).toEqual([]);
    expect(stops.filter((stop) => stop === 'dialog').length).toBeGreaterThan(5);
    await page.close();
  });

  it('cycles with the arrow keys and leaves the page on the frame it was closed at', async () => {
    const page = await openDetail();
    await page.locator('button[aria-label*="vergrößern"]').click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await page.locator('dialog[open] p').innerText()).toContain('03/19');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    // The page behind it shows the same image once the view is closed.
    expect(await page.locator('button[aria-label*="vergrößern"]').getAttribute('aria-label')).toContain(
      'Bild 3 von 19',
    );
    expect(await page.locator('button[aria-pressed="true"]').first().innerText()).toContain('03');
    await page.close();
  });

  it('wraps backwards from the first frame to the last', async () => {
    const page = await openDetail();
    await page.locator('button[aria-label*="vergrößern"]').click();
    await page.keyboard.press('ArrowLeft');
    expect(await page.locator('dialog[open] p').innerText()).toContain('19/19');
    await page.close();
  });

  it('closes on a click outside the image and on the close control', async () => {
    const page = await openDetail();
    await page.locator('button[aria-label*="vergrößern"]').click();
    await page.mouse.click(10, 450); // the dialog's own surface, beside the image
    await page.waitForTimeout(200);
    expect(await dialogOpen(page)).toBe(false);

    await page.locator('button[aria-label*="vergrößern"]').click();
    await page.locator('dialog[open] button[aria-label="Schließen"]').click();
    await page.waitForTimeout(200);
    expect(await dialogOpen(page)).toBe(false);
    await page.close();
  });

  it('locks the page behind it while open', async () => {
    const page = await openDetail();
    await page.locator('button[aria-label*="vergrößern"]').click();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    await page.close();
  });

  /* 6.4 — the failure paths, provoked rather than described. */

  it('a thumbnail that cannot be loaded becomes a labelled placeholder, sheet intact', async () => {
    const page = await openDetail({ breakUrls: ['-sm.jpg'] });
    await page.waitForTimeout(600);
    const placeholders = await page.locator('[role="img"][aria-label*="kein Bild verfügbar"]').count();
    expect(placeholders).toBeGreaterThan(0);
    // The hero still loads: only the small rendition was broken.
    expect(await page.locator('button[aria-label*="vergrößern"] img').count()).toBe(1);
    expect(await page.locator('h1').innerText()).toContain('Instinct 3');
    await page.close();
  });

  it('a full-size image that cannot be loaded leaves the overlay usable', async () => {
    const page = await openDetail({ breakUrls: ['-lg.jpg'] });
    await page.waitForTimeout(600);
    // The hero is a placeholder, and the rest of the detail view still renders.
    expect(await page.locator('button[aria-label*="vergrößern"] [role="img"]').count()).toBe(1);
    expect(await page.locator('h1').innerText()).toContain('Instinct 3');

    await page.locator('button[aria-label*="vergrößern"]').click();
    expect(await dialogOpen(page)).toBe(true);
    expect(await page.locator('dialog[open] [role="img"]').count()).toBe(1);
    await page.keyboard.press('ArrowRight');
    expect(await page.locator('dialog[open] p').innerText()).toContain('02/19');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    expect(await dialogOpen(page)).toBe(false);
    await page.close();
  });

  /* 6.3 — axe-core over the detail view, closed and open. */

  it('reports no axe violations with the enlarged view closed or open', async () => {
    const page = await openDetail();
    await page.addScriptTag({ path: AXE_PATH });
    const closed = await page.evaluate(() =>
      (window as unknown as { axe: { run: (o: unknown) => Promise<{ violations: unknown[] }> } }).axe
        .run(document)
        .then((r) => r.violations.map((v) => JSON.stringify(v).slice(0, 300))),
    );
    expect(closed).toEqual([]);

    await page.locator('button[aria-label*="vergrößern"]').click();
    await page.waitForTimeout(200);
    const open = await page.evaluate(() =>
      (window as unknown as { axe: { run: (o: unknown) => Promise<{ violations: unknown[] }> } }).axe
        .run(document)
        .then((r) => r.violations.map((v) => JSON.stringify(v).slice(0, 300))),
    );
    expect(open).toEqual([]);
    await page.close();
  });
});
