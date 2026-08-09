## Context

`/workspace` is empty apart from `.claude/` and `openspec/` — this is greenfield. Motivation is in `proposal.md`; behaviour contracts are in `specs/`.

Reconnaissance against garmin.com (already performed, results below) determines the whole ingestion approach:

| Source | What it yields |
|---|---|
| `https://www.garmin.com/de-DE/category-sitemap.xml` | 121 category URLs; 39 wearable-related |
| `GET /c/api/getCategoryProducts?categoryKey=<key>&locale=de-DE&storeCode=DE&appName=www-category-pages` | **complete** product list for a category in one response (`meta.totalProductCount` 59 for `Running`), each with id, name, short/long description, `res.garmin.com` image URL, product URL, grouped SKU ids |
| `GET /c/api/getCategoryFilters?categoryKey=<key>&locale=de-DE&storeCode=DE&appName=www-category-pages` | Garmin's own facet vocabulary (case size, battery band, display hardware, connectivity, series) |
| `GET /c/api/getDisplayableProducts?locale=de-DE` | master list of 1185 products (`productId`, `productName`, `partNumber`) |
| `GET /de-DE/p/<id>/` | inline `var GarminAppBootstrap = {…}` JSON holding the full spec table HTML (`specsTab`), box contents, every SKU with price and images |
| `res.garmin.com/de_DE/products/<partNumber>/g/cf-lg.jpg` | product imagery |

Constraints that shape the design:

- `robots.txt` allows `/p/` and `/c/`; no bot challenge was encountered with a normal browser UA. The crawler must stay polite anyway.
- The category **HTML** is a client-rendered shell — the ~11 `/p/` links present in it come from the global nav, not the product grid. Scraping category HTML would silently under-collect; the JSON API is the only correct enumeration path.
- Category keys are not the URL slug (`.../c/sports-fitness/running-smartwatches/` → `categoryKey: "Running"`). The key must be read out of each category page's inline state.
- Spec row labels are German free text and vary between families and generations. Normalization is a mapping problem, not a parsing problem.
- Garmin does not publish release dates for watches anywhere in this data.

## Goals / Non-Goals

**Goals**

- One reproducible command refreshes the whole dataset; one command builds a static site that runs with no network.
- Normalization is auditable: every unmapped spec row is reported, never dropped silently.
- The ingestion work decomposes into independent, subagent-sized units that can run in parallel.
- A visual design specific to this subject, carried by a defined token system rather than improvised per component.

**Non-Goals**

- No server, database, or API of our own. No user accounts. No deployment.
- No locale other than `de-DE`, no legacy/discontinued models, no non-watch wearables (see `proposal.md`).
- No price history, no stock/availability tracking, no retailer prices.
- No attempt to reconcile Garmin's marketing copy or reviews — specifications only.

## Decisions

### D1. Repository shape — one folder, three stages

```
/workspace
  scripts/ingest/        stage 1  fetch  → data/raw/**            (cached HTTP)
  scripts/normalize/     stage 2  map    → data/catalog.json, data/models/<id>.json
  scripts/images/        stage 2b download → public/img/<id>/*.jpg
  src/                   stage 3  the site (reads data/ as static assets)
  data/                  generated, committed (the snapshot is the product)
```

Stages are separate executables with file boundaries between them. Rationale: re-running normalization after a mapping fix must not refetch 130 pages, and a subagent can own exactly one stage without touching the others. Alternative — one monolithic scraper — rejected because it couples the slow, rate-limited step to the step that will be iterated on most.

### D2. Enumeration via the category API, verified against the master list

Discovery: parse `category-sitemap.xml` → fetch each wearable category page → read `categoryKey` out of its inline state → call `getCategoryProducts` for that key → union the results by product id.

Verification: cross-check the union against `getDisplayableProducts` (1185 products). Any product whose name matches a known watch family but is absent from the union is reported as a **discovery gap** rather than silently missing. This guards the "include ALL smartwatches" requirement against a category we failed to enumerate.

Alternative — walking all 3603 product-sitemap URLs and classifying each — rejected: 3603 page fetches to find ~130 watches, and classification from a product page is less reliable than Garmin's own category assignment.

### D3. Specs come from `GarminAppBootstrap`, not from rendered HTML

The product page ships the full spec table as escaped HTML inside a JSON blob, before any JS runs. `curl` + JSON extraction is sufficient; no headless browser. The extracted `specsTab.content` HTML is parsed with **cheerio** into `{section, label, value, valueKind}` rows, where `valueKind` distinguishes a `class="yes"`/`class="no"` marker cell from a text cell — that distinction is what makes the "supported / not supported / not published" tri-state in the specs possible.

One product page contains bootstrap blocks for **several related models** (e.g. the Forerunner 170 page carries 170, 170 Music, and 70). The parser must select the block matching the requested `productId`, not the first block on the page. This is the single most likely source of wrong data in the whole pipeline and gets a dedicated fixture test.

### D4. Normalization = declarative label map + typed parsers

