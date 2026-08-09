## MODIFIED Requirements

### Requirement: Imagery and box contents

The detail view SHALL show the model's imagery, referenced from Garmin's image CDN, and its published box contents.

#### Scenario: Images shown

- **WHEN** the detail view loads
- **THEN** the model's product image is displayed from its `res.garmin.com` URL
- **AND** if the snapshot records no image for the model, a labelled placeholder is shown instead of a broken image

#### Scenario: Referenced image fails to load

- **WHEN** an image the snapshot references cannot be loaded by the browser
- **THEN** a labelled placeholder replaces it
- **AND** no broken-image indicator is shown
- **AND** the rest of the detail view renders normally

#### Scenario: Box contents

- **WHEN** box contents were captured
- **THEN** they are listed
