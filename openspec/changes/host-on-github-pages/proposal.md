## Why

The site is currently a private Docker deployment: nginx serves a bundle that was built at container start, after a 10–15 minute scrape, against a snapshot that lives only on a local volume. Nothing about it is shareable, and keeping it current means remembering to run the container with `REFRESH=1`.

GitHub Pages can host the whole thing for free — but Pages serves static files only, so the snapshot has to be produced somewhere else and committed. A scheduled GitHub Action is that somewhere. Dropping the 61 MB image mirror in favour of linking Garmin's own CDN is what makes the repository small enough for this to be reasonable, and it cuts the refresh from ~15 minutes to ~2.

## What Changes

**Publication**

- The site is published to GitHub Pages as a project page at `https://<user>.github.io/<repo>/`. Vite's `base` becomes `/<repo>/`; `HashRouter` already means no SPA rewrite is needed.
- A single scheduled workflow refreshes and republishes daily: scrape → normalize → regression guard → commit the snapshot → build → deploy. It also runs on `workflow_dispatch` and on pushes that touch site code.
- The workflow is split into a `scrape` job and a `deploy` job so the scrape's `runs-on` can be moved to a self-hosted runner in one line if Garmin's Cloudflare bot management blocks GitHub's datacenter IP ranges.
- The normalized snapshot (`data/catalog.json`, `data/meta.json`, `data/models/`) becomes committed content. It is the deploy input, and it is also what the regression guard compares against on a fresh runner.
- The site is published with a legal disclaimer and stays out of search indexes.

**Imagery — BREAKING**

- **BREAKING**: product images are no longer downloaded. `scripts/images/` and the `images` npm script are deleted; ingestion leaves `res.garmin.com` URLs in the records and the browser loads them directly.
- **BREAKING**: the "no remote image URL may survive into `data/`" guard inverts into its opposite — every image URL must be on `res.garmin.com`, so a changed upstream cannot inject a third-party image host into the published pages.
- **BREAKING**: a missing image can no longer be detected at build time. `missingImages` loses its meaning and the labelled placeholder becomes a render-time fallback in the browser.
- **BREAKING**: the site is no longer fully offline-capable. Catalog data is still entirely local; imagery is not.

**Fonts**

- Finish the half-migrated move to jsDelivr. The `@fontsource` packages, `public/fonts/`, and the nginx `/fonts/` block are already gone, and the `catalog-ingestion` purpose already grants fonts a CDN exception, but `src/styles/fonts.css` still points its 16 `@font-face` rules at `/fonts/*.woff2` — files that exist neither on disk nor in git. Fonts currently fall back to system faces. The rules move to version-pinned `cdn.jsdelivr.net` URLs.

**Naming and legal**

- Site title becomes **Garmin Smartwatch Vergleich**.
- A persistent footer disclaimer plus a `#/legal` route: unofficial and unaffiliated, all names/specs/imagery are Garmin's property, no warranty on prices or specifications, snapshot timestamp and store (Germany / de-DE / EUR) stated, deep links to the official product pages, and a note that the browser contacts `res.garmin.com` and `cdn.jsdelivr.net` directly.
- No Impressum.

**Scraper resilience**

- `Fetcher` gains a cookie jar so Cloudflare's `__cf_bm` cookie is replayed across a run instead of every one of the ~108 requests arriving cookie-less.
- CI runs must not reuse the HTTP response cache: it has no TTL, so a cached price would never change. A fresh runner gives this for free; it must not be restored from an Actions cache.

**Kept**

- The Docker stack stays as a local option. Its entrypoint drops the `images` stage, and the offline guarantee it used to provide is gone.

## Capabilities

### New Capabilities

- `site-publication`: how the site reaches its audience — static hosting on GitHub Pages under a base path, the scheduled refresh cadence and its failure behaviour, exclusion from search indexes, and the legal disclaimer the published site must carry.

### Modified Capabilities

- `catalog-ingestion`: "Local image assets" is replaced by remote image references with a host allowlist; "Browser never contacts Garmin" is replaced by a requirement that *catalog data* is local while imagery and fonts are named remote hosts; the regression guard becomes a publication gate; the polite-fetching requirement adds cross-run cookie continuity and forbids cache reuse on a scheduled refresh.
- `watch-detail`: model imagery is referenced from Garmin's CDN rather than stored locally, and the missing-image placeholder is decided when the image fails to load rather than when the snapshot is built.

## Impact

**Deleted**: `scripts/images/index.ts`, the `images` npm script, `/public/img/` (and its `.gitignore` entry).

**Added**: `.github/workflows/` (scheduled scrape + Pages deploy), `.nojekyll`, `public/robots.txt`, a legal route and footer component.

**Modified**: `vite.config.ts` (`base`), `index.html` (title, jsDelivr preconnect), `src/styles/fonts.css` (16 `@font-face` rules), `src/data/contract.ts` (image-path comments, `missingImages`), `src/components/ModelCard.tsx` and `src/routes/Detail.tsx` (`onError` fallback, `loading="lazy"`), `scripts/lib/fetcher.ts` (cookie jar), `scripts/ingest/product.ts` or `scripts/normalize/` (image host guard), `.gitignore` (commit the normalized snapshot), `docker/entrypoint.sh` and `docker/nginx.conf` (drop the images stage and `/img/`), `README.md`.

**Repository size**: ~6.3 MB of normalized JSON becomes committed content, re-committed on every daily run. `data/raw/` and the 96 MB HTTP cache stay untracked, so a field-map fix in CI requires a fresh scrape rather than a re-normalize.

**External runtime dependencies**: `res.garmin.com` (imagery, verified to serve `access-control-allow-origin: *`, no referer check, and WebP by content negotiation) and `cdn.jsdelivr.net` (fonts). Visitor IP addresses reach both.

**Risk**: Cloudflare bot management on `www.garmin.com` may reject scrapes from GitHub-hosted runners. Failure is safe — the regression guard blocks the commit and the live site keeps its last good snapshot — and the fallback is a self-hosted runner.

**Not in scope**: price history. Snapshots are committed on every run, including runs with no data change, so the history accumulates in git and the feature can be built later without re-architecting anything.