A `field-map.ts` declares, per normalized field: the German label patterns that feed it, the value parser, and the unit. Parsers cover: dimension triples (`42,6 x 42,6 x 11,9 mm`), masses, resolutions (`390 x 390 Pixel`), durations across multi-mode battery blocks, water ratings, and yes/no-with-qualifier flags. All numeric parsing is German-locale aware (decimal comma, non-breaking space).

Two reports are emitted every run: **unmapped labels** (present in raw data, consumed by no field) and **sparse fields** (normalized field empty for an unusually high share of models). Rationale: the failure mode of a scraper like this is quiet coverage loss, so coverage is made a first-class output rather than something a human notices later.

### D5. Frontend stack — Vite + React + TypeScript + Tailwind v4, static build

Chosen over Astro: every route here is interactive (filters, selection, charts, detail spec search), and comparison selection is cross-route state, so the island model would mostly produce islands. Chosen over a framework with a server (Next) because there is nothing to serve.

Data loading: `data/catalog.json` (normalized fields for all models, small) is fetched on boot; `data/models/<id>.json` (the full raw spec set, the large part) is fetched lazily when a detail view opens. Rationale: the full raw corpus is roughly 130 models × ~200 rows and does not belong in the initial payload.

State: URL is the source of truth for filters, sort, selection, and differences-only (`specs/catalog-browse` and `specs/watch-comparison` both require restorability); favourites live in `localStorage`. Routing via React Router with `HashRouter`, so the built site also works opened straight from the filesystem.

### D6. Charts are hand-built SVG on `d3-scale`, not a chart library

The `dataviz` skill's mark specs (2px lines, 4px rounded data-ends, 2px surface gaps, selective direct labels, tri-state cells, keyboard-reachable marks, tabular fallback) are easier to satisfy by drawing SVG directly than by fighting a library's defaults. `d3-scale` and `d3-shape` are used for scales and path generation only — no `d3-selection`, React owns the DOM.

The categorical palette **must** be run through the skill's `scripts/validate_palette.js` for both light and dark surfaces before it ships; failures get re-stepped, not argued with. Encoding rules taken as given: one axis per chart, categorical hues in fixed order, sequential = one hue light→dark, colour never the only cue.

### D7. Timeline is a generation ladder, not a date axis

Garmin publishes no release dates in this data, and the "official sources only" rule forbids importing them from elsewhere. The timeline view therefore orders models **within a family by generation**, using the family/generation attributes derived in `spec-normalization` plus Garmin's own current-vs-previous catalog placement. Axis and caption say so explicitly. Alternative — inferring dates from product id ordering — rejected as fabricated precision.

### D8. Capability measure for the price/value scatter

"Capability" = the count of supported boolean feature flags in the normalized schema, with the flag list and the count shown in the view. Deliberately crude and transparent rather than a weighted score that would encode our own preferences as if they were data. Stated in the chart, per `specs/spec-visualization`.

### D9. Subagent decomposition

Work is cut so that agents share no files. Each ingestion agent writes only under its own output path and returns a coverage report.

| Agent | Owns | Input | Output |
|---|---|---|---|
| `discovery` | category enumeration | sitemap, category pages | `data/raw/categories.json`, `data/raw/products-index.json` |
| `family-fetcher` ×N (one per family: Forerunner, fēnix/epix/Enduro/tactix/MARQ, Instinct, Venu/vívoactive/Lily, Approach, Descent) | fetching + bootstrap extraction for its family only | products index | `data/raw/products/<id>.json` |
| `normalizer` | field map + parsers | raw products | `data/catalog.json`, `data/models/*.json`, coverage reports |
| `imager` | image download + local rewrite | raw products | `public/img/**` |
| `spec-auditor` | verification | raw + normalized | discrepancy report: models with suspiciously empty specs, unmapped labels, wrong-block extractions |
| `ui-builder` ×3 (browse, compare+detail, charts) | disjoint `src/` route folders | `data/*` contract | components |

The `data/*` shape is frozen as a TypeScript contract **before** any agent starts, so ingestion and UI agents can run in parallel against it.

### D10. Visual direction

The design brief is a private decision tool for dense instrument data. The look is taken from the watches' own display technology and from engineering dimension drawings — not from a generic product-catalog template.

**Palette** — derived from a transflective MIP watch display in daylight, cool and slightly green, with instrument-blue as the only chrome accent:

| Token | Light | Dark |
|---|---|---|
| `--page` | `#EDF0EA` | `#0E1412` |
| `--panel` | `#F7F8F4` | `#161D1A` |
| `--ink` | `#111917` | `#E7ECE7` |
| `--ink-muted` | `#5B6763` | `#94A19C` |
| `--rule` | `#C6CEC6` | `#2A3431` |
| `--accent` (instrument blue) | `#0B6FA4` | `#4FB3E0` |
| `--mark` (data emphasis) | `#B5451E` | `#E8804F` |

Chart series colours are a separate, validator-approved ramp set — not these UI tokens.

