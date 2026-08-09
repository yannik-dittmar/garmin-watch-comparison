import { cleanName } from '../lib/families.js';
import { parseBoxContents, parseSpecTable } from './specs.js';
import {
  selectSkusForProduct,
  specSku,
  type Bootstrap,
  type BootstrapSku,
} from './bootstrap.js';
import { assertImageHost } from '../lib/images.js';
import { LOCALE, STORE_CODE } from '../lib/paths.js';
import type { Price, ProductIndexEntry, RawProduct, Variant } from '../../src/data/contract.js';

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

function skuImages(sku: BootstrapSku): string[] {
  const urls = [
    sku.images?.defaultImage?.image ?? null,
    ...(sku.images?.gallery ?? []).map((g) => g?.image ?? null),
  ];
  return [...new Set(urls.filter((u): u is string => typeof u === 'string' && u.length > 0))];
}

export function toVariant(sku: BootstrapSku): Variant {
  return {
    sku: sku.partNumber,
    partNumber: sku.partNumber,
    name: cleanName(sku.productVariation ?? sku.pvName ?? sku.productName ?? sku.partNumber),
    price: toPrice(sku),
    images: skuImages(sku),
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
}

export function buildRawProduct(
  productId: string,
  name: string,
  bootstrap: Bootstrap,
  options: BuildOptions,
): RawProduct {
  const skus = selectSkusForProduct(bootstrap, productId);
  const primary = specSku(skus);
  const variants = skus
    .map(toVariant)
    .sort((a, b) => a.partNumber.localeCompare(b.partNumber));

  // Already the deduplicated union of every variant's images, so this covers both.
  const modelImages = [...new Set(variants.flatMap((v) => v.images))];
  assertImageHost(productId, modelImages);

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
): RawProduct {
  return buildRawProduct(entry.id, entry.name, bootstrap, {
    sourceUrl,
    categories: entry.categories,
  });
}
