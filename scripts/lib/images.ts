import { IMAGE_HOST } from './paths.js';

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
