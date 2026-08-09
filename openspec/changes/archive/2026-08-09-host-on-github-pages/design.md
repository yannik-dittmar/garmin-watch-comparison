## Context

See proposal.md — Why.

Constraints that shape everything below, established by inspection and by probing the live hosts:

- **`www.garmin.com` sends no `access-control-allow-origin` header.** Verified on the category API, on an `OPTIONS` preflight (which answers `allow: GET, HEAD` and nothing CORS-related), and on the sitemap. Every byte of catalog data comes from this host, so a browser cannot read any of it cross-origin.
- **`res.garmin.com` sends `access-control-allow-origin: *`**, applies no referer check (verified with a `github.io` referer), sets `cache-control: public, immutable, max-age=31536000`, and content-negotiates WebP — 32.7 KB vs 50.9 KB for the same URL. Only `cf-lg` exists; `cf-sm`, `cf-md`, `cf-xl` are 404.
- **`www.garmin.com` runs Cloudflare with bot management** (`__cf_bm` cookie). The pipeline's `Fetcher` uses Node `fetch`, which persists no cookies, so all ~108 requests of a run currently arrive cookie-less.
- The pipeline is plain `fetch` plus inline-JSON extraction — no headless browser. A full run is ~108 requests and ~36 MB. `playwright` is a dev dependency for local verification only.
- `src/data/load.ts` already resolves URLs through `import.meta.env.BASE_URL`, and `imageUrl()` already passes any non-`/`-prefixed path through untouched, so absolute remote URLs work with no client change.
- `src/App.tsx` already uses `HashRouter`.
- `scripts/normalize/index.ts:124` already implements a regression guard that refuses to overwrite a snapshot that got worse.
- The Docker stack is kept (see proposal), and nginx serves at the domain root, so two deploy targets with different base paths must coexist.

## Goals / Non-Goals

**Goals:**

- One workflow file that a maintainer can read top to bottom and understand the whole refresh-and-publish cycle.
- Failure is always safe: no run can replace a good published snapshot with a worse one.
- The scrape's execution environment is a one-line change, because whether GitHub's IP ranges are acceptable to Cloudflare is unknown until tried.
- No secrets. The workflow uses only the built-in token.

**Non-Goals:**

- Reducing the size of the committed snapshot. Snapshots are committed on every run so that history accumulates; growth is accepted.
- Any price-history feature. Only the property that makes it possible later is being preserved.
- Preserving offline capability. It is deliberately traded away.
- Restructuring the pipeline's stage boundaries beyond deleting the images stage.

## Decisions

### D1 — The scrape runs in CI and commits its output; it is never done client-side

Client-side scraping was considered and is impossible, not merely inadvisable. `www.garmin.com` returns no `access-control-allow-origin`, so `fetch()` from the published origin is rejected by the browser before JS sees a byte — the 200 a command-line client observes is irrelevant, since CORS is enforced by browsers and not by servers.

Independently fatal even if that changed: ~108 requests and ~36 MB of HTML per visitor; a burst of product-page requests from every visitor's own IP, which is a *more* bot-like signature than one paced scraper and spends the visitor's IP reputation against garmin.com; ~1000 lines of Node-only normalization (German decimal parsing, field mapping, lineage) to port to the browser; and the loss of the regression guard, which today converts an upstream structure change into a failed run instead of a broken page.

*Alternative rejected*: a CORS proxy or Cloudflare Worker. It unblocks the fetch but is a backend to operate, and its egress is a datacenter IP — the same bot exposure with an extra hop.

### D2 — Two jobs in one workflow, not one job and not two workflows

```
scrape-and-publish.yml
  on: schedule (daily) | workflow_dispatch | push (site code paths)

  job: scrape          runs-on: ubuntu-latest      ← the swappable line
    ingest --no-cache → normalize → regression guard
    commit data/ → upload data/ as artifact
    skipped when the trigger is a code-only push

  job: publish         runs-on: ubuntu-latest   needs: scrape (if: always/success mix)
    download artifact (or use committed data/) → build → upload-pages-artifact → deploy-pages
```

Two *workflows* was rejected because commits pushed with the default `GITHUB_TOKEN` do not trigger `push`-triggered workflows — a separate deploy workflow would simply never fire after a scrape commit. Working around that needs `workflow_run` chaining or a PAT, both more moving parts than a job dependency.

A single *job* was rejected because the whole point of splitting is that `runs-on` for the scrape can move to a self-hosted runner without restructuring anything (see D3 and the first risk below).

### D3 — Jobs hand off via an artifact, not via a second checkout

`publish` consumes `data/` as a workflow artifact rather than checking out the branch the `scrape` job just pushed to. A second checkout races with the push and, on a self-hosted scrape runner, would depend on the push having propagated. The artifact is what the job that produced it actually built.

### D4 — Commit the normalized snapshot; do not commit `data/raw/`

Per the scope decision. `data/catalog.json`, `data/meta.json`, and `data/models/` become tracked; `data/raw/` and the ~96 MB `data/raw/.http-cache` stay ignored.

