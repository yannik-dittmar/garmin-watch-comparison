## MODIFIED Requirements

### Requirement: Variants

All captured SKUs of the model SHALL be listed with their distinguishing attributes.

#### Scenario: Variant list

- **WHEN** a model has multiple SKUs
- **THEN** each is listed with its part number, variant name, price, and image
- **AND** selecting a variant updates the displayed image and price

#### Scenario: Variant selection re-points the gallery

- **WHEN** a variant is selected
- **THEN** the gallery shows that variant's own image set, not the previous variant's
- **AND** the gallery returns to the first image of the newly selected set

#### Scenario: Single-variant model

- **WHEN** a model has exactly one SKU
- **THEN** the variant list is omitted rather than shown with a single entry
- **AND** the gallery still shows that SKU's full image set

### Requirement: Imagery and box contents

The detail view SHALL show every image the snapshot records for the selected variant, referenced from Garmin's image CDN, and the model's published box contents.

#### Scenario: Images shown

- **WHEN** the detail view loads a variant whose snapshot records more than one image
- **THEN** one image is displayed at full size from its `res.garmin.com` URL
- **AND** every other image of that variant is reachable from the view without leaving the page
- **AND** the position of the displayed image within the set is stated

#### Scenario: Cycling through the set

- **WHEN** the next or previous control is used
- **THEN** the displayed image advances to the adjacent image in the set
- **AND** the set wraps, so advancing past the last image returns to the first

#### Scenario: Single-image variant

- **WHEN** the snapshot records exactly one image for the selected variant
- **THEN** that image is displayed
- **AND** no cycling controls or thumbnail strip are shown

#### Scenario: Image order is Garmin's

- **WHEN** a variant's images are displayed
- **THEN** they appear in the order the snapshot records them, which is the order Garmin publishes them, with Garmin's own default image first

#### Scenario: Thumbnails prefer the small asset

- **WHEN** a thumbnail is shown for an image whose snapshot record carries a thumbnail reference
- **THEN** the thumbnail reference is loaded rather than the full-size image
- **AND** when no thumbnail reference is recorded, the full-size image is used for the thumbnail

#### Scenario: Referenced image fails to load

- **WHEN** an image the snapshot references cannot be loaded by the browser
- **THEN** a labelled placeholder replaces it
- **AND** no broken-image indicator is shown
- **AND** the rest of the detail view renders normally

#### Scenario: Variant without imagery

- **WHEN** the snapshot records no image for the selected variant
- **THEN** a labelled placeholder is shown in place of the full-size image
- **AND** no cycling controls or thumbnail strip are shown

#### Scenario: Box contents

- **WHEN** box contents were captured
- **THEN** they are listed

## ADDED Requirements

### Requirement: Enlarged image view

Any displayed product image SHALL be openable as an enlarged view that covers the page, so an image can be examined larger than the detail layout allows.

#### Scenario: Opening the enlarged view

- **WHEN** the displayed image is activated by pointer, `Enter`, or `Space`
- **THEN** an enlarged view opens over the whole page
- **AND** the image is scaled to fit the viewport without being cropped
- **AND** the page behind it does not scroll while the view is open

#### Scenario: Cycling within the enlarged view

- **WHEN** the enlarged view is open and the next or previous control, or the left or right arrow key, is used
- **THEN** the enlarged view shows the adjacent image of the same variant's set
- **AND** the detail view behind it shows the same image once the enlarged view is closed

#### Scenario: Position is stated

- **WHEN** the enlarged view is open
- **THEN** it states which image of the set is shown and how many the set holds
- **AND** it names the variant the set belongs to

#### Scenario: Closing the enlarged view

- **WHEN** `Escape` is pressed, the close control is used, or the area outside the image is activated
- **THEN** the enlarged view closes
- **AND** keyboard focus returns to the control that opened it

#### Scenario: Keyboard focus is confined

- **WHEN** the enlarged view is open and focus is moved with `Tab` or `Shift+Tab`
- **THEN** focus stays among the enlarged view's own controls
- **AND** no control behind the enlarged view can be reached until it closes

#### Scenario: Enlarged image fails to load

- **WHEN** the image shown in the enlarged view cannot be loaded by the browser
- **THEN** a labelled placeholder is shown in its place
- **AND** the enlarged view stays open and can still be closed and cycled

#### Scenario: Reduced motion is respected

- **WHEN** the reader's system asks for reduced motion
- **THEN** the enlarged view appears and disappears without transition
