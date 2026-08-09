## Context

Motivation is in `proposal.md`; behaviour contracts are in `specs/`. What shapes the approach is what the snapshot and the CDN actually hold, all of it verified against the current data and against `res.garmin.com` before this design was written:

| Fact | Value |
|---|---|
| Image URLs in the snapshot | 1678 across 190 variants |
| Images per variant | median 8, min 2, max 19 (`{2:32, 7:20, 8:52, 13:38, …}`) |
| URL shape | `https://res.garmin.com/<locale>/products/<partNumber>/v/<token>-lg.jpg`, locales `de_DE` (729), `en` (723), `en_GB` (226) |
| Size renditions | `-sm` 150×150 ≈ 3 KB · `-md` 300×300 ≈ 9 KB · `-lg` 600×600 ≈ 35 KB |
| `-sm` availability | 200 for the 1589 plain `…-lg.jpg` names; **404** for the 88 names carrying a UUID suffix (`cf-lg-b6111ea5-….jpg` → `cf-sm-b6111ea5-….jpg` is 404) |
| On-the-fly resize | none — `?w=120` returns the identical 17 KB body, so a query parameter cannot substitute for the `-sm` rendition |
| Non-image entries | 1 — `…/sc-21-lg-60418_54493_Fenix7Pro_EpixPro_MM.v2-Garmin.Web.mp4` |
| Where the data already is | `Variant.images: string[]` in `data/models/<id>.json`, populated by `skuImages()` from the bootstrap's `defaultImage` + `gallery` |

Constraints inherited from the existing design:

- Imagery is **referenced, not mirrored** (D10 of the original design). Nothing here downloads image bytes into the snapshot.
- The image host is asserted twice — in ingestion and again in normalization, the last writer before publication (D9). Both checkpoints stay.
- `src/components/ui.tsx` `ModelImage` is the single owner of "an image failed to load → labelled placeholder". The gallery must go through it rather than growing a second failure path.
- The site's visual identity already exists in `src/styles/tokens.css`: a transflective-MIP palette, Archivo display / IBM Plex Sans body / IBM Plex Mono for numerals, 1 px rules, `--radius: 2px`, `--shadow-none`. This change is a component inside that system, not a new identity.

The token filenames (`cf`, `rf`, `lf`, `pd-NN`, `sc-NN`) look like they encode viewing angle. They were checked by opening the assets: `cf` is an angled three-quarter render, `lf` is angled from the other side, and `rf`, `pd-01`, `pd-05`, `sc-01` are all straight-on front shots that differ only in what is drawn on the watch display. The tokens are therefore **not** a reliable angle vocabulary. This kills the obvious "label each thumbnail Front / Links / Detail" idea; see G6.

## Goals / Non-Goals

**Goals**

- Every image the snapshot already holds for the selected variant is reachable from the detail page, in Garmin's own order.
- Thumbnails cost ~3 KB, not ~35 KB, wherever the CDN offers the small rendition.
- The overlay is a real modal: focus trapped, `Esc` closes, focus returns, background inert — using platform behaviour rather than hand-rolled focus management.
- One place in the codebase decides what a usable product image is (host, extension, thumbnail), called by both pipeline stages.

**Non-Goals**

- No zoom or pan inside the overlay. The largest rendition is 600×600; magnifying it shows JPEG artefacts, not detail.
- No change to the catalog grid or the comparison matrix. Both keep `CatalogModel.image: string | null`. Switching the 83-card grid to `-md` is a real bandwidth win (35 KB → 9 KB per card) but it is a separate change with its own regression surface.
- No image mirroring, no local resizing, no new remote host.
- No capture of the bootstrap's `altTag`. Its values are `"Forerunner® 170"`, `"Forerunner® 170 1"`, `"Forerunner® 170 2"` — a numbered restatement of the product name, which is exactly what generated alt text already produces.
- No slide/fade transition between images in the strip. See G8.

## Decisions

### G1. `ProductImage` replaces the bare URL string in the contract

```ts
export interface ProductImage {
  /** Absolute `res.garmin.com` URL of the 600 px rendition. */
  full: string;
  /** The 150 px rendition, or null when the CDN publishes none for this asset. */
  thumb: string | null;
}
```

