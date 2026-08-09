# catalog-ingestion Specification

## Purpose

Produces a reproducible local snapshot of Garmin's current wrist-smartwatch catalog — model list, full published specifications, pricing, and imagery — sourced exclusively from official garmin.com endpoints, so the comparison site can run entirely offline against frozen data.

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

### Requirement: Local image assets

Product imagery SHALL be downloaded from Garmin and stored locally, and the site SHALL reference only the local copies.

#### Scenario: Images are localised

- **WHEN** ingestion completes
- **THEN** every model has at least one locally stored product image
- **AND** no page of the built site requests an image from a remote host

#### Scenario: Image download failure is non-fatal

- **WHEN** an image download fails after retries
- **THEN** ingestion continues
- **AND** the model is recorded as missing that image
- **AND** the failure appears in the run report

### Requirement: Polite, resumable fetching

The ingestion process SHALL rate-limit its requests, cache raw responses, and be safely re-runnable.

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

### Requirement: Snapshot integrity and freshness metadata

Each snapshot SHALL record when it was taken, and SHALL only replace a previous snapshot when it is at least as complete.

#### Scenario: Snapshot timestamp recorded

- **WHEN** an ingestion run completes
- **THEN** the dataset records the run's completion timestamp and the locale and store code used
- **AND** each model records the timestamp at which its page was fetched

#### Scenario: Regression guard

- **WHEN** a new run yields fewer models than the existing snapshot, or fails to fetch specs for models that previously had them
- **THEN** the run reports the regression and does not silently overwrite the existing dataset

### Requirement: Browser never contacts Garmin

The published site SHALL be a static artifact that reads only the local snapshot.

#### Scenario: Static runtime

- **WHEN** the built site is loaded with no network access to garmin.com
- **THEN** the catalog, all specifications, and all images render correctly
