import { cleanName } from '../lib/families.js';
import { parseBoxContents, parseSpecTable } from './specs.js';
import {
  selectSkusForProduct,
  specSku,
  type Bootstrap,
  type BootstrapSku,
} from './bootstrap.js';
import { assertImageHost, classifyImage } from '../lib/images.js';
import { LOCALE, STORE_CODE } from '../lib/paths.js';
import type {
  Price,
  ProductImage,
  ProductIndexEntry,
  RawProduct,
  Variant,
} from '../../src/data/contract.js';

/** Stage 1d — assembling one model's raw record (tasks 3.4–3.6). */

function toPrice(sku: BootstrapSku): Price | null {
  const raw = sku.price?.salePrice ?? sku.price?.listPrice;
  if (!raw || typeof raw.price !== 'number') return null;
  return {
    amount: raw.price,
    currency: raw.currencyCode ?? 'EUR',
    formatted: raw.formattedPrice ?? String(raw.price),
  };
}

/**
 * Garmin's own `defaultImage` stays first — the detail view labels frame 01 as
 * Garmin's default, which is only true because of this order — and the gallery
 * follows in published order. Every candidate goes through `classifyImage`, so
 * the host assertion, the extension filter and the thumbnail rule are decided in
 * one place (design G3); an asset that is not a still image is dropped and
 * handed to `onExcluded` rather than published as a broken `<img>`.
 */
function skuImages(
  productId: string,
  sku: BootstrapSku,
  onExcluded: (url: string) => void,
): ProductImage[] {
  const urls = [
    sku.images?.defaultImage?.image ?? null,
    ...(sku.images?.gallery ?? []).map((g) => g?.image ?? null),
  ].filter((u): u is string => typeof u === 'string' && u.length > 0);

  const images: ProductImage[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    const image = classifyImage(productId, url);
    if (!image) {
      onExcluded(url);
      continue;
    }
    images.push(image);
  }
  return images;
}

export function toVariant(
  sku: BootstrapSku,
  productId: string,
  onExcluded: (url: string) => void,
): Variant {
  return {
    sku: sku.partNumber,
    partNumber: sku.partNumber,
    name: cleanName(sku.productVariation ?? sku.pvName ?? sku.productName ?? sku.partNumber),
    price: toPrice(sku),
    images: skuImages(productId, sku, onExcluded),
  };
}

/** The lowest published variant price — what the catalog card shows as "from". */
function modelPrice(variants: Variant[]): Price | null {
  const priced = variants.filter((v): v is Variant & { price: Price } => v.price !== null);
  if (priced.length === 0) return null;
  return priced.reduce((low, v) => (v.price.amount < low.price.amount ? v : low)).price;
}

export interface BuildOptions {
  /** The garmin.com page the record was actually derived from. */
  sourceUrl: string;
  fetchedAt?: string;
  categories?: string[];
  /**
   * Called once per media asset excluded for not being a still image. The run
   * continues either way (`catalog-ingestion` — non-image assets are excluded);
   * the exclusion is the caller's to report.
   */
  onExcluded?: (subject: string, detail: string) => void;
}

export function buildRawProduct(
  productId: string,
  name: string,
  bootstrap: Bootstrap,
  options: BuildOptions,
): RawProduct {
  const skus = selectSkusForProduct(bootstrap, productId);
  const primary = specSku(skus);

  // The same asset can sit on several SKUs of one model, so the exclusion is
  // reported once per model and URL rather than once per SKU it appears on.
  const excluded = new Set<string>();
  const variants = skus
    .map((sku) => toVariant(sku, productId, (url) => excluded.add(url)))
    .sort((a, b) => a.partNumber.localeCompare(b.partNumber));
  for (const url of excluded) {
    options.onExcluded?.(`${productId} ${name}`, `not a still image, excluded: ${url}`);
  }

  // Already the deduplicated union of every variant's images, so this covers both.
  const modelImages: ProductImage[] = [];
  const seen = new Set<string>();
  for (const image of variants.flatMap((v) => v.images)) {
    if (seen.has(image.full)) continue;
    seen.add(image.full);
    modelImages.push(image);
  }
  assertImageHost(productId, modelImages.map((image) => image.full));

  return {
    id: productId,
    name: cleanName(primary?.productName ?? name),
    sourceUrl: options.sourceUrl,
    fetchedAt: options.fetchedAt ?? new Date().toISOString(),
    locale: bootstrap.locale ?? LOCALE,
    storeCode: bootstrap.storeCode ?? STORE_CODE,
    categories: options.categories ?? [],
    price: modelPrice(variants),
    specs: parseSpecTable(primary?.tabs?.specsTab?.content),
    variants,
    boxContents: parseBoxContents(primary?.tabs?.inTheBoxTab?.content),
    images: modelImages,
    description: primary?.seo?.ogDescription ?? undefined,
  };
}

export function buildFromIndexEntry(
  entry: ProductIndexEntry,
  bootstrap: Bootstrap,
  sourceUrl: string,
  onExcluded?: BuildOptions['onExcluded'],
): RawProduct {
  return buildRawProduct(entry.id, entry.name, bootstrap, {
    sourceUrl,
    categories: entry.categories,
    onExcluded,
  });
}