`Variant.images`, `ModelDetail.images` and `RawProduct.images` become `ProductImage[]`. `CatalogModel.image` stays `string | null`.

Alternatives considered:

- **Parallel `thumbs: string[]`** — rejected: two arrays that must stay index-aligned across three stages is a correctness trap for zero gain.
- **Derive the thumb URL in React** — rejected: the frontend would synthesise URLs Garmin never published, and the contract comment "nothing in here may be widened without updating every stage" exists precisely so the UI never invents data. Keeping derivation in the pipeline also means the rule is testable without a browser.
- **Keep `string[]` and add a sibling map** — rejected for the same index-alignment reason.

The contract's own doc comment forbids widening a shape without updating every stage, so the retype lands in ingest, normalize and UI in the same change. `data/models/*.json` is regenerated; see the migration plan.

### G2. The thumbnail URL is derived by rule, with `null` as a first-class answer

Rule: split the URL's basename; if it ends with the exact token `-lg`, replace that token with `-sm`; otherwise there is no thumbnail.

```
…/v/cf-lg.jpg                                   → …/v/cf-sm.jpg      (1589 URLs)
…/v/pd-03-lg.jpg                                → …/v/pd-03-sm.jpg
…/v/cf-lg-b6111ea5-c9b9-496d-9dfc-571d2f63ad35.jpg → null            (88 URLs)
```

The UUID-suffixed names get `null` because their `-sm` sibling was probed and returns 404 — deriving one would produce a URL that is guaranteed to break. The UI falls back to `full` for those thumbnails, which is correct-but-heavy for 5 % of assets.

Alternatives considered:

- **HEAD-probe every `-sm` at ingest** — the honest version, and it would let `thumb` mean "verified to exist". Rejected: ~1700 extra requests on every pipeline run against a host the project is deliberately polite to, to confirm a rule that holds for 100 % of the plain names today. The `null` case plus the browser's `onError` fallback already covers being wrong.
- **Use `-md` for thumbnails** — rejected: 300×300 at a 76 px cell is 3× more pixels than a 2× display needs, for 3× the bytes.

### G3. `scripts/lib/images.ts` becomes the single classifier

Today it exports `assertImageHost`. It gains one function that answers everything about a candidate URL:

```ts
export function classifyImage(productId: string, url: string): ProductImage | null;
```

It asserts the host (fatal, unchanged — a foreign host is a structural change and must not be published), returns `null` for a URL whose extension is not `.jpg`/`.jpeg`/`.png`/`.webp`, and otherwise returns `{ full, thumb }`. `scripts/ingest/product.ts` calls it while building variants and records a `RunReportEntry` for every `null`; `scripts/normalize/index.ts` re-asserts the host on the resulting shape, keeping D9's second checkpoint intact.

Why the extension filter lives here rather than in the UI: the mp4 is not an image that failed to load — it is not an image at all, and `ModelImage`'s placeholder means "Garmin published nothing, or the browser could not fetch it". Rendering "kein Bild verfügbar" for a video Garmin does publish would be a false statement to the reader. It is dropped at the boundary and reported, which is how every other data gap in this pipeline is handled.

Why not the ingest stage alone: normalization is the last writer before publication and already re-checks the host for exactly this reason. A URL shape that reaches it unclassified is a bug worth failing on.

### G4. Gallery state: two indices, one reset rule

`Detail.tsx` already holds `variantIndex`. It gains `imageIndex`, plus `overlayOpen`.

- `imageIndex` resets to `0` whenever `variantIndex` changes — the sets are different lengths and index 3 of one variant has no relationship to index 3 of another (`watch-detail` — variant selection re-points the gallery).
- The overlay reads the **same** `imageIndex`. Cycling inside the overlay therefore moves the page behind it, and closing leaves the reader on the image they stopped at, which is what the spec requires and also what makes "close, then keep browsing" feel continuous.
- Next/previous wrap with modulo. The set is small and circular navigation costs nothing; a disabled arrow at each end is a dead control the reader has to notice.

