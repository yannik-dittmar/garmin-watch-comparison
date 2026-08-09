import path from 'node:path';
import { Fetcher } from '../lib/fetcher.js';
import { Reporter, writeJson } from '../lib/report.js';
import { classifyProduct, cleanName, looksLikeWatch } from '../lib/families.js';
import { APP_NAME, GARMIN, LOCALE, RAW, REPORTS, STORE_CODE } from '../lib/paths.js';
import type { ProductIndexEntry, RawCategory } from '../../src/data/contract.js';

/**
 * Stage 1a — discovery (design D2).
 *
 * Category HTML is a client-rendered shell: the handful of `/p/` links in it come
 * from the global nav, not the product grid. The JSON API is the only correct
 * enumeration path, so the HTML is fetched for exactly one reason — to read the
 * `categoryKey` out of its inline state, which is *not* the URL slug.
 */

interface ApiProduct {
  id: string;
  name: string;
  description?: { shortText?: string; longText?: string };
  image?: { large?: string };
  url: string;
  /** True on a container entry that stands for several sibling models. */
  group?: boolean;
  productIds?: string[];
}

interface CategoryProductsResponse {
  products?: ApiProduct[];
  meta?: { totalProductCount?: number };
}

interface DisplayableProduct {
  productId: string;
  productName: string;
  partNumber: string;
}

/**
 * Watches the category API misses.
 *
 * The cross-check against `getDisplayableProducts` (design D2) exists to catch
 * exactly this case, and closing the loop means acting on what it finds. Each
 * entry is a deliberate, reviewed addition — never a blanket sweep of the master
 * list, which is full of long-discontinued models that are out of scope.
 */
const SUPPLEMENTARY_PRODUCT_IDS: Array<{ id: string; reason: string }> = [
  {
    id: '2010221',
    // Verified 2026-08-08: live product page, current price, listed in
    // getDisplayableProducts, but absent from every current wearable category
    // and from Garmin's own previous-models categories.
    reason: 'current model missing from every wearable category (discovery-gap review, 2026-08-08)',
  },
];

/** URL fragments that mark a sitemap category as wearable-related. */
const WEARABLE_PATTERNS = [
  /smartwatch/i,
  /wearable/i,
  /fitness-activity-trackers/i,
  /activity-fitness-trackers/i,
  /golf-gps-devices/i,
  /dive-computers/i,
  /connect-iq-compatible-devices/i,
  /garmin-pay/i,
  /women-wearables/i,
];

/** …and fragments that disqualify one even when it matched above. */
const WEARABLE_EXCLUSIONS = [
  /accessories/i,
  /discontinued/i,
  /previous-models/i,
  /\/promotions\//i,
  /\/apps\//i,
];

export function isWearableCategory(url: string): boolean {
  if (WEARABLE_EXCLUSIONS.some((r) => r.test(url))) return false;
  return WEARABLE_PATTERNS.some((r) => r.test(url));
}

/**
 * Garmin keeps its superseded watches in dedicated `previous-models` categories.
 * They are out of scope (current models only), but enumerating them turns the
 * discovery-gap report from a list of unexplained absences into a classified one:
 * a watch Garmin itself files as a previous model is not a gap in our discovery.
 */
export function isPreviousModelCategory(url: string): boolean {
  if (!/previous-models|discontinued/.test(url)) return false;
  return WEARABLE_PATTERNS.some((r) => r.test(url)) || /wearables/.test(url);
}

