## 1. Project skeleton and data contract

- [x] 1.1 Scaffold the project in `/workspace`: Vite + React + TypeScript, Tailwind v4, vitest, `npm` scripts `ingest`, `normalize`, `images`, `dev`, `build`, `test` (design D1, D5)
- [x] 1.2 Create `src/data/contract.ts` — the frozen TypeScript types for `CatalogModel`, `RawSpecRow`, `SpecValue` tri-state (`supported` / `unsupported` / `not-published`), `Variant`, `BatteryMode`, `Dimensions`, `SnapshotMeta` (design D9, D10 tri-state risk)
- [x] 1.3 Write `data/README.md` describing every generated file, its producer stage, and its refresh command
- [x] 1.4 Self-host the three typefaces as woff2 under `public/fonts/` (Archivo Expanded, IBM Plex Sans, IBM Plex Mono) and wire `@font-face` with `font-display: swap` (design D10)
- [x] 1.5 Define the CSS token layer: light palette on bare `:root`, dark overrides under both `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])` and `:root[data-theme="dark"]` (design D10)

## 2. Ingestion — discovery (subagent: `discovery`)

- [x] 2.1 Build the polite fetch layer: browser UA, bounded concurrency, inter-request delay, retry with backoff, on-disk response cache keyed by URL, resumable (spec `catalog-ingestion` — polite/resumable)
- [x] 2.2 Parse `https://www.garmin.com/de-DE/category-sitemap.xml` and select wearable categories; write `data/raw/categories.json`
- [x] 2.3 For each category page, extract its `categoryKey` from inline state (URL slug ≠ category key — design "Context")
- [x] 2.4 Call `getCategoryProducts` per key and union results by product id into `data/raw/products-index.json`, recording every category each product appeared in (spec — duplicate merge)
- [x] 2.5 Filter to wrist-worn watches; record every exclusion with its reason in the run report (spec — non-watch exclusion)
- [x] 2.6 Cross-check the union against `getDisplayableProducts` (1185 products) and emit a **discovery gap** report for watch-named products missing from the union (design D2)
- [x] 2.7 Fetch `getCategoryFilters` per category and store Garmin's own facet vocabulary for reuse as UI facets

## 3. Ingestion — product pages (subagents: `family-fetcher` ×N, one per family)

- [x] 3.1 Implement `GarminAppBootstrap` extraction: locate the inline `var GarminAppBootstrap = {…}` assignment and decode it as JSON
- [x] 3.2 Implement block selection by `productId` — a product page carries blocks for several related models; assert the selected block matches the requested id (design D3)
- [x] 3.3 Parse `specsTab.content` HTML with cheerio into `{section, label, value, valueKind}` rows, preserving section grouping and source order; map `class="yes"`/`class="no"` cells to the tri-state (spec `catalog-ingestion` — full spec capture)
- [x] 3.4 Extract every SKU with part number, variant name, price + currency, and image URLs (spec — variants, price)
- [x] 3.5 Extract box contents and the product's canonical garmin.com URL
- [x] 3.6 Write one `data/raw/products/<id>.json` per model including its fetch timestamp, locale, and store code (spec — freshness metadata)
- [x] 3.7 Run the fetchers per family (Forerunner; fēnix/epix/Enduro/tactix/MARQ; Instinct; Venu/vívoactive/Lily; Approach; Descent) and collect per-family coverage reports (design D9)

## 4. Ingestion — images (subagent: `imager`)

- [x] 4.1 Download each model's and variant's images from `res.garmin.com` into `public/img/<id>/`
- [x] 4.2 Make failures non-fatal: continue the run, mark the model as missing that image, list it in the run report (spec — image failure)
- [x] 4.3 Rewrite all image references in the raw records to local paths and assert no remote image URL survives into `data/` (spec — localised images)

## 5. Normalization (subagent: `normalizer`)