The load-bearing consequence is easy to miss: the regression guard compares against the *previous* snapshot, and on a fresh runner the only source of that is git. Committing the normalized snapshot is therefore what makes the guard work in CI, not just what makes a code-only rebuild possible.

The cost is that a field-map or parser fix cannot be re-normalized in CI without a fresh scrape, because the raw records are not in the repo. Locally this is unaffected — `data/raw/` and the response cache are still there.

### D5 — Base path is set at build time, per target, not baked into `vite.config.ts`

Docker is kept and nginx serves at `/`; Pages serves at `/<repo>/`. So `base` cannot be a constant. The Pages build passes `--base=/<repo>/`; the Docker build calls plain `vite build` and keeps `/`. Everything downstream already respects it: `load.ts` reads `import.meta.env.BASE_URL`, and `HashRouter` needs no server rewrites.

`.nojekyll` is added so Pages skips a Jekyll pass. Vite emits no underscore-prefixed paths today, so this is insurance rather than a fix.

*Alternative rejected*: publish at a user site or custom domain to keep `base: '/'`. Both were declined in scope.

### D6 — Pages is deployed from a workflow artifact, not a `gh-pages` branch

`upload-pages-artifact` plus `deploy-pages`. Nothing built ever lands in git, so `dist/` stays ignored and the repository grows only by snapshot data. Requires `pages: write` and `id-token: write` on the publish job, and `contents: write` on the scrape job only — least privilege per job rather than workflow-wide.

### D7 — `Fetcher` gets a minimal per-run cookie jar

An in-memory map populated from `set-cookie` and replayed on subsequent requests, scoped to one run and one host set. This exists so Cloudflare's `__cf_bm` is returned instead of every request presenting as an unrelated first-time visitor. Roughly 15 lines in `scripts/lib/fetcher.ts`; no cookie library, because the pipeline needs storage and replay, not domain/path matching semantics.

### D8 — Automated refreshes bypass the response cache explicitly

The on-disk cache has no TTL: a stored response is served forever, so a cached price can never change. A refresh whose entire purpose is detecting change must not read it. A fresh runner has no cache, which makes this true by accident — the flag is passed anyway so the intent is enforced in the workflow rather than dependent on runner state, and so an `actions/cache` step can never silently reintroduce it.

The same latent bug exists today in the Docker path: `REFRESH=1 docker compose up` runs `npm run ingest` with no `--no-cache` against a mounted `./data`, so it re-reads the cache and can change nothing. Fixing the entrypoint is in scope since the entrypoint is being edited anyway.

### D9 — Image host is validated where URLs enter and again where the snapshot is written

The deleted guard asserted that no remote URL survived into `data/`. Its replacement asserts the opposite: every image URL is on `res.garmin.com`. Checked in ingestion, where URLs are extracted from the bootstrap, and asserted again in normalization, which is the last writer before publication. Two cheap checks rather than one, because the value here is preventing a changed upstream from injecting a third-party host into pages the browser will load.

### D10 — Missing imagery becomes a render-time fallback in a shared component

`missingImages` is retired: whether an image loads is no longer knowable when the snapshot is built. A single image component owns `onError` → labelled placeholder, plus `loading="lazy"` and `decoding="async"`, and is used by both the catalog grid and the detail view. The catalog page references ~83 images at ~33 KB of WebP each, so lazy loading is what keeps the first paint cheap.

*Alternative rejected*: `HEAD`-check every image URL during the scrape. That is 1641 extra requests for a guarantee that expires the moment Garmin rotates a URL, and the browser-side fallback is needed regardless.

### D11 — Fonts move to exact-version jsDelivr URLs

The local filenames in `src/styles/fonts.css` already match `@fontsource`'s `files/` naming exactly, so the rewrite is mechanical:

```
/fonts/<name>.woff2
  → https://cdn.jsdelivr.net/npm/@fontsource-variable/archivo@5.3.0/files/<name>.woff2
  → https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans@5.3.0/files/<name>.woff2
  → https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5.3.0/files/<name>.woff2
```

Verified: all four sampled URLs return 200 with `access-control-allow-origin: *` and `cache-control: public, max-age=31536000, immutable`. Pinned to an exact version rather than `@5`, because a range is mutable, costs a resolution redirect, and would let a typeface change under a snapshot that is otherwise reproducible. `unicode-range` splits stay as they are — `fēnix` needs U+0113, so the latin-ext files are load-bearing, not optional. A `preconnect` to `cdn.jsdelivr.net` is added to `index.html` because `@font-face` rules reached through a CSS `@import` are discovered late.

*Alternative rejected*: re-vendor the fonts into `public/fonts/`. The `@fontsource` packages, the directory, and the nginx block are already gone and the `catalog-ingestion` purpose already grants fonts a CDN exception — the direction is set, and only `fonts.css` was left behind.

### D12 — `noindex` via meta tag, with `robots.txt` permitting the crawl