export function parseSitemap(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

/**
 * The category key lives in the page's inline state. `.../running-smartwatches/`
 * is served by `categoryKey: "Running"`, so the slug can never be used directly.
 */
export function extractCategoryKey(html: string): string | null {
  const match = html.match(/"categoryKey"\s*:\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function categoryName(url: string): string {
  const parts = url.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] ?? url;
}

function productsUrl(key: string): string {
  return (
    `${GARMIN}/c/api/getCategoryProducts?categoryKey=${encodeURIComponent(key)}` +
    `&locale=${LOCALE}&storeCode=${STORE_CODE}&appName=${APP_NAME}`
  );
}

function filtersUrl(key: string): string {
  return (
    `${GARMIN}/c/api/getCategoryFilters?categoryKey=${encodeURIComponent(key)}` +
    `&locale=${LOCALE}&storeCode=${STORE_CODE}&appName=${APP_NAME}`
  );
}

export interface DiscoveryResult {
  categories: RawCategory[];
  /** Every enumerated product; excluded ones carry an `excluded` reason. */
  index: ProductIndexEntry[];
  /** The subset that will be fetched — wrist-worn watches only. */
  watches: ProductIndexEntry[];
}

export async function discover(fetcher: Fetcher, reporter: Reporter): Promise<DiscoveryResult> {
  /* 2.2 — sitemap → wearable category URLs */
  const sitemap = await fetcher.text(`${GARMIN}/${LOCALE}/category-sitemap.xml`);
  const allUrls = parseSitemap(sitemap);
  const wearableUrls = allUrls.filter(isWearableCategory);
  console.log(`  sitemap: ${allUrls.length} categories, ${wearableUrls.length} wearable`);

  /* 2.3 — each category page yields its categoryKey */
  const categories: RawCategory[] = [];
  for (const url of wearableUrls) {
    let html: string;
    try {
      html = await fetcher.text(url);
    } catch (err) {
      reporter.add('fetch-failure', url, `category page unreachable: ${(err as Error).message}`);
      continue;
    }
    const categoryKey = extractCategoryKey(html);
    if (!categoryKey) {
      reporter.add('fetch-failure', url, 'no categoryKey found in inline state');
      continue;
    }
    categories.push({ categoryKey, url, name: categoryName(url) });
  }
  await writeJson(path.join(RAW, 'categories.json'), categories);
  console.log(`  categories with a key: ${categories.length}`);

  /* 2.4 — getCategoryProducts per key, unioned by product id */
  const byId = new Map<string, ProductIndexEntry>();
  const addCategory = (id: string, category: string) => {
    const entry = byId.get(id);
    if (entry && !entry.categories.includes(category)) entry.categories.push(category);
  };

  for (const category of categories) {
    let response: CategoryProductsResponse;
    try {
      response = await fetcher.json<CategoryProductsResponse>(productsUrl(category.categoryKey));
    } catch (err) {
      reporter.add(
        'fetch-failure',
        category.categoryKey,
        `getCategoryProducts failed: ${(err as Error).message}`,
      );
      continue;
    }
    const products = response.products ?? [];
    const total = response.meta?.totalProductCount;
    if (typeof total === 'number' && products.length < total) {
      reporter.add(
        'note',
        category.categoryKey,
        `returned ${products.length} of ${total} products — enumeration may be truncated`,
      );
    }

    for (const product of products) {
      // A group entry stands for its members, each of which is also listed
      // individually. Recording the group as a product would create a phantom
      // model, so it is skipped here and used only for category attribution below.
      if (product.group && product.productIds?.length) continue;

      const existing = byId.get(product.id);
      if (existing) {
        addCategory(product.id, category.categoryKey);
        continue;
      }
      byId.set(product.id, {
        id: product.id,
        name: cleanName(product.name),
        url: product.url,
        imageUrl: product.image?.large ?? null,
        partNumbers: [],
        categories: [category.categoryKey],
        price: null,
      });
    }

    // Group memberships are attributed after every member entry exists.
    for (const product of products) {
      if (product.group && product.productIds?.length) {
        for (const memberId of product.productIds) addCategory(memberId, category.categoryKey);
      }
    }
    console.log(`  ${category.categoryKey}: ${products.length} products`);
  }

  /* Supplement the enumeration with the reviewed misses (design D2 feedback loop) */
  let master: DisplayableProduct[] = [];
  try {
    const displayable = await fetcher.json<{ data?: DisplayableProduct[] }>(
      `${GARMIN}/c/api/getDisplayableProducts?locale=${LOCALE}`,
    );
    master = displayable.data ?? [];
  } catch (err) {
    reporter.add('fetch-failure', 'getDisplayableProducts', (err as Error).message);
  }

  for (const supplement of SUPPLEMENTARY_PRODUCT_IDS) {
    if (byId.has(supplement.id)) continue;
    const entry = master.find((product) => product.productId === supplement.id);
    if (!entry) {
      reporter.add('note', supplement.id, 'supplementary product id is no longer in the master list');
      continue;
    }
    byId.set(supplement.id, {
      id: supplement.id,
      name: cleanName(entry.productName),
      url: `${GARMIN}/${LOCALE}/p/${supplement.id}/`,
      imageUrl: null,
      partNumbers: [],
      categories: [],
      price: null,
    });
    reporter.add('note', `${supplement.id} ${cleanName(entry.productName)}`, `added: ${supplement.reason}`);
    console.log(`  supplement: ${supplement.id} ${cleanName(entry.productName)}`);
  }

  /* 2.5 — keep wrist-worn watches, record every exclusion with its reason */
  const index = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const watches: ProductIndexEntry[] = [];
  for (const entry of index) {
    const classification = classifyProduct(entry.name);
    if (classification.isWatch) {
      watches.push(entry);
    } else {
      entry.excluded = classification.reason;
      reporter.add('excluded', `${entry.id} ${entry.name}`, classification.reason);
    }
  }
  await writeJson(path.join(RAW, 'products-index.json'), index);
  console.log(`  enumerated ${index.length} products, ${watches.length} wrist watches`);

  /* 2.6 — cross-check against the master list, report discovery gaps */
  if (master.length > 0) {
    const known = new Set(index.map((e) => e.id));

    // Enumerate the previous-model categories so each absence can be classified.
    const previousModelIds = new Set<string>();
    const previousUrls = allUrls.filter(isPreviousModelCategory);
    for (const url of previousUrls) {
      try {
        const html = await fetcher.text(url);
        const key = extractCategoryKey(html);
        if (!key) continue;
        const response = await fetcher.json<CategoryProductsResponse>(productsUrl(key));
        for (const product of response.products ?? []) {
          previousModelIds.add(product.id);
          for (const memberId of product.productIds ?? []) previousModelIds.add(memberId);
        }
      } catch (err) {
        reporter.add('note', url, `previous-model category unreadable: ${(err as Error).message}`);
      }
    }

    const gaps = master
      .filter((p) => looksLikeWatch(p.productName) && !known.has(p.productId))
      .map((p) => ({
        productId: p.productId,
        productName: cleanName(p.productName),
        partNumber: p.partNumber,
        /** `previous-model` is explained and expected; `unexplained` is a real gap. */
        classification: previousModelIds.has(p.productId)
          ? ('previous-model' as const)
          : ('unexplained' as const),
      }));
    const unexplained = gaps.filter((gap) => gap.classification === 'unexplained');

    await writeJson(path.join(REPORTS, 'discovery-gap.json'), {
      checkedAgainst: master.length,
      previousModelCategories: previousUrls.length,
      previousModelProducts: previousModelIds.size,
      note:
        'Products whose name matches a wrist-watch family but which no current wearable ' +
        'category returned. `previous-model` entries are ones Garmin itself files under a ' +
        'previous-models category — out of scope by the proposal, not a discovery failure. ' +
        '`unexplained` entries are the ones worth investigating.',
      counts: { total: gaps.length, previousModel: gaps.length - unexplained.length, unexplained: unexplained.length },
      gaps,
    });
    for (const gap of unexplained) {
      reporter.add('discovery-gap', `${gap.productId} ${gap.productName}`, 'absent from category union, not filed as a previous model');
    }
    console.log(
      `  discovery gap: ${gaps.length} watch-named products absent from the current union ` +
        `(${gaps.length - unexplained.length} filed by Garmin as previous models, ${unexplained.length} unexplained)`,
    );
  }

  /* 2.7 — Garmin's own facet vocabulary, reused as UI facets */
  const filters: Record<string, unknown> = {};
  for (const category of categories) {
    try {
      filters[category.categoryKey] = await fetcher.json(filtersUrl(category.categoryKey));
    } catch (err) {
      reporter.add('fetch-failure', category.categoryKey, `getCategoryFilters: ${(err as Error).message}`);
    }
  }
  await writeJson(path.join(RAW, 'category-filters.json'), filters);

  return { categories, index, watches };
}
