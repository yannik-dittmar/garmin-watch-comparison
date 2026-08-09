import type { CatalogModel, ModelDetail, SnapshotMeta } from './contract';

/**
 * Snapshot loading (task 7.5).
 *
 * `catalog.json` holds the normalized fields for every model and is fetched once
 * on boot. The raw spec corpus — roughly 82 models × ~260 rows — lives in
 * per-model files that are fetched only when a detail view opens (design D5).
 *
 * Both come from the local snapshot. Nothing here ever contacts garmin.com.
 */

export interface Catalog {
  meta: SnapshotMeta;
  models: CatalogModel[];
}

const base = import.meta.env.BASE_URL;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} konnte nicht geladen werden (HTTP ${response.status})`);
  }
  return (await response.json()) as T;
}

export function loadCatalog(): Promise<Catalog> {
  return getJson<Catalog>(`${base}data/catalog.json`);
}

const detailCache = new Map<string, Promise<ModelDetail>>();

export function loadModelDetail(id: string): Promise<ModelDetail> {
  let pending = detailCache.get(id);
  if (!pending) {
    pending = getJson<ModelDetail>(`${base}data/models/${id}.json`).catch((error: unknown) => {
      detailCache.delete(id);
      throw error;
    });
    detailCache.set(id, pending);
  }
  return pending;
}

export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('/') ? `${base.replace(/\/$/, '')}${path}` : path;
}