Rejected: putting `imageIndex` in the URL. The variant index is not in the URL either, and adding one query parameter for image position invites the question of why the variant is not there too — a separate, larger decision about detail-page addressability.

### G5. The hero loads `-lg`, so the overlay opens instantly

The hero box is 320 px wide; `-md` at 300×300 would look right on a 1× display and soft on a 2× one. More decisive: the overlay shows `-lg`, and if the hero already loaded `-lg`, the overlay opens from the browser cache with no fetch and no flash. One rendition for both, 35 KB, fetched once.

Adjacent images are **not** prefetched. A reader who opens one image and closes it should not have paid for two more; the strip's `-sm` thumbnails already give a preview of what is there.

### G6. Visual direction — the contact sheet

The site's identity is fixed (`tokens.css`), so this is a component brief, not an identity brief: the gallery must read as part of an instrument panel, not as a retail carousel. Every value below comes from the existing token layer; the only new token is the scrim.

**Colour.** No new palette. Active thumbnail = `--accent` border on `--accent-wash`, the exact idiom the variant buttons already use, so "selected" means one thing on this page. Inactive = `--rule`, hover `--rule-strong`. Overlay backdrop = a new `--scrim: color-mix(in srgb, var(--page) 8%, #000 92%)` in both themes — near-black but carrying the page's cool-green cast, because a pure `#000` backdrop under this palette reads as a different product's chrome.

**Type.** Display face untouched. Frame numbers, the counter and the overlay caption use `--font-mono` at 11 px with the existing `.num` class — the same treatment the spec tables give measured values. Numbers on this site are already instrument readouts; the gallery index joins them rather than inventing a style.

**Layout.** Contact sheet, not carousel: a wrapped 4-column grid of square hairline cells under the hero, every image visible at once for the common 7–8 image case, two rows for 13, three for 19.

```
┌ left rail, 340px ─────────────┐      ┌ overlay, viewport ──────────────────────┐
│ ┌───────────────────────────┐ │      │                                    [ × ] │
│ │                           │ │      │                                          │
│ │        hero  -lg          │ │      │   ‹      ┌──────────────────┐      ›     │
│ │        600 × 600          │ │      │          │   fit-to-viewport │            │
│ │                           │ │      │          │   -lg, contain    │            │
│ │ ‹                       › │ │      │          └──────────────────┘            │
│ └───────────────────────────┘ │      │                                          │
│ 01/08   Garmins Standardbild  │      │   Forerunner 165 · Schwarz/Schiefergrau  │
│ ┌────┐┌────┐┌────┐┌────┐      │      │   03/08                                  │
│ │ 01 ││ 02 ││ 03 ││ 04 │      │      └──────────────────────────────────────────┘
│ └────┘└────┘└────┘└────┘      │
│ ┌────┐┌────┐┌────┐┌────┐      │        ‹ › appear on hover and focus on pointer
│ │ 05 ││ 06 ││ 07 ││ 08 │      │        devices, and are always visible on touch
│ └────┘└────┘└────┘└────┘      │
│ ┌ Varianten (3) ────────────┐ │
```

Below `lg` the rail is full-width, the hero grows to the column and the sheet goes to 6 columns; cells stay square so the sheet never reflows into a scroller with hidden items. A horizontal scroll strip was rejected for that reason: on a 340 px rail it hides half the set behind an affordance the reader has to discover.

**Signature — the frame number.** Each cell carries its position in mono in the corner, the counter under the hero reads `03/08`, and the overlay caption repeats that same `03/08`. The strip is an index, not decoration: position is the one thing about these images that is verifiably true and that the reader needs in order to know what they have and have not seen. Frame 01 gets a single quiet eyebrow, `Garmins Standardbild`, because it is Garmin's own `defaultImage` — also true by construction, since `skuImages()` puts it first.

**What was cut, and why.** The first plan labelled each thumbnail with a role parsed from the filename token (`Vorderseite`, `Linke Seite`, `Detail 3`). It was cut after opening the assets: `rf`, `pd-*` and `sc-*` are all straight-on shots differing only in on-screen content, so those labels would have asserted an angle vocabulary that does not exist. Numbering is what survives verification. Per the same instinct, the sheet has no captions, no drop shadows and no rounded corners — the boldness is spent on the frame numbering, and everything else stays at the site's ambient quietness.

