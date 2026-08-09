import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { ALLOWED_HOSTS, HTTP_CACHE } from './paths.js';

/**
 * The polite fetch layer (`catalog-ingestion` — polite, resumable).
 *
 * - bounded concurrency + an inter-request delay, so a refresh never hammers garmin.com
 * - retry with exponential backoff, honouring Retry-After
 * - an on-disk response cache keyed by URL, which is what makes an interrupted run
 *   resumable and a re-run cheap
 * - a hard host allowlist: anything outside www.garmin.com / res.garmin.com throws,
 *   so "official sources only" is enforced by the code rather than by discipline
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Safari/537.36';

export interface FetcherOptions {
  concurrency?: number;
  /** Minimum milliseconds between the starts of two requests. */
  delayMs?: number;
  attempts?: number;
  timeoutMs?: number;
  /** Set to skip the cache and refetch (the cache is still written). */
  noCache?: boolean;
}

export interface FetchStat {
  url: string;
  status: number;
  fromCache: boolean;
  bytes: number;
  at: string;
}

interface CacheMeta {
  url: string;
  status: number;
  contentType: string;
  fetchedAt: string;
}

function cacheKey(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 32);
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Fetcher {
  private readonly concurrency: number;
  private readonly delayMs: number;
  private readonly attempts: number;
  private readonly timeoutMs: number;
  private readonly noCache: boolean;

  private active = 0;
  private queue: Array<() => void> = [];
  private lastStart = 0;

  /** Every request the run made — the audit trail for the provenance scenario. */
  readonly log: FetchStat[] = [];

  constructor(opts: FetcherOptions = {}) {
    this.concurrency = opts.concurrency ?? 3;
    this.delayMs = opts.delayMs ?? 450;
    this.attempts = opts.attempts ?? 4;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.noCache = opts.noCache ?? false;
  }

  get stats() {
    const cached = this.log.filter((l) => l.fromCache).length;
    return { requests: this.log.length, cached, network: this.log.length - cached };
  }

  private assertAllowed(url: string): URL {
    const parsed = new URL(url);
    if (!ALLOWED_HOSTS.has(parsed.host)) {
      throw new Error(
        `Refusing to fetch ${parsed.host}: only ${[...ALLOWED_HOSTS].join(', ')} are permitted sources`,
      );
    }
    return parsed;
  }

  /** Bounded concurrency plus a minimum gap between request starts. */
  private async acquire(): Promise<void> {
    if (this.active >= this.concurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    const wait = this.lastStart + this.delayMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastStart = Date.now();
  }

  private release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }

  private async cachePaths(url: string) {
    const key = cacheKey(url);
    const dir = path.join(HTTP_CACHE, key.slice(0, 2));
    await mkdir(dir, { recursive: true });
    return { body: path.join(dir, `${key}.body`), meta: path.join(dir, `${key}.json`) };
  }

  private async readCache(url: string): Promise<{ body: Buffer; meta: CacheMeta } | null> {
    if (this.noCache) return null;
    const p = await this.cachePaths(url);
    if (!(await exists(p.body)) || !(await exists(p.meta))) return null;
    const meta = JSON.parse(await readFile(p.meta, 'utf8')) as CacheMeta;
    if (meta.status >= 400) return null;
    return { body: await readFile(p.body), meta };
  }

  private async writeCache(url: string, body: Buffer, meta: CacheMeta): Promise<void> {
    const p = await this.cachePaths(url);
    await writeFile(p.body, body);
    await writeFile(p.meta, JSON.stringify(meta, null, 2));
  }

  /** Fetch as bytes. Cached responses never touch the network. */
  async raw(url: string, accept = '*/*'): Promise<{ body: Buffer; contentType: string }> {
    this.assertAllowed(url);

    const cached = await this.readCache(url);
    if (cached) {
      this.log.push({
        url,
        status: cached.meta.status,
        fromCache: true,
        bytes: cached.body.length,
        at: cached.meta.fetchedAt,
      });
      return { body: cached.body, contentType: cached.meta.contentType };
    }

    await this.acquire();
    try {
      let lastError: unknown;
      for (let attempt = 1; attempt <= this.attempts; attempt++) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), this.timeoutMs);
          let res: Response;
          try {
            res = await fetch(url, {
              headers: {
                'User-Agent': USER_AGENT,
                Accept: accept,
                'Accept-Language': 'de-DE,de;q=0.9,en;q=0.6',
              },
              signal: controller.signal,
              redirect: 'follow',
            });
          } finally {
            clearTimeout(timer);
          }

          if (res.status === 429 || res.status >= 500) {
            const retryAfter = Number(res.headers.get('retry-after'));
            const backoff = Number.isFinite(retryAfter) && retryAfter > 0
              ? retryAfter * 1000
              : this.delayMs * 2 ** attempt;
            lastError = new Error(`HTTP ${res.status} for ${url}`);
            if (attempt < this.attempts) {
              await sleep(backoff);
              continue;
            }
            throw lastError;
          }

          const body = Buffer.from(await res.arrayBuffer());
          const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
          const meta: CacheMeta = {
            url,
            status: res.status,
            contentType,
            fetchedAt: new Date().toISOString(),
          };
          if (res.ok) await this.writeCache(url, body, meta);
          this.log.push({
            url,
            status: res.status,
            fromCache: false,
            bytes: body.length,
            at: meta.fetchedAt,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
          return { body, contentType };
        } catch (err) {
          lastError = err;
          if (attempt >= this.attempts) break;
          await sleep(this.delayMs * 2 ** attempt);
        }
      }
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    } finally {
      this.release();
    }
  }

  async text(url: string, accept = 'text/html,application/xhtml+xml,application/xml'): Promise<string> {
    const { body } = await this.raw(url, accept);
    return body.toString('utf8');
  }

  async json<T>(url: string): Promise<T> {
    const text = await this.text(url, 'application/json');
    return JSON.parse(text) as T;
  }
}

/** Runs `worker` over `items` with the same bounded concurrency as the fetcher. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}
