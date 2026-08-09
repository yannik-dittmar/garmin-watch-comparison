## MODIFIED Requirements

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
