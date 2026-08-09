/**
 * Stage 1b — `GarminAppBootstrap` extraction (design D3).
 *
 * The product page ships everything worth having as an inline JSON object,
 * before any JS runs: the full spec table as escaped HTML, every SKU with its
 * price and images, and the box contents. `fetch` + JSON extraction is enough;
 * no headless browser is involved.
 */

export interface BootstrapPrice {
  currencyCode?: string | null;
  formattedPrice?: string | null;
  price?: number | null;
}

export interface BootstrapSku {
  productId: string;
  productName: string;
  productVariation?: string | null;
  pvName?: string | null;
  partNumber: string;
  url?: string | null;
  seo?: { title?: string; ogDescription?: string } | null;
  images?: {
    defaultImage?: { image?: string | null; altTag?: string | null } | null;
    gallery?: Array<{ image?: string | null; altTag?: string | null }> | null;
  } | null;
  price?: {
    listPrice?: BootstrapPrice | null;
    salePrice?: BootstrapPrice | null;
  } | null;
  tabs?: {
    specsTab?: { title?: string | null; content?: string | null } | null;
    inTheBoxTab?: { title?: string | null; content?: string | null } | null;
    overviewTab?: { title?: string | null; content?: string | null } | null;
  } | null;
}

export interface Bootstrap {
  locale?: string;
  storeCode?: string;
  productId?: string;
  sku?: string;
  /** Keyed by part number. One page's map spans several productIds. */
  skus: Record<string, BootstrapSku>;
}

/**
 * Brace-matches the object literal following `var GarminAppBootstrap =`, aware of
 * string literals and escapes so a `}` inside a marketing string cannot end it.
 */
export function extractBootstrap(html: string): Bootstrap {
  const marker = /var\s+GarminAppBootstrap\s*=\s*/.exec(html);
  if (!marker) throw new Error('no GarminAppBootstrap assignment on page');

  const start = html.indexOf('{', marker.index + marker[0].length);
  if (start === -1) throw new Error('GarminAppBootstrap assignment is not an object literal');

  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;

  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) inString = false;
      continue;
    }
    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
    } else if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        const parsed = JSON.parse(html.slice(start, i + 1)) as Bootstrap;
        if (!parsed.skus || typeof parsed.skus !== 'object') {
          throw new Error('GarminAppBootstrap carries no skus map');
        }
        return parsed;
      }
    }
  }
  throw new Error('unterminated GarminAppBootstrap object literal');
}

/**
 * Selects the SKUs belonging to one model.
 *
 * A single product page carries the SKUs of every sibling in its group — the
 * fēnix 8 page serves nine distinct productIds — so taking "the first block" or
 * "the page's own productId" silently yields another watch's specs. This is the
 * single most likely source of wrong data in the pipeline, hence the assertion.
 */
export function selectSkusForProduct(bootstrap: Bootstrap, productId: string): BootstrapSku[] {
  const all = Object.values(bootstrap.skus ?? {});
  const selected = all.filter((sku) => sku.productId === productId);

  if (selected.length === 0) {
    const available = [...new Set(all.map((s) => s.productId))].join(', ') || 'none';
    throw new Error(`page carries no SKU for productId ${productId} (has: ${available})`);
  }
  const wrong = selected.find((sku) => sku.productId !== productId);
  if (wrong) throw new Error(`selection leaked productId ${wrong.productId} into ${productId}`);

  return selected;
}

/** Every distinct model the page carries — a group page fills in its siblings for free. */
export function productIdsOnPage(bootstrap: Bootstrap): string[] {
  return [...new Set(Object.values(bootstrap.skus ?? {}).map((sku) => sku.productId))];
}

/**
 * The SKU whose spec tab is used for the model. Garmin publishes the same table
 * on every SKU of a model; the first one carrying a table wins, and the choice is
 * deterministic because part numbers are sorted.
 */
export function specSku(skus: BootstrapSku[]): BootstrapSku | null {
  const sorted = [...skus].sort((a, b) => a.partNumber.localeCompare(b.partNumber));
  return sorted.find((sku) => !!sku.tabs?.specsTab?.content) ?? sorted[0] ?? null;
}
