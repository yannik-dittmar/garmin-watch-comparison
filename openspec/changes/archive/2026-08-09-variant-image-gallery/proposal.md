## Why

The snapshot already carries every image Garmin publishes per SKU — 1678 URLs across 190 variants, a median of 8 per variant and up to 19 — but the detail view renders exactly one of them (`variant.images[0]`) and offers no way to reach the rest. A reader deciding between two watches can see one three-quarter render at 320 px and nothing else: not the straight-on face, not the display screenshots, not the other angles. The data is paid for and thrown away at the last step.

## What Changes

- The detail view gains an image gallery for the **selected variant**: a hero image, a thumbnail contact sheet of that variant's full image set, and prev/next controls. Selecting another variant swaps the whole set and returns to its first image.
- Clicking or activating the hero opens a **full-page overlay** of the image: dimmed backdrop, fit-to-viewport image, prev/next, frame counter, `Esc` to close, focus trapped while open and returned to the trigger on close.
- Image references gain a **thumbnail URL**. `res.garmin.com` publishes `-sm` (150 px) and `-md` (300 px) siblings of every `-lg` (600 px) asset; the pipeline derives the `-sm` URL by rewriting the `-lg` basename token and records it alongside the full-size URL. The 88 URLs whose basename carries a UUID suffix (`cf-lg-b6111ea5-….jpg`) have no `-sm` sibling — verified 404 — and record `null`, falling back to the full-size image in the strip.
- **BREAKING** (internal contract only, no published API): `Variant.images` and `ModelDetail.images` change from `string[]` to `ProductImage[]` — `{ full, thumb }`. Every pipeline stage and the UI are updated together; `data/models/*.json` must be regenerated. `CatalogModel.image` stays `string | null`.
- Non-image assets are excluded from image references. One entry in the current snapshot is an mp4 (`sc-21-lg-….mp4` on the fēnix 7 Pro page) which would render as a broken `<img>`; the pipeline now drops entries whose extension is not an image and reports them.

## Capabilities

### New Capabilities

None. The gallery extends the existing detail view rather than introducing a capability.

### Modified Capabilities

- `watch-detail`: the "Imagery and box contents" requirement grows from "the model's product image is displayed" to a navigable per-variant gallery with an enlarged overlay; the "Variants" requirement's image behaviour is restated in terms of the gallery.
- `catalog-ingestion`: "Remote image references" gains a thumbnail reference per image and an explicit exclusion of non-image assets, both still bound to `res.garmin.com`.

## Impact

- **Contract** — `src/data/contract.ts`: new `ProductImage`; `Variant.images`, `ModelDetail.images`, `RawProduct.images` retyped.
- **Ingestion** — `scripts/lib/images.ts` becomes the single owner of classifying an image URL (host assertion, extension filter, thumb derivation); `scripts/ingest/product.ts` builds `ProductImage[]` and reports dropped assets.
- **Normalization** — `scripts/normalize/normalize.ts` re-asserts the host on the new shape (design D9's second checkpoint) and carries it into `data/models/<id>.json`.
- **Snapshot** — `data/models/*.json` regenerated; `data/catalog.json` unchanged in shape. The regeneration runs from the existing `data/raw/.http-cache`, so no new garmin.com traffic is required.
- **UI** — `src/routes/Detail.tsx` (gallery wiring), new gallery + overlay components, `src/components/ui.tsx` (`ModelImage` keeps its placeholder contract), `src/styles/tokens.css` (scrim token).
- **Tests** — `tests/` gains coverage for thumb derivation, non-image exclusion, and gallery/overlay keyboard behaviour.
- **Runtime hosts** — unchanged: `res.garmin.com` only. Thumbnails are the same CDN, one size down.