**Type** — three roles, self-hosted woff2 (offline requirement), all OFL:
- Display: **Archivo Expanded**, used sparingly at large sizes and for model names — wide, faceplate-like, not a default pairing.
- Body: **IBM Plex Sans** — technical humanist, correct umlaut/ß rendering for German spec text.
- Data: **IBM Plex Mono** with tabular figures for every number, part number, and comparison cell, so columns align optically. Same superfamily as body, so the pairing stays coherent.

**Layout** — the comparison table is the product, so it gets the full width: a persistent left filter rail on desktop collapsing to a sheet on mobile, a dense card grid for browse, and a frozen-header/frozen-label matrix for compare. Hairline rules (`--rule`) do the separating work; no card shadows, no rounded-corner drift, radius fixed at 2px except chart data-ends.

**Signature** — the to-scale case-size overlay rendered as an **engineering dimension drawing**: concentric case outlines on a shared scale with leader lines, tick marks, and monospace dimension callouts, plus a thickness elevation beneath. It is the one place the design spends boldness; everything else stays quiet. It is also the thing a spec table genuinely cannot show, which is why it earns the space.

**Quality floor** (not decoration, not optional): responsive to mobile, visible keyboard focus, `prefers-reduced-motion` respected, WCAG AA contrast in both themes.

### D11. Testing

`vitest` over committed HTML fixtures: one fixture per parsing hazard — multi-model bootstrap page, qualified yes value, multi-mode battery block, German decimal comma, a model with a missing spec section. Rationale: the parsers are where silent wrongness lives; the UI is visually verifiable, the parsers are not.

## Risks / Trade-offs

- **Garmin changes page structure or API shape** → all extraction is isolated behind stage-1 modules with fixture tests; a break surfaces as a failing test and a coverage report, not as a half-empty site. Raw responses are cached so a regression can be diagnosed against the last good snapshot.
- **Wrong bootstrap block selected on multi-model pages** (D3) → dedicated fixture test asserting that the Forerunner 170 Music id yields Music-specific values (4 GB memory, music playback true) and not the base 170's.
- **Spec label drift across families breaks normalization** → unmapped-label report + sparse-field report are run output; the `spec-auditor` agent reviews them each refresh.
- **Discovery gap: a watch lives only in a category we did not enumerate** → D2 cross-check against the 1185-product master list.
- **Snapshot goes stale** (prices, new models) → snapshot date is displayed on every view per `specs/catalog-browse`; refresh is one command.
- **Data payload size** → split catalog/detail JSON (D5); if `catalog.json` still exceeds ~500 KB gzipped, drop long description text from it and keep it in the per-model file.
- **Rate-limiting or IP blocking during a refresh** → bounded concurrency, delay between requests, resumable cache; a blocked run resumes rather than restarting.
- **Tri-state rendering is easy to get wrong** — "not published" collapsing into "no" would quietly misinform the actual purchase decision → the tri-state is carried end-to-end as a distinct value in the data contract (D9), not reconstructed in the UI from an empty string.
- **Private use only** — Garmin text and imagery are reproduced under the user's stated private-use intent; the build stays local and unpublished. Site footer states the source and the private-use scope.

## Migration Plan

Not a migration; bootstrap order matters though:

1. Freeze the `data/*` TypeScript contract (D9) — everything else depends on it.
2. `npm run ingest` → raw snapshot + images.
3. `npm run normalize` → `catalog.json`, per-model files, coverage reports. Review reports before trusting the data.
4. `npm run dev` / `npm run build` → the site.

Refresh later = re-run 2–3. Rollback = `data/` is committed, so `git checkout data/` restores the previous snapshot; the site is a pure function of `data/`.

## Open Questions

Both were left to be settled against real data; both now are (tasks 12.6, 12.7).

- ~~Whether the feature-coverage heatmap should span all boolean flags (~100+ columns, needs virtualisation) or a curated ~30-flag subset.~~ **Resolved: curated subset, 42 flags.** The snapshot turned out to contain **377 distinct yes/no row labels** — far more than the ~100 estimated, and well past what any matrix can show. Most carry no comparison signal: 55 of the unmapped labels are published for ≥95% of models (they cannot separate anything) and 74 for ≤10% (family-specific rows). The heatmap therefore renders the schema's `heatmap` fields — every normalized flag, 42 columns — and no virtualisation is needed. The remaining raw rows are not lost: they appear in full on each model's detail view, and the unmapped-label report classifies each one as `universal`, `candidate`, or `niche` so the curation stays auditable rather than arbitrary.
- ~~Whether `catalog.json` needs a build-time gzip/binary step.~~ **Resolved: no.** Measured at 83 models: **1 056 KB raw, 37 KB gzipped** — an order of magnitude under the ~500 KB gzipped threshold that would have forced dropping description text. The split itself is what did the work: the heavy part (5 117 KB of raw spec rows across 83 per-model files, 62 KB average) is never in the initial payload. No further step is warranted; revisit only if the model count grows several-fold.
