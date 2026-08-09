# `data/` — the generated snapshot

Everything in this folder is **generated**. Nothing here is edited by hand; a value that
looks wrong is fixed in the stage that produced it and the stage is re-run.

The snapshot is the product: the site is a pure function of these files, so the normalized
half is committed and `git checkout data/` rolls back to the previous snapshot. `data/raw/`
and `data/reports/` stay untracked — they are the pipeline's working state, not the product.

Committing the snapshot is also what lets the regression guard work in CI: it compares a run
against the previous snapshot, and on a fresh runner git is the only place that can come
from.

All of it derives from `www.garmin.com` and `res.garmin.com` only, locale `de-DE`,
store code `DE`.

## Stages

| Stage | Command | Reads | Writes |
|---|---|---|---|
| 1. ingest | `npm run ingest` | garmin.com | `data/raw/**` |
| 2. normalize | `npm run normalize` | `data/raw/products/*.json` | `data/catalog.json`, `data/models/*.json`, `data/meta.json`, `data/reports/*.json` |

Full refresh: `npm run ingest && npm run normalize`.
Re-running only `normalize` after a field-map fix is safe and fast — it never touches the
network.

Imagery is **referenced, not downloaded**. Ingestion keeps Garmin's own `res.garmin.com`
URLs in the records, and both stages fail the run if an image URL is on any other host, so
a changed upstream cannot inject a third-party image host into the published pages.

Each reference is a `ProductImage`, not a bare URL:

```json
{ "full": "…/v/cf-lg.jpg", "thumb": "…/v/cf-sm.jpg" }
```

`full` is the 600 px rendition the detail view shows; `thumb` is the CDN's 150 px rendition
of the same asset, derived by rewriting an exact trailing `-lg` token in the basename. It is
`null` where no such name can be formed — the 88 assets whose basename carries a UUID suffix
have no `-sm` sibling on the CDN — and readers fall back to `full` for those thumbnails.
Both URLs are re-checked against `res.garmin.com` in normalization.

Media that is not a still image is **not** recorded as an image reference. An entry whose
extension is outside `.jpg`/`.jpeg`/`.png`/`.webp` — today exactly one, an mp4 on the
fēnix 7 Pro page — is dropped at the ingest boundary and listed in `data/reports/ingest.json`
as an `excluded` entry; the run continues.

## Files

### `data/raw/` — stage 1, verbatim upstream data

| File | Contents |
|---|---|
| `categories.json` | `RawCategory[]` — the wearable categories from `category-sitemap.xml`, each with the `categoryKey` read out of its page's inline state. The URL slug is *not* the key. |
| `products-index.json` | `ProductIndexEntry[]` — the union of `getCategoryProducts` over every category, merged by product id, each entry listing every category it appeared in. Excluded (non-watch) products stay in the file carrying an `excluded` reason. |
| `category-filters.json` | Garmin's own facet vocabulary per category, from `getCategoryFilters`, reused as UI facets. |
| `products/<id>.json` | `RawProduct` — one per included model: the complete spec table parsed out of the page's `GarminAppBootstrap` blob, every SKU with part number/price/images, box contents, price, source URL, and the fetch timestamp. |
| `.http-cache/` | On-disk response cache keyed by URL. Not committed, and it has **no TTL** — a stored response is served forever, so an automated refresh must pass `--no-cache` or it could never observe a price change. Delete it to force a true refetch; keep it to make an interrupted run resumable. |

### `data/` — stage 2, the site's input

| File | Contents |
|---|---|
| `catalog.json` | `{ meta: SnapshotMeta, models: CatalogModel[] }` — normalized fields for every model. Loaded on boot, so it deliberately excludes the raw spec rows. |
| `models/<id>.json` | `ModelDetail` — the full raw spec set, all variants and box contents for one model. Fetched lazily when a detail view opens. |
| `meta.json` | `SnapshotMeta` on its own, for anything that needs the snapshot date without the catalog. |

### `data/reports/` — stage 2, coverage and audit output

These exist because the failure mode of a scraper is quiet coverage loss. They are run
output, not debug logging, and are reviewed on every refresh (task 12.1).

| File | Contents |
|---|---|
| `ingest.json` | `RunReport` — fetch failures, every product excluded from the catalog with its reason, and every media asset dropped for not being a still image. |
| `discovery-gap.json` | Watch-named products present in `getDisplayableProducts` (the 1185-product master list) but absent from the category union. A non-empty file means discovery missed a category. |
| `unmapped-labels.json` | Raw spec row labels that no normalized field consumed, with the models they occur on. |
| `sparse-fields.json` | Normalized fields empty for an unusually high share of models — the signature of a label pattern that stopped matching. |
| `normalize.json` | `RunReport` for the normalize stage, including any regression-guard refusal and any model Garmin publishes no image for. |

## Regression guard

`normalize` refuses to overwrite an existing snapshot with one that has fewer models, or
that loses specs for models which previously had them. It writes the report and stops
rather than degrading the dataset silently. Override deliberately with
`npm run normalize -- --force` once the shrinkage is understood (e.g. Garmin discontinued
a model).

The guard is what makes an unattended refresh safe: in CI a tripped guard exits non-zero,
so the run fails, nothing is published, and visitors keep the last good snapshot.

## Provenance and use

Garmin text, specifications and imagery are reproduced for comparison purposes. The
published site is unofficial, unaffiliated with Garmin, marked `noindex`, and carries the
full disclaimer at `#/legal`.
