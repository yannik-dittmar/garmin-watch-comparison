import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const DATA = path.join(ROOT, 'data');
export const RAW = path.join(DATA, 'raw');
export const RAW_PRODUCTS = path.join(RAW, 'products');
export const HTTP_CACHE = path.join(RAW, '.http-cache');
export const MODELS = path.join(DATA, 'models');
export const REPORTS = path.join(DATA, 'reports');
export const PUBLIC = path.join(ROOT, 'public');
export const IMG = path.join(PUBLIC, 'img');
export const FIXTURES = path.join(ROOT, 'tests', 'fixtures');

export const LOCALE = 'de-DE';
export const STORE_CODE = 'DE';
export const APP_NAME = 'www-category-pages';

export const GARMIN = 'https://www.garmin.com';
export const GARMIN_RES = 'https://res.garmin.com';

/** The only hosts ingestion is allowed to contact (`catalog-ingestion` — provenance). */
export const ALLOWED_HOSTS = new Set(['www.garmin.com', 'res.garmin.com']);

export async function ensureDirs(...dirs: string[]): Promise<void> {
  for (const dir of dirs) await mkdir(dir, { recursive: true });
}
