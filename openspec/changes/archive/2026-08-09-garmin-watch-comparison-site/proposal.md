## Why

Choosing a Garmin smartwatch is hard: garmin.com spreads ~100+ current wrist models across a dozen category pages, its built-in compare tool caps out at a handful of watches, and each model's ~200-row spec table can only be read one product at a time. There is no way to see, in one view, which models share a feature, how battery life or case size actually differ, or what a higher price actually buys. This project builds a private, offline-capable comparison site over the official Garmin data so a purchase decision can be made from one screen instead of thirty browser tabs.

## What Changes

- Add a **scraper toolchain** that pulls the current Garmin wrist-smartwatch catalog from official `www.garmin.com` endpoints only, and writes a versioned local dataset:
  - category discovery via `category-sitemap.xml` + `/c/api/getCategoryFilters`
  - product enumeration via `/c/api/getCategoryProducts?categoryKey=…&locale=de-DE&storeCode=DE`
  - full per-model specs by parsing the `GarminAppBootstrap` JSON embedded in each `/de-DE/p/<id>/` page (spec table, SKU/variant list, box contents, price)
  - product imagery downloaded from `res.garmin.com` to a local asset folder
- Add a **spec normalizer** that maps Garmin's free-form German spec rows onto a stable, typed comparison schema (numeric case size, weight, display resolution, battery hours per mode, water rating, boolean feature flags, enum categories), keeping the full raw spec set alongside the normalized fields.
- Add a **static comparison website** built directly in this folder:
  - catalog overview with faceted filtering, full-text search, and sorting
  - side-by-side comparison of up to 4 watches with a "differences only" mode
  - a detail view exposing *every* spec Garmin publishes for a model, including all colour/case variants
  - visual analysis: battery-life bars, price-vs-capability scatter, feature heatmap across series, to-scale case-size overlay, series release timeline
  - shareable URL state, favourites shortlist, dark mode
- Scope is **current wrist smartwatches only** (Forerunner, fēnix, Instinct, Venu, vívoactive, epix, Enduro, tactix, MARQ, Lily, Approach, Descent), **de-DE locale only**, and a **static snapshot refreshed by an explicit script run** — no runtime calls to Garmin from the browser.
- Research work is split into subagent-sized units (one agent per watch family / per pipeline stage) so catalog ingestion parallelises.

## Capabilities

### New Capabilities
- `catalog-ingestion`: Discovering, fetching, and caching the Garmin wrist-smartwatch catalog and its imagery from official garmin.com sources into a local, reproducible snapshot.
- `spec-normalization`: Turning Garmin's per-model raw spec tables into a stable typed schema that is comparable across families and generations, without losing any raw spec.
- `catalog-browse`: Overview, search, faceted filtering, and sorting across the whole watch catalog.
- `watch-comparison`: Side-by-side comparison of selected watches, including difference highlighting and export of the comparison state via URL.
- `watch-detail`: Full single-watch view exposing every published specification, variant, and image.
- `spec-visualization`: Chart-based analysis of the catalog (battery, price/capability, feature coverage, physical size, release timeline).

### Modified Capabilities

_None — this is a greenfield project; `openspec/specs/` is currently empty._

## Impact

- **New project in `/workspace`** (currently only `.claude/` and `openspec/`): app source, scraper scripts, generated dataset, downloaded images, build config.
- **New dependencies**: a JS/TS frontend stack plus a Node-based scraper; exact choices are settled in `design.md`.
- **External systems**: read-only HTTP against `www.garmin.com` and `res.garmin.com`. `robots.txt` permits `/p/` and `/c/`; the scraper must stay polite (rate-limited, cached, single pass per refresh) and must never run from the browser.
- **Data freshness**: prices and model availability are frozen at snapshot time; every page must surface the snapshot date so stale data is never mistaken for live data.
- **Legal note**: Garmin text, specs, and imagery are reproduced for private, personal use only. The site is not to be published.
