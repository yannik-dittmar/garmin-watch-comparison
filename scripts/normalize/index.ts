import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Reporter, writeJson } from '../lib/report.js';
import { ensureDirs, DATA, LOCALE, MODELS, RAW_PRODUCTS, REPORTS, STORE_CODE } from '../lib/paths.js';
import { cleanLabel } from './field-map.js';
import { deriveLineage } from './lineage.js';
import { normalizeRows } from './normalize.js';
import { assertImageHost } from '../lib/images.js';
import { FIELD_IDS } from '../../src/data/schema.js';
import type { CatalogModel, ModelDetail, RawProduct, SnapshotMeta } from '../../src/data/contract.js';

/**
 * Stage 2 — `npm run normalize`.
 *
 * Reads `data/raw/products/*.json`, maps every model onto the fixed comparison
 * schema, and writes the two files the site reads plus the coverage reports.
 * Never touches the network, so it is cheap to re-run after a field-map fix.
 *
 *   npm run normalize
 *   npm run normalize -- --force   overwrite despite a regression
 */

/* ------------------------------------------------------------------ */

interface Args {
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  return { force: argv.includes('--force') };
}

interface PreviousSnapshot {
  models: Map<string, number>;
  count: number;
}

async function readPrevious(): Promise<PreviousSnapshot | null> {
  try {
    const raw = await readFile(path.join(DATA, 'catalog.json'), 'utf8');
    const parsed = JSON.parse(raw) as { models: CatalogModel[] };
    const models = new Map<string, number>();
    for (const model of parsed.models) {
      const published = Object.values(model.specs).filter((v) => v.kind !== 'not-published').length;
      models.set(model.id, published);
    }
    return { models, count: parsed.models.length };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await ensureDirs(DATA, MODELS, REPORTS);
  const reporter = new Reporter('normalize');

  const files = (await readdir(RAW_PRODUCTS)).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.error('no raw products found — run `npm run ingest` first');
    process.exitCode = 1;
    return;
  }

  const catalog: CatalogModel[] = [];
  const details: ModelDetail[] = [];
  /** raw label → models it occurs on, for the unmapped report. */
  const unmapped = new Map<string, string[]>();
  const fieldCoverage = new Map<string, number>();
  let oldestFetch: string | null = null;
  let variantCount = 0;

  for (const file of files.sort()) {
    const product = JSON.parse(await readFile(path.join(RAW_PRODUCTS, file), 'utf8')) as RawProduct;
    const { specs, consumed } = normalizeRows(product.specs);
    const lineage = deriveLineage(product.name);

    // Last writer before publication, so the host constraint is asserted once
    // more here rather than trusted from ingestion (design D9).
    assertImageHost(product.id, [
      ...product.images,
      ...product.variants.flatMap((v) => v.images),
    ]);
    if (product.images.length === 0) {
      reporter.add('image-failure', `${product.id} ${product.name}`, 'Garmin publishes no image for this model');
    }

    for (const row of product.specs) {
      const label = cleanLabel(row.label);
      if (consumed.has(label)) continue;
      const models = unmapped.get(label) ?? [];
      if (!models.includes(product.name)) models.push(product.name);
      unmapped.set(label, models);
    }

    for (const [field, spec] of Object.entries(specs)) {
      if (spec.kind !== 'not-published') fieldCoverage.set(field, (fieldCoverage.get(field) ?? 0) + 1);
    }

    if (!oldestFetch || product.fetchedAt < oldestFetch) oldestFetch = product.fetchedAt;
    variantCount += product.variants.length;

    catalog.push({
      id: product.id,
      name: product.name,
      lineage,
      price: product.price,
      image: product.images[0] ?? null,
      categories: product.categories,
      partNumbers: product.variants.map((v) => v.partNumber),
      variantCount: product.variants.length,
      specs,
      sourceUrl: product.sourceUrl,
      fetchedAt: product.fetchedAt,
    });

    details.push({
      id: product.id,
      name: product.name,
      lineage,
      price: product.price,
      images: product.images,
      variants: product.variants,
      boxContents: product.boxContents,
      rawSpecs: product.specs,
      specs,
      sourceUrl: product.sourceUrl,
      fetchedAt: product.fetchedAt,
    });
  }

  catalog.sort((a, b) => a.name.localeCompare(b.name, 'de'));

  /* 5.9 — regression guard */
  const previous = await readPrevious();
  if (previous && !args.force) {
    const problems: string[] = [];
    if (catalog.length < previous.count) {
      problems.push(`model count dropped from ${previous.count} to ${catalog.length}`);
    }
    for (const model of catalog) {
      const before = previous.models.get(model.id);
      if (before === undefined) continue;
      const now = Object.values(model.specs).filter((v) => v.kind !== 'not-published').length;
      if (now < before) {
        problems.push(`${model.id} ${model.name}: normalized fields fell from ${before} to ${now}`);
      }
    }
    if (problems.length > 0) {
      for (const problem of problems) reporter.add('note', 'regression guard', problem);
      await reporter.write();
      console.error('\nregression guard: refusing to overwrite the existing snapshot');
      for (const problem of problems.slice(0, 20)) console.error(`  - ${problem}`);
      if (problems.length > 20) console.error(`  … and ${problems.length - 20} more`);
      console.error('\nreport written to data/reports/normalize.json');
      console.error('re-run with `npm run normalize -- --force` once the shrinkage is understood.');
      process.exitCode = 1;
      return;
    }
  }

  /* 5.8 — snapshot metadata */
  const meta: SnapshotMeta = {
    generatedAt: new Date().toISOString(),
    oldestFetchAt: oldestFetch,
    locale: LOCALE,
    storeCode: STORE_CODE,
    modelCount: catalog.length,
    variantCount,
    sources: ['www.garmin.com', 'res.garmin.com'],
  };

  /* 5.6 — the two outputs the site reads */
  await writeJson(path.join(DATA, 'catalog.json'), { meta, models: catalog });
  await writeJson(path.join(DATA, 'meta.json'), meta);
  for (const detail of details) {
    await writeJson(path.join(MODELS, `${detail.id}.json`), detail);
  }

  /* 5.7 — coverage reports */
  /**
   * Every unmapped label is classified, so the report can be reviewed to a
   * conclusion rather than skimmed (task 12.1). A label present on nearly every
   * model cannot separate two watches and is worthless as a comparison field; a
   * label present on a handful is a niche row that belongs on the detail view.
   * What is left — `candidate` — is the list actually worth reading.
   */
  const classify = (share: number): 'universal' | 'niche' | 'candidate' => {
    if (share >= 95) return 'universal';
    if (share <= 10) return 'niche';
    return 'candidate';
  };

  const unmappedRows = [...unmapped.entries()]
    .map(([label, models]) => {
      const share = Number(((models.length / catalog.length) * 100).toFixed(1));
      return {
        label,
        models: models.length,
        share,
        classification: classify(share),
        examples: models.slice(0, 5),
      };
    })
    .sort((a, b) => b.models - a.models);

  const byClass = {
    universal: unmappedRows.filter((row) => row.classification === 'universal').length,
    candidate: unmappedRows.filter((row) => row.classification === 'candidate').length,
    niche: unmappedRows.filter((row) => row.classification === 'niche').length,
  };

  await writeJson(path.join(REPORTS, 'unmapped-labels.json'), {
    note:
      'Raw spec labels that fed no normalized field. Nothing here is lost: every row is ' +
      'captured and shown in full on the model detail view. The comparison schema is a ' +
      'curated subset, and each label is classified by how much it could ever separate ' +
      'two models.',
    classifications: {
      universal: 'published for ≥95% of models — cannot distinguish anything, deliberately not a comparison field',
      candidate: 'published for 10–95% of models — genuinely discriminating, a candidate for the field map',
      niche: 'published for ≤10% of models — family-specific row, kept raw on the detail view',
    },
    modelCount: catalog.length,
    totalLabels: unmappedRows.length,
    counts: byClass,
    rows: unmappedRows,
  });
  for (const row of unmappedRows.filter((entry) => entry.classification === 'candidate').slice(0, 40)) {
    reporter.add('unmapped-label', row.label, `${row.models} models (${row.share}%)`);
  }

  const sparse = FIELD_IDS.map((field) => ({
    field,
    models: fieldCoverage.get(field) ?? 0,
    share: Number((((fieldCoverage.get(field) ?? 0) / catalog.length) * 100).toFixed(1)),
  }))
    .filter((entry) => entry.share < 50)
    .sort((a, b) => a.share - b.share);
  await writeJson(path.join(REPORTS, 'sparse-fields.json'), {
    note:
      'Normalized fields published for fewer than half the models. A genuinely rare feature ' +
      'belongs here; a field that should be common is a broken label pattern.',
    modelCount: catalog.length,
    fields: sparse,
  });
  for (const entry of sparse) {
    reporter.add('sparse-field', entry.field, `${entry.models}/${catalog.length} models (${entry.share}%)`);
  }

  await reporter.write();

  console.log(`normalize complete: ${catalog.length} models, ${variantCount} variants`);
  console.log(`  unmapped labels: ${unmappedRows.length}`);
  console.log(`  sparse fields:   ${sparse.length}/${FIELD_IDS.length}`);
  console.log(`  report: ${reporter.summary()}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