- [x] 5.1 Define the comparison schema in `src/data/schema.ts`: case dimensions, weight, display type/size/resolution, touchscreen, lens/bezel/band material and size, water rating, battery per mode, charging, memory, GNSS bands and constellations, sensors, connectivity, music, payments, maps/navigation, health and training flags (spec `spec-normalization`)
- [x] 5.2 Write `field-map.ts`: German label patterns → normalized field → parser → unit
- [x] 5.3 Implement typed parsers: dimension triple, mass, resolution, water rating, multi-mode battery block, qualified yes/no — all German-locale aware (decimal comma, non-breaking space) (spec — typed values, German formats)
- [x] 5.4 Preserve range/bound semantics (`bis zu` → upper bound) alongside the numeric value and keep the original text retrievable (spec — ranges preserved)
- [x] 5.5 Derive family, generation, and size/edition qualifier per model as separate attributes; assign stable ids that survive re-runs (spec — model identity and lineage)
- [x] 5.6 Emit `data/catalog.json` (normalized fields, all models) and `data/models/<id>.json` (full raw spec set) (design D5)
- [x] 5.7 Emit the **unmapped-label** and **sparse-field** coverage reports (spec — unmapped-row reporting)
- [x] 5.8 Emit `SnapshotMeta` with run timestamp, locale, store code, and model count
- [x] 5.9 Implement the regression guard: a run yielding fewer models or losing specs for previously-covered models reports and refuses to overwrite (spec — snapshot integrity)

## 6. Parser test suite

- [x] 6.1 Commit HTML fixtures: multi-model bootstrap page (Forerunner 170 / 170 Music / 70), qualified-yes row, multi-mode battery block, German decimal comma, model missing a spec section (design D11)
- [x] 6.2 Test that the Forerunner 170 Music id yields Music-specific values (4 GB memory, music playback supported) and never the base 170's (design D3 risk)
- [x] 6.3 Test tri-state fidelity: a `class="no"` cell, an absent row, and a text `Nein` all resolve to the correct distinct states
- [x] 6.4 Test battery-mode parsing splits every mode with the correct hours, and that smartwatch mode and GPS-only mode are identified
- [x] 6.5 Test that all normalized numerics round-trip from their German-formatted source strings

## 7. Site shell (subagent: `ui-builder` — shell)

- [x] 7.1 Set up `HashRouter` routes: catalog, compare, model detail, charts (design D5)
- [x] 7.2 Implement URL-as-state: filters, search, sort, selection, differences-only encoded in and restored from the URL (specs `catalog-browse`, `watch-comparison`)
- [x] 7.3 Implement favourites in `localStorage` with a favourites-only filter (spec `catalog-browse`)
- [x] 7.4 Implement the theme toggle (system / light / dark) against the token layer from 1.5
- [x] 7.5 Load `catalog.json` on boot; lazy-load `models/<id>.json` on detail open, with loading and error states
- [x] 7.6 Render the snapshot date and a private-use/source footer on every view (spec `catalog-browse`, design risk note)
- [x] 7.7 Quality floor pass: keyboard focus visible on every control, `prefers-reduced-motion` respected, no horizontal page scroll at mobile widths

## 8. Catalog browse (subagent: `ui-builder` — browse)

- [x] 8.1 Build the model card grid: image, name, family, price, headline specs (spec `catalog-browse` — overview)
- [x] 8.2 Build the filter rail: family, price range, case size, display type, battery band, water rating, and feature flags (music, payments, maps, touchscreen, multi-band GNSS, solar, flashlight, cellular/satellite); collapses to a sheet on mobile
- [x] 8.3 Show per-option match counts and update them as filters change (spec — filter option counts)
- [x] 8.4 Implement clear-one and clear-all, plus the named empty state with a one-click relax action (spec — clearable, empty result)
- [x] 8.5 Implement diacritic-insensitive incremental search over name, family, and part number (`fenix` matches `fēnix`)
- [x] 8.6 Implement sorting by price, battery, weight, case size, generation recency, with missing values grouped last, never treated as zero (spec — sorting)
- [x] 8.7 Implement compare selection with a max of 4, a persistent selection bar, refusal message at the limit, and selection surviving filter changes (spec — selection)

## 9. Comparison view (subagent: `ui-builder` — compare/detail)

