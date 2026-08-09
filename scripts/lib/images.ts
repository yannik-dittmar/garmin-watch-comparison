import { IMAGE_HOST } from './paths.js';
import type { ProductImage } from '../../src/data/contract.js';

/**
 * Image URLs are recorded, not downloaded, so this is where a changed upstream
 * could inject a third-party host into pages the browser will load. Asserted twice
 * — in ingestion, where the URLs are extracted from the bootstrap, and again in
 * normalization, the last writer before publication (design D9).
 *
 * Fatal on purpose. A model Garmin publishes no image for is a gap in the data and
 * is merely reported; an image on a host that is not Garmin's is a structural
 * change, and continuing would publish it.
 */
export function assertImageHost(productId: string, urls: readonly string[]): void {
  for (const url of urls) {
    let host: string;
    try {
      host = new URL(url).host;
    } catch {
      throw new Error(`${productId}: image URL is not absolute: ${url}`);
    }
    if (host !== IMAGE_HOST) {
      throw new Error(`${productId}: image URL is not on ${IMAGE_HOST}: ${url}`);
    }
  }
}

/** Extensions that name a still image. Anything else is not an image reference. */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Garmin's CDN publishes `-sm` (150 px), `-md` (300 px) and `-lg` (600 px)
 * renditions of the same asset, named by a suffix token on the basename. The
 * thumbnail URL is therefore derivable rather than fetched (design G2):
 *
 *   …/v/cf-lg.jpg                      → …/v/cf-sm.jpg
 *   …/v/pd-03-lg.jpg                   → …/v/pd-03-sm.jpg
 *   …/v/cf-lg-b6111ea5-….jpg           → null
 *
 * The rule only fires on an exact trailing `-lg` token before the extension.
 * Names carrying a UUID after the token were probed against the CDN and their
 * `-sm` sibling is a 404, so `null` — "the CDN publishes none" — is the honest
 * answer and the UI falls back to the full-size asset. An unfamiliar shape
 * yields `null` for the same reason: no thumbnail beats a broken one.
 */
export function deriveThumb(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const slash = parsed.pathname.lastIndexOf('/');
  const basename = parsed.pathname.slice(slash + 1);
  const dot = basename.lastIndexOf('.');
  if (dot <= 0) return null;
  const stem = basename.slice(0, dot);
  const extension = basename.slice(dot);
  if (!stem.endsWith('-lg')) return null;
  parsed.pathname = `${parsed.pathname.slice(0, slash + 1)}${stem.slice(0, -'-lg'.length)}-sm${extension}`;
  return parsed.toString();
}

/**
 * The single place that decides what a usable product image is (design G3):
 * host, extension, and thumbnail, in that order.
 *
 * The host assertion stays fatal — a foreign host is a structural change and
 * must never reach the snapshot. A non-image asset is not fatal and not a
 * failed image either: Garmin does publish the fēnix 7 Pro's mp4, so rendering
 * "kein Bild verfügbar" for it would state something false to the reader. It is
 * dropped here, at the boundary, and the caller reports it.
 */
export function classifyImage(productId: string, url: string): ProductImage | null {
  assertImageHost(productId, [url]);
  const pathname = new URL(url).pathname.toLowerCase();
  if (!IMAGE_EXTENSIONS.some((extension) => pathname.endsWith(extension))) return null;
  return { full: url, thumb: deriveThumb(url) };
}
