## ADDED Requirements

### Requirement: Remote image references

Product imagery SHALL be referenced by its URL on Garmin's image CDN rather than copied into the snapshot, and every referenced image URL MUST be on that CDN.

#### Scenario: Image URLs are recorded, not downloaded

- **WHEN** ingestion completes
- **THEN** every model's image references are absolute URLs on `res.garmin.com`
- **AND** no image bytes were downloaded or stored by the pipeline

#### Scenario: Foreign image host is rejected

- **WHEN** an image URL for any model or SKU is not on `res.garmin.com`
- **THEN** the run fails rather than writing that URL into the snapshot

#### Scenario: Model without imagery is recorded, not fatal

- **WHEN** Garmin publishes no image for a model
- **THEN** the model is recorded with no image references
- **AND** the omission appears in the run report
- **AND** the run continues

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Local image assets

**Reason**: The 61 MB image mirror is what made the repository unsuitable for static hosting, and it also served fixed JPEGs where Garmin's CDN content-negotiates WebP. Verified: `res.garmin.com` serves `access-control-allow-origin: *`, applies no referer check, and sets a one-year immutable cache — so referencing it directly is both permitted and faster than mirroring.

**Migration**: Replaced by "Remote image references". `scripts/images/` and the `images` pipeline stage are deleted; ingestion leaves `res.garmin.com` URLs in the records. The former guard that no remote URL may survive into the snapshot inverts: every image URL must now be on `res.garmin.com`. Build-time detection of a missing image is no longer possible, so `missingImages` is retired and the labelled placeholder becomes a load-failure fallback in the browser.

### Requirement: Browser never contacts Garmin

**Reason**: Untrue once imagery is referenced rather than mirrored, and the fully-offline property it guaranteed is deliberately traded away for a repository small enough to host statically and a snapshot refresh that takes minutes instead of a quarter of an hour.

**Migration**: Replaced by "Permitted runtime hosts", which keeps the valuable half of the guarantee — all catalog data is local and no request for it leaves the site's origin — while naming imagery and fonts as the two permitted remote dependencies.