### G7. The overlay is a native `<dialog>` opened with `showModal()`

`showModal()` gives, from the platform: the top layer (no `z-index` fight with the sticky layout), `inert` on everything behind it, a focus trap, `Esc` → `cancel`, and `::backdrop` for the scrim. A hand-rolled `div` overlay would need a focus-trap implementation, an `aria-modal` dance, a scroll lock and a key handler — four places to get accessibility subtly wrong.

What still has to be written by hand: `aria-label` on the dialog; returning focus to the hero button on close (React re-render can lose the implicit return); a backdrop click test comparing `event.target` to the dialog element; and `overflow: hidden` on `<body>` for iOS Safari, which does not lock background scroll behind a modal dialog on its own. Arrow-key handling is a `keydown` listener on the dialog.

Transitions: `opacity` 120 ms on open/close, and nothing at all under `@media (prefers-reduced-motion: reduce)`, matching the spec scenario and the rest of the site.

### G8. No transition between images

Swapping the hero `src` with no crossfade or slide. A slide transition is what makes a component read as a retail carousel, and at 35 KB per image the swap is already near-instant on a warm connection. The frame counter is the feedback that something changed.

### G9. Regeneration runs from the existing HTTP cache

`Variant.images` changes shape at the ingest boundary, so `data/raw/products/*.json` and `data/models/*.json` both have to be rebuilt. `Fetcher` reads its on-disk cache by default and `data/raw/.http-cache` already holds 256 responses from the current snapshot, so `npm run ingest && npm run normalize` rebuilds both offline, against the same bytes the committed snapshot was built from. That keeps the data diff attributable to this change alone rather than to a fresh scrape that also moved prices.

## Risks / Trade-offs

- **Garmin stops publishing `-sm`, or changes the suffix convention** → thumbnails 404 and every cell falls back to `full`: heavier, never broken. The `onError` path in `ModelImage` already covers it, and a `classifyImage` unit test pinned to the current URL shape makes the change visible when the snapshot is refreshed.
- **The `-lg` → `-sm` rule is wrong for some name shape not present today** → same fallback. The rule only fires on an exact trailing `-lg` token, so an unfamiliar shape yields `null` rather than a wrong URL.
- **88 thumbnails load at 35 KB each** → worst case, a single variant of one of those models loads its whole set at full size (~600 KB). Mitigated by `loading="lazy"` on the sheet, which is already `ModelImage`'s default.
- **Retyping `images` breaks anything reading the old shape** → the TypeScript build (`tsc -b --noEmit` in `npm run build`) fails on every stale reader, which is the intended alarm. The snapshot is regenerated in the same change, so no consumer sees a mixed shape.
- **`data/models/*.json` diff is 190 variants wide** → it is a mechanical shape change; the review value is in one file, not 83. The task list calls out spot-checking a UUID-suffixed model and the mp4 model specifically.
- **The mp4 disappears from the fēnix 7 Pro's media** → the reader loses nothing they could see before (it rendered as a broken `<img>` slot), and the run report records the exclusion, so the decision stays visible rather than silent.
- **`<dialog>` + React refs** → `showModal()` must be called on a mounted node, and calling it twice throws. The overlay renders unconditionally and is opened/closed through an effect keyed on `overlayOpen`, not by mounting and unmounting the element.

## Migration Plan

1. Land the contract, `classifyImage`, ingest and normalize changes together — the build will not typecheck otherwise.
2. `npm run ingest && npm run normalize` against the existing `data/raw/.http-cache`. Confirm the run report lists exactly one excluded non-image asset, and that `data/meta.json` still reports 83 models / 190 variants.
3. Land the UI on the regenerated snapshot.
4. Rollback is `git revert` of the whole change: the snapshot and the readers move together, and there is no deployed state outside the repo.

## Open Questions

None. The four decisions that could have changed scope — variant-scoped versus model-wide sets, where thumbnails come from, how far the overlay goes, and what to do with the mp4 — were settled with the requester before this document was written.
