## 1. Contract and image classification

- [x] 1.1 Add `ProductImage { full: string; thumb: string | null }` to `src/data/contract.ts` with a doc comment stating that `thumb` is the CDN's 150 px rendition and `null` means the CDN publishes none (design G1)
- [x] 1.2 Retype `Variant.images`, `ModelDetail.images` and `RawProduct.images` to `ProductImage[]`; leave `CatalogModel.image` as `string | null` and update the doc comments at `contract.ts:131`, `:177`, `:223`
- [x] 1.3 Add `deriveThumb(url)` to `scripts/lib/images.ts`: replace an exact trailing `-lg` basename token with `-sm`, return `null` otherwise (design G2)
- [x] 1.4 Add `classifyImage(productId, url): ProductImage | null` to `scripts/lib/images.ts` — asserts the host via the existing `assertImageHost`, returns `null` for any extension outside `.jpg`/`.jpeg`/`.png`/`.webp`, otherwise `{ full, thumb }` (design G3)
- [x] 1.5 Unit-test `deriveThumb` against all four real shapes: `cf-lg.jpg`, `pd-03-lg.jpg`, `cf-lg-b6111ea5-c9b9-496d-9dfc-571d2f63ad35.jpg` (→ `null`), and a name with no `-lg` token (→ `null`)
- [x] 1.6 Unit-test `classifyImage`: the `…Garmin.Web.mp4` URL returns `null`, a foreign host still throws, a plain `-lg.jpg` returns both URLs

## 2. Ingestion and normalization

- [x] 2.1 Rewrite `skuImages()` in `scripts/ingest/product.ts` to build `ProductImage[]` through `classifyImage`, keeping `defaultImage` first and de-duplicating on `full` (`catalog-ingestion` — thumbnail reference accompanies the full-size reference)
- [x] 2.2 Report every dropped non-image asset as a `RunReportEntry` naming the product and the URL, and keep the run going (`catalog-ingestion` — non-image assets are excluded)
- [x] 2.3 Update the model-level `images` union in `buildRawProduct` to de-duplicate `ProductImage[]` on `full`, and keep `assertImageHost` fed with the `full` URLs
- [x] 2.4 Update `scripts/normalize/index.ts` (`:81`, `:108`, `:122`) for the new shape: re-assert the host on every `full` and every non-null `thumb`, keep `CatalogModel.image` as `product.images[0]?.full ?? null`
- [x] 2.5 Update `tests/fixtures/multi-model-bootstrap.html` expectations and any fixture-driven test that asserts on `images`

## 3. Regenerate the snapshot

- [x] 3.1 Run `npm run ingest && npm run normalize` against the existing `data/raw/.http-cache` so no new garmin.com traffic is needed (design G9)
- [x] 3.2 Confirm the run report lists exactly one excluded non-image asset — the fēnix 7 Pro `…Garmin.Web.mp4` — and no other exclusions
- [x] 3.3 Confirm `data/meta.json` still reports 83 models and 190 variants, and that every `full` and non-null `thumb` in `data/models/*.json` is on `res.garmin.com`
- [x] 3.4 Spot-check the counts against the pre-change snapshot: 1678 image references, 1589 with a `thumb`, 88 with `thumb: null`, 1 dropped
- [x] 3.5 Spot-check one UUID-suffixed model (the `010-02472-10` variant) and confirm its images carry `thumb: null` rather than a derived URL

## 4. Gallery on the detail page

- [x] 4.1 Add `--scrim` to `src/styles/tokens.css` in all three theme states, defined from `--page` rather than pure black (design G6)
- [x] 4.2 Extend `ModelImage` in `src/components/ui.tsx` to take a `ProductImage`-shaped source without growing a second failure path — the placeholder contract stays where it is
- [x] 4.3 Build the gallery component: hero at `full`, wrapped 4-column contact sheet of `thumb ?? full` cells with mono frame numbers, active cell marked with `--accent` on `--accent-wash` to match the existing variant buttons
- [x] 4.4 Add the `NN/NN` counter under the hero and the `Garmins Standardbild` eyebrow on frame 01 only
- [x] 4.5 Add previous/next controls on the hero — hairline squares in the bottom corners, visible on hover and on `:focus-visible`, always visible on touch — wrapping at both ends (`watch-detail` — cycling through the set)
- [x] 4.6 Wire `imageIndex` into `src/routes/Detail.tsx` and reset it to 0 whenever `variantIndex` changes (design G4)
- [x] 4.7 Hide the sheet and the cycling controls when the selected variant has exactly one image, and show the existing placeholder when it has none (`watch-detail` — single-image variant, variant without imagery)
- [x] 4.8 Give every image an alt text built from model name, variant name and position, e.g. `Forerunner 165, Schwarz/Schiefergrau, Bild 3 von 8`
- [x] 4.9 Make the sheet responsive: 4 columns in the 340 px rail, 6 columns once the rail goes full-width below `lg`, cells square at every width

## 5. Enlarged view

- [x] 5.1 Build the overlay as a native `<dialog>` opened with `showModal()`, rendered unconditionally and driven by an effect keyed on the open state (design G7)
- [x] 5.2 Style `::backdrop` with `--scrim`; fit the image with `object-fit: contain` inside the viewport with no cropping
- [x] 5.3 Add the caption — variant name and the same `NN/NN` frame number the sheet shows — plus previous/next and a close control
- [x] 5.4 Handle `keydown`: `ArrowLeft`/`ArrowRight` cycle, `Escape` closes via the dialog's `cancel` event
- [x] 5.5 Close on a backdrop click by comparing `event.target` to the dialog element, and return focus to the hero trigger on every close path
- [x] 5.6 Lock background scroll with `overflow: hidden` on `<body>` while open, for iOS Safari
- [x] 5.7 Add the 120 ms opacity transition and disable it entirely under `prefers-reduced-motion: reduce` (`watch-detail` — reduced motion is respected)
- [x] 5.8 Make the hero itself the trigger: a real `button` wrapping the image, labelled `Bild vergrößern`, so pointer, `Enter` and `Space` all open it

## 6. Verification

- [x] 6.1 Component-test the gallery: variant switch resets to frame 01, next wraps from the last frame to the first, a single-image variant renders no controls
- [x] 6.2 Component-test the overlay: `Escape` closes it, focus returns to the hero trigger, `Tab` stays inside while open, and the frame the overlay was left on is the frame the page shows after closing
- [x] 6.3 Run the existing `axe-core` check over a detail page with the overlay open and with it closed; fix anything it reports
- [x] 6.4 Verify the failure paths by hand in the browser: break a `thumb` URL (cell falls back), break a `full` URL (placeholder, page intact), break the URL while the overlay is open (placeholder, overlay still closable and cyclable)
- [x] 6.5 Check a 13-image and a 19-image variant at 340 px, at tablet width and at 375 px — sheet wraps, nothing scrolls horizontally, hero keeps its aspect
- [x] 6.6 Confirm the network panel shows `-sm` requests for the sheet and a single `-lg` per viewed image, with the overlay opening from cache
- [x] 6.7 Run `npm run build` and `npm test` clean

## 7. Documentation

- [x] 7.1 Update `data/README.md` for the `ProductImage` shape and the non-image exclusion rule
- [x] 7.2 Update the imagery paragraph in the root `README.md` — the browser now loads two renditions from `res.garmin.com`, and the site is still not offline-capable