`index.html` already carries `<meta name="robots" content="noindex, nofollow">`. The nginx `X-Robots-Tag` header has no equivalent on Pages, so the meta tag becomes the sole mechanism and must be preserved through the title change.

`public/robots.txt` must **not** `Disallow: /`. A crawler that is blocked from fetching the page never reads the `noindex` in it, and the URL can still be indexed from an external link. Allow the crawl so the instruction is readable.

### D13 — Snapshot stays in `data/` and keeps the existing Vite plugin

Moving the three site-facing files to `public/data/` would delete ~60 lines of `vite.config.ts`, but it would also put pipeline output inside `public/`, where `data/raw/` and `data/reports/` must never appear. The plugin already exposes exactly the three published entries and nothing else. Not worth coupling that refactor to a hosting migration.

### D14 — Docker keeps working, minus the images stage and minus the offline claim

`docker/entrypoint.sh` drops `npm run images`; `docker/nginx.conf` drops the `/img/` block; the build stays base-`/`. The tension is worth stating plainly: with imagery and fonts remote, the Docker path is a local server, not an offline one. `README.md`'s "offline comparison site" claim becomes wrong and is corrected rather than quietly left.

## Risks / Trade-offs

- **Cloudflare bot management rejects scrapes from GitHub-hosted runners.** The largest unknown; GitHub runners are Azure datacenter ranges, which score poorly. → Mitigated three ways: the cookie jar (D7) removes the most obvious tell; failure is safe, because the regression guard blocks the commit and the live site keeps its last good snapshot; and the fallback is flipping `runs-on` to a self-hosted runner on a residential IP (D2), a one-line change. Reasons for optimism: the cookie is plain `__cf_bm` rather than a managed challenge or Turnstile, and the API answers `cf-cache-status: REVALIDATED`, meaning Cloudflare is caching that endpoint rather than gating it. One `workflow_dispatch` run settles it.

- **Garmin adds hotlink protection later.** Every image on the site breaks at once, and the browser-side placeholder would mask it as "no imagery" rather than reporting it. → The workflow asserts one known image URL returns 200 with a foreign referer and fails loudly if not. Cheap, and it turns a silent visual regression into a red run.

- **Image URLs rotate.** They embed per-SKU UUIDs; a URL that changes upstream leaves the snapshot pointing at a 404 until the next refresh. → The daily cadence bounds the staleness window to a day, and the placeholder covers it. This is strictly better than the mirror, which pointed at a file that was correct but months old.

- **Repository growth.** ~6.3 MB of pretty-printed JSON re-committed per run, and per-model `fetchedAt` means every run dirties all 83 model files even when no watch changed, so no run produces an empty diff. → Accepted deliberately: this is the price of the price-history option. Git deltas on near-identical JSON are small, `data/raw/` is excluded, and history can be pruned later if it ever matters.

- **Visitor IPs reach two third parties.** `res.garmin.com` and `cdn.jsdelivr.net`. → Disclosed in the disclaimer rather than mitigated; it is inherent to the approach.

- **A field-map fix needs a fresh scrape in CI** (D4). → Accepted; local iteration still has the raw records and the response cache, and only the final verification run pays the cost.

- **Legal exposure from republishing Garmin's content under a Garmin-leading name.** → `noindex`, a disclaimer on every page, prominent unaffiliated status, and deep links to the official product pages. Not legal advice; the Impressum question was considered and declined in scope.

- **Cron timing drifts** under GitHub load. → Irrelevant at a daily cadence; `workflow_dispatch` covers impatience.

## Migration Plan

1. Delete the images stage and invert the host guard (D9), so ingestion stops writing local paths. Re-run the pipeline locally and confirm the snapshot carries `res.garmin.com` URLs.
2. Client-side image handling (D10) and the font rewrite (D11), verified locally against a real snapshot.
3. Title, disclaimer footer, `#/legal` route, `robots.txt`, `.nojekyll` (D12).
4. `.gitignore` change plus the first snapshot commit. This is the point at which the regression guard gains a baseline in git (D4).
5. `Fetcher` cookie jar and the `--no-cache` fix in the Docker entrypoint (D7, D8).
6. The workflow (D2, D3, D5, D6), initially exercised through `workflow_dispatch` only — no schedule yet.
7. Enable Pages, confirm the deployed site under `/<repo>/`, then enable the schedule.
8. Docker and README corrections (D14).

**Rollback**: at any point before step 7 nothing user-visible has changed. After it, disabling the Pages source stops publication without touching the repository, and the Docker path remains a working deployment throughout. A bad snapshot is recoverable by reverting its commit and re-running `publish` alone, since publication reads committed data.

## Open Questions

- Which hour to schedule. Garmin's price changes are not known to cluster, so any off-peak hour will do; pick one when the workflow lands.
- Whether the scrape ends up on a self-hosted runner. Deliberately deferred to the first real run rather than guessed at — D2 exists so that the answer costs one line either way.
- Whether to aggregate a `price-history.json` later, and whether it belongs in the scrape job or a separate one. Nothing in this design forecloses either.
