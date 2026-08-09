import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Fetcher } from '../lib/fetcher.js';
import { Reporter } from '../lib/report.js';
import { ensureDirs, IMG, RAW_PRODUCTS, REPORTS } from '../lib/paths.js';
import type { RawProduct } from '../../src/data/contract.js';

/**
 * Stage 2b — `npm run images`.
 *
 * Downloads every model and variant image from res.garmin.com into
 * `public/img/<id>/` and rewrites the raw records to point at the local copies,
 * so no page of the built site ever requests a remote image
 * (`catalog-ingestion` — local image assets).
 *
 * A failed download is never fatal: the model is recorded as missing that image
 * and the run continues.
 */

function localName(url: string): string {
  const clean = url.split('?')[0];
  const parts = clean.split('/').filter(Boolean);
  // …/products/<partNumber>/v/<view>.jpg  →  <partNumber>-<view>.jpg
  const file = parts[parts.length - 1] ?? 'image.jpg';
  const partNumber = parts.find((p) => /^\d{3}-\d{5}-\d{2}$/.test(p));
  return partNumber ? `${partNumber}-${file}` : file;
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

const REMOTE = /^https?:\/\//i;

async function main(): Promise<void> {
  await ensureDirs(IMG, REPORTS);
  const fetcher = new Fetcher({ concurrency: 4, delayMs: 250 });
  const reporter = new Reporter('images');

  const files = (await readdir(RAW_PRODUCTS)).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.error('no raw products found — run `npm run ingest` first');
    process.exitCode = 1;
    return;
  }

  let downloaded = 0;
  let reused = 0;
  let failures = 0;

  for (const file of files) {
    const productPath = path.join(RAW_PRODUCTS, file);
    const product = JSON.parse(await readFile(productPath, 'utf8')) as RawProduct;
    const modelDir = path.join(IMG, product.id);
    await mkdir(modelDir, { recursive: true });

    const missing: string[] = [];
    /** remote url → local path, so the same image is fetched once per model. */
    const mapped = new Map<string, string>();

    const localise = async (url: string): Promise<string | null> => {
      if (!REMOTE.test(url)) return url; // already local from an earlier run
      const cached = mapped.get(url);
      if (cached) return cached;

      const name = localName(url);
      const target = path.join(modelDir, name);
      const publicPath = `/img/${product.id}/${name}`;

      if (await exists(target)) {
        mapped.set(url, publicPath);
        reused++;
        return publicPath;
      }
      try {
        const { body } = await fetcher.raw(url, 'image/avif,image/webp,image/jpeg,image/*');
        if (body.length === 0) throw new Error('empty response body');
        await writeFile(target, body);
        mapped.set(url, publicPath);
        downloaded++;
        return publicPath;
      } catch (err) {
        failures++;
        missing.push(url);
        reporter.add('image-failure', `${product.id} ${product.name}`, `${url}: ${(err as Error).message}`);
        return null;
      }
    };

    const modelImages: string[] = [];
    for (const url of product.images) {
      const local = await localise(url);
      if (local) modelImages.push(local);
    }
    product.images = modelImages;

    for (const variant of product.variants) {
      const variantImages: string[] = [];
      for (const url of variant.images) {
        const local = await localise(url);
        if (local) variantImages.push(local);
      }
      variant.images = variantImages;
    }

    product.missingImages = missing;
    if (product.images.length === 0) {
      reporter.add('image-failure', `${product.id} ${product.name}`, 'model has no local image at all');
    }

    // No remote URL may survive into data/ (`catalog-ingestion` — localised images).
    const leaked = [...product.images, ...product.variants.flatMap((v) => v.images)].filter((p) =>
      REMOTE.test(p),
    );
    if (leaked.length > 0) {
      throw new Error(`remote image URL survived into ${product.id}: ${leaked[0]}`);
    }

    await writeFile(productPath, JSON.stringify(product, null, 2), 'utf8');
    console.log(`  ${product.id} ${product.name}: ${product.images.length} images${missing.length ? `, ${missing.length} missing` : ''}`);
  }

  await reporter.write();
  console.log(
    `\nimages complete: ${downloaded} downloaded, ${reused} already present, ${failures} failed`,
  );
  console.log(`  report: ${reporter.summary()}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
