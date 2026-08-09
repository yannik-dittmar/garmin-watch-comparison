import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { Fetcher } from '../lib/fetcher.js';
import { Reporter, writeJson } from '../lib/report.js';
import { classifyProduct } from '../lib/families.js';
import { ensureDirs, RAW, RAW_PRODUCTS, REPORTS } from '../lib/paths.js';
import { discover } from './discovery.js';
import { extractBootstrap, productIdsOnPage, type Bootstrap } from './bootstrap.js';
import { buildFromIndexEntry } from './product.js';
import type { ProductIndexEntry } from '../../src/data/contract.js';

/**
 * Stage 1 — `npm run ingest`.
 *
 *   npm run ingest                     everything
 *   npm run ingest -- --family fenix   one family unit (design D9)
 *   npm run ingest -- --no-cache       ignore the response cache
 *   npm run ingest -- --limit 5        smoke test
 *
 * The run is resumable: responses are cached on disk, so an interrupted run
 * re-reads what it already fetched instead of hitting garmin.com again.
 */

/** Family units from design D9 — one ingestion agent's worth of work each. */
const FAMILY_UNITS: Record<string, string[]> = {
  forerunner: ['Forerunner'],
  fenix: ['fēnix', 'epix', 'Enduro', 'tactix', 'MARQ', 'quatix', 'D2'],
  instinct: ['Instinct'],
  venu: ['Venu', 'vívoactive', 'vívomove', 'Lily'],
  approach: ['Approach'],
  descent: ['Descent'],
};

interface Args {
  family?: string;
  limit?: number;
  concurrency: number;
  delay: number;
  noCache: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { concurrency: 3, delay: 450, noCache: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => argv[++i];
    if (arg === '--family') args.family = value().toLowerCase();
    else if (arg === '--limit') args.limit = Number(value());
    else if (arg === '--concurrency') args.concurrency = Number(value());
    else if (arg === '--delay') args.delay = Number(value());
    else if (arg === '--no-cache') args.noCache = true;
  }
  if (args.family && args.family !== 'all' && !FAMILY_UNITS[args.family]) {
    throw new Error(
      `unknown family unit "${args.family}" — expected one of ${Object.keys(FAMILY_UNITS).join(', ')}`,
    );
  }
  return args;
}

function inFamilyUnit(entry: ProductIndexEntry, unit: string | undefined): boolean {
  if (!unit || unit === 'all') return true;
  const family = classifyProduct(entry.name).family;
  return !!family && FAMILY_UNITS[unit].includes(family);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await ensureDirs(RAW, RAW_PRODUCTS, REPORTS);

  const fetcher = new Fetcher({
    concurrency: args.concurrency,
    delayMs: args.delay,
    noCache: args.noCache,
  });
  const reporter = new Reporter('ingest');

  console.log('discovery…');
  const { watches } = await discover(fetcher, reporter);

  let targets = watches.filter((w) => inFamilyUnit(w, args.family));
  if (args.limit) targets = targets.slice(0, args.limit);
  console.log(`\nfetching ${targets.length} models${args.family ? ` (unit: ${args.family})` : ''}…`);

  /**
   * A product page carries the whole group's SKUs, so one fetch usually covers
   * several models — and it is also the only route to a model whose own page
   * 404s (Forerunner 70 is currently in that state).
   */
  const covered = new Map<string, { bootstrap: Bootstrap; pageUrl: string }>();
  const failed: Array<{ entry: ProductIndexEntry; error: string }> = [];

  for (const entry of targets) {
    if (covered.has(entry.id)) continue;
    try {
      const html = await fetcher.text(entry.url);
      const bootstrap = extractBootstrap(html);
      for (const productId of productIdsOnPage(bootstrap)) {
        if (!covered.has(productId)) covered.set(productId, { bootstrap, pageUrl: entry.url });
      }
      if (!covered.has(entry.id)) {
        failed.push({ entry, error: 'page carries no SKU for this product id' });
      }
    } catch (err) {
      failed.push({ entry, error: (err as Error).message });
    }
  }

  const written: string[] = [];
  const perFamily = new Map<string, { ok: number; failed: number }>();
  const bump = (entry: ProductIndexEntry, key: 'ok' | 'failed') => {
    const family = classifyProduct(entry.name).family ?? 'unknown';
    const counts = perFamily.get(family) ?? { ok: 0, failed: 0 };
    counts[key]++;
    perFamily.set(family, counts);
  };

  for (const entry of targets) {
    const source = covered.get(entry.id);
    if (!source) {
      const failure = failed.find((f) => f.entry.id === entry.id);
      reporter.add(
        'fetch-failure',
        `${entry.id} ${entry.name}`,
        failure?.error ?? 'no bootstrap covering this product id',
      );
      bump(entry, 'failed');
      continue;
    }
    try {
      const product = buildFromIndexEntry(entry, source.bootstrap, source.pageUrl);
      if (product.specs.length === 0) {
        reporter.add('note', `${entry.id} ${entry.name}`, 'no specification rows captured');
      }
      await writeJson(path.join(RAW_PRODUCTS, `${entry.id}.json`), product);
      written.push(entry.id);
      bump(entry, 'ok');
      console.log(
        `  ✓ ${entry.id} ${product.name} — ${product.specs.length} spec rows, ` +
          `${product.variants.length} variants`,
      );
    } catch (err) {
      reporter.add('fetch-failure', `${entry.id} ${entry.name}`, (err as Error).message);
      bump(entry, 'failed');
      console.log(`  ✗ ${entry.id} ${entry.name} — ${(err as Error).message}`);
    }
  }

  /* Per-family coverage report (design D9, task 3.7) */
  const coverage = [...perFamily.entries()]
    .map(([family, counts]) => ({ family, ...counts }))
    .sort((a, b) => a.family.localeCompare(b.family));
  await writeJson(path.join(REPORTS, 'coverage-by-family.json'), coverage);

  const { requests, cached, network } = fetcher.stats;
  await writeJson(path.join(RAW, 'fetch-log.json'), fetcher.log);
  await reporter.write();

  console.log(
    `\ningest complete: ${written.length} models written, ${targets.length - written.length} failed`,
  );
  console.log(`  requests: ${requests} (${network} network, ${cached} cached)`);
  console.log(`  report: ${reporter.summary()}`);
  for (const row of coverage) console.log(`  ${row.family}: ${row.ok} ok, ${row.failed} failed`);

  // A marker the images and normalize stages read to know a snapshot exists.
  await writeFile(
    path.join(RAW, 'ingest-complete.json'),
    JSON.stringify({ finishedAt: new Date().toISOString(), models: written }, null, 2),
    'utf8',
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