- [x] 9.1 Build the comparison matrix: 2–4 model columns over sectioned normalized rows, with the too-few-models state (spec `watch-comparison`)
- [x] 9.2 Render the tri-state per cell so "not published" reads distinctly from "not supported" (spec — missing values explicit)
- [x] 9.3 Implement differences-only mode with a count of hidden rows, reversible (spec — differences-only)
- [x] 9.4 Mark differing rows, and mark the leading cell only on rows with an unambiguous better direction (spec — difference highlighting)
- [x] 9.5 Implement column add (searchable picker), remove, and reorder, syncing selection and URL (spec — column management)
- [x] 9.6 Implement sticky model headers and sticky spec labels, with horizontal scroll contained inside the table (spec — readable at any width)

## 10. Detail view (subagent: `ui-builder` — compare/detail)

- [x] 10.1 Build the normalized headline summary shown above the full table (spec `watch-detail` — normalized summary)
- [x] 10.2 Render every raw spec row under its original section heading, collapsible, with section jump links (spec — complete disclosure)
- [x] 10.3 Implement in-page spec filtering over label and value (spec — in-page spec search)
- [x] 10.4 Build the variant list with part number, name, price, image; selecting a variant swaps image and price; omit the list for single-SKU models (spec — variants)
- [x] 10.5 Render local images with a labelled placeholder fallback, plus box contents (spec — imagery and box contents)
- [x] 10.6 Show the model's capture date and link to its garmin.com source page (spec — provenance)
- [x] 10.7 Add add-to-comparison and related-models-in-family links (spec — navigation and lineage)

## 11. Visualizations (subagent: `ui-builder` — charts)

- [x] 11.1 Choose the chart series ramps and **run `validate_palette.js` for light and dark surfaces**; re-step any failing pair before building anything (design D6)
- [x] 11.2 Build the shared chart primitives on `d3-scale`/`d3-shape`: axes, 2px lines, 4px rounded data-ends, 2px surface gaps, legend, hover tooltip, keyboard-reachable marks, tabular fallback (design D6, spec `spec-visualization` — legibility)
- [x] 11.3 Battery chart: smartwatch-mode and GPS-mode durations on a shared scale; models without published figures listed separately, never plotted as zero (spec — battery)
- [x] 11.4 Price-vs-capability scatter with the capability measure defined in-view as the supported-flag count; hover identifies the model, activation opens its detail (spec — price/capability, design D8)
- [x] 11.5 Feature coverage heatmap with tri-state cells, labelled axes, keyboard reachability, and sort-by-feature-column (spec — feature matrix)
- [x] 11.6 **Signature element** — to-scale case-size overlay drawn as an engineering dimension drawing: concentric case outlines on a common scale, leader lines, tick marks, monospace dimension callouts, thickness elevation beneath; models without published dimensions named as unavailable, never drawn at a guessed size (design D10, spec — size comparison)
- [x] 11.7 Family generation ladder that states Garmin publishes no release dates, orders by generation designation and catalog placement, and shows underivable models as unordered (spec — generation ladder, design D7)
- [x] 11.8 Make every chart respect the active catalog filters (spec — respects filters)

## 12. Audit and close-out (subagent: `spec-auditor`)

- [x] 12.1 Review the discovery-gap, unmapped-label, and sparse-field reports; fix the field map or the discovery list and re-run normalization until the reports are clean or every remaining entry is explained
- [x] 12.2 Spot-check 5 models across different families against their live garmin.com pages, including one multi-model page and one multi-variant model
- [x] 12.3 Verify the built site loads and renders catalog, compare, detail, and charts with garmin.com unreachable (spec `catalog-ingestion` — static runtime)
- [x] 12.4 Verify tri-state rendering end to end: pick a spec Garmin omits for one model and confirm it never renders as "no"
- [x] 12.5 Accessibility pass: keyboard-only walkthrough of all four views, AA contrast check in both themes, charts readable without colour
- [x] 12.6 Measure `catalog.json` gzipped size and resolve design Open Question 2 (drop long descriptions if over ~500 KB)
- [x] 12.7 Decide design Open Question 1 (full vs curated heatmap flag set) against the actual normalized flag list and adjust 11.5 accordingly
