# catalog-ingestion Specification

## Purpose

Produces a reproducible snapshot of Garmin's current wrist-smartwatch catalog — model list, full published specifications, pricing, and image references — sourced exclusively from official garmin.com endpoints, so the comparison site serves all catalog content from frozen local data. Imagery is referenced from Garmin's own CDN rather than copied, and web fonts are fetched from a pinned CDN; those two hosts are the only remote dependencies the published pages have.

## Requirements

### Requirement: Official-source-only data provenance

All catalog data SHALL originate from `www.garmin.com` or `res.garmin.com`. The ingestion process MUST NOT read specifications, prices, or images from retailers, review sites, aggregators, or model knowledge.

#### Scenario: Only official hosts are contacted

- **WHEN** a full ingestion run completes
- **THEN** every network request it made targets the host `www.garmin.com` or `res.garmin.com`
- **AND** every stored record carries the garmin.com source URL it was derived from

#### Scenario: Missing spec is left empty, not inferred

- **WHEN** Garmin publishes no value for a specification on a model's product page
- **THEN** that field is recorded as absent
- **AND** no substitute value is invented from another model, another locale, or prior knowledge

### Requirement: Catalog discovery covers all current wrist smartwatches

The ingestion process SHALL discover models by enumerating Garmin's wearable category pages, and SHALL include every current wrist-worn smartwatch family (Forerunner, fēnix, Instinct, Venu, vívoactive, epix, Enduro, tactix, MARQ, Lily, Approach golf watches, Descent dive watches).

#### Scenario: Category enumeration is exhaustive

- **WHEN** discovery runs
- **THEN** it enumerates every wearable smartwatch category Garmin lists for the de-DE locale
- **AND** it retrieves the complete product list for each category rather than only the first page of results

#### Scenario: Duplicate models across categories are merged

- **WHEN** the same product id appears in more than one category
- **THEN** the snapshot contains exactly one record for it
- **AND** that record lists every category it appeared in

#### Scenario: Non-watch products are excluded

- **WHEN** an enumerated product is not a wrist-worn watch (for example a chest strap, scale, bike computer, band, or accessory)
- **THEN** it is excluded from the catalog
- **AND** the exclusion and its reason are recorded in the run report

### Requirement: Complete specification capture per model

For every included model the snapshot SHALL contain the complete specification set Garmin publishes on that model's product page, the box contents, the price, and every purchasable variant (case/colour/band SKUs).

#### Scenario: Full spec table is captured

- **WHEN** a model's product page publishes a specification table with grouped sections
- **THEN** every section, row label, and row value is stored
- **AND** the section grouping and source ordering are preserved

#### Scenario: Variants are captured

- **WHEN** a product page offers multiple SKUs of the same model
- **THEN** each SKU is stored with its part number, variant name, price, and image
- **AND** each SKU is linked to its parent model

#### Scenario: Price is captured with currency

- **WHEN** a price is published for a model or SKU
- **THEN** it is stored with its numeric value and currency code

### Requirement: Remote image references

Product imagery SHALL be referenced by its URL on Garmin's image CDN rather than copied into the snapshot, and every referenced image URL MUST be on that CDN. Each reference SHALL carry the full-size URL and, where Garmin's CDN publishes one, a smaller thumbnail URL for the same image.

#### Scenario: Image URLs are recorded, not downloaded

- **WHEN** ingestion completes
- **THEN** every model's image references are absolute URLs on `res.garmin.com`
- **AND** no image bytes were downloaded or stored by the pipeline

#### Scenario: Thumbnail reference accompanies the full-size reference

- **WHEN** a full-size image URL follows Garmin's published size-suffix convention
- **THEN** the reference also records the URL of the CDN's small rendition of that same image
- **AND** that URL is on `res.garmin.com`

#### Scenario: No thumbnail rendition exists

- **WHEN** a full-size image URL does not follow the size-suffix convention, so no small rendition can be named
- **THEN** the reference records the full-size URL with no thumbnail
- **AND** the image is still part of the model's image set

#### Scenario: Foreign image host is rejected

- **WHEN** an image URL for any model or SKU is not on `res.garmin.com`
- **THEN** the run fails rather than writing that URL into the snapshot

#### Scenario: Non-image assets are excluded

- **WHEN** a product's published media list contains an asset that is not a still image, such as a video
- **THEN** it is not recorded as an image reference
- **AND** the exclusion appears in the run report
- **AND** the run continues

#### Scenario: Model without imagery is recorded, not fatal

- **WHEN** Garmin publishes no image for a model
- **THEN** the model is recorded with no image references
- **AND** the omission appears in the run report
- **AND** the run continues

### Requirement: Polite, resumable fetching

The ingestion process SHALL rate-limit its requests, cache raw responses, maintain session continuity across a run, and be safely re-runnable.

#### Scenario: Requests are rate limited

- **WHEN** ingestion fetches many product pages
- **THEN** requests are issued with a bounded concurrency and a delay between them

#### Scenario: Re-run reuses cache

- **WHEN** ingestion is re-run without clearing its cache
- **THEN** unchanged upstream resources are served from the local cache instead of being refetched

#### Scenario: Interrupted run resumes

- **WHEN** a run is interrupted and restarted
- **THEN** already-fetched products are not fetched again
- **AND** the run completes the remaining products

#### Scenario: Session cookies persist across a run

- **WHEN** an upstream response sets a cookie
- **THEN** subsequent requests in the same run send it back
- **AND** the run is not treated as a series of unrelated first-time visitors

#### Scenario: An unattended refresh must not serve cached prices

- **WHEN** ingestion runs as part of an automated refresh whose purpose is to detect changes
- **THEN** it fetches from Garmin rather than reusing the stored response cache
- **AND** the cache is never a substitute for a refresh, because stored responses do not expire

### Requirement: Snapshot integrity and freshness metadata

Each snapshot SHALL record when it was taken, and SHALL only replace a previous snapshot when it is at least as complete.

#### Scenario: Snapshot timestamp recorded

- **WHEN** an ingestion run completes
- **THEN** the dataset records the run's completion timestamp and the locale and store code used
- **AND** each model records the timestamp at which its page was fetched

#### Scenario: Regression guard

- **WHEN** a new run yields fewer models than the existing snapshot, or fails to fetch specs for models that previously had them
- **THEN** the run reports the regression and does not silently overwrite the existing dataset

### Requirement: Permitted runtime hosts

The published site SHALL read all catalog content from its own snapshot, and SHALL contact remote hosts only for imagery and web fonts.

#### Scenario: Catalog data is local

- **WHEN** the built site is loaded with no network access to garmin.com
- **THEN** the model list, every specification, every price, and all snapshot metadata render correctly

#### Scenario: Only imagery and fonts are remote

- **WHEN** the requests a published page issues are inspected
- **THEN** the only remote hosts contacted are `res.garmin.com` for product imagery and the pinned font CDN for typefaces
- **AND** no request for catalog data leaves the site's own origin

#### Scenario: Unreachable imagery degrades gracefully

- **WHEN** a referenced image cannot be loaded
- **THEN** the page still renders its catalog content
- **AND** a labelled placeholder occupies the image's place
