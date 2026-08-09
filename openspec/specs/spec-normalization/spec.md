# spec-normalization Specification

## Purpose

Maps Garmin's free-form, per-model specification rows onto a stable typed schema so that watches from different families and generations can be filtered, sorted, and compared on equal terms, while the untouched raw specifications remain available.

## Requirements

### Requirement: Stable comparison schema

The system SHALL define a fixed set of normalized comparison fields covering, at minimum: case dimensions, weight, display type, display size, display resolution, touchscreen, lens and bezel material, band size and material, water rating, battery life per operating mode, charging, memory, GNSS bands and constellations, sensor list, connectivity, music, payment, maps and navigation, and health/training feature flags.

#### Scenario: Every model exposes the schema

- **WHEN** a normalized model record is produced
- **THEN** it contains an entry for every field in the comparison schema
- **AND** fields Garmin does not publish for that model are marked "not published" rather than false or zero

#### Scenario: Not-published is distinguishable from not-supported

- **WHEN** a comparison field is rendered for a model
- **THEN** "feature absent" and "no data published" are visually and semantically distinct states

### Requirement: Typed values with units

Values that are numeric SHALL be normalized to typed values with an explicit unit, so they can be sorted and charted.

#### Scenario: Dimensions parsed

- **WHEN** a model publishes physical size as a formatted string such as `42,6 x 42,6 x 11,9 mm`
- **THEN** width, height, and thickness are stored as separate numbers in millimetres

#### Scenario: Battery modes parsed

- **WHEN** a model publishes battery life as multiple modes in one text block
- **THEN** each mode is stored as its own named entry with a numeric duration in hours
- **AND** the smartwatch mode and the GPS-only mode are identified as such

#### Scenario: German number formats handled

- **WHEN** a published value uses a decimal comma or a non-breaking space as a separator
- **THEN** the parsed number is correct

#### Scenario: Ranges and approximations preserved

- **WHEN** a published value expresses a range or an upper bound (for example "up to")
- **THEN** the normalized value records the bound type alongside the number
- **AND** the original text remains retrievable

### Requirement: Boolean feature flags

Yes/no specification rows SHALL be normalized to booleans, including rows whose affirmative value carries a qualifier.

#### Scenario: Qualified yes

- **WHEN** a row's value is affirmative but qualified (for example "yes, with compatible accessory")
- **THEN** the flag is true
- **AND** the qualifier text is retained and shown alongside the flag

### Requirement: Raw specifications preserved

Normalization SHALL be additive: the complete raw specification set MUST remain available per model.

#### Scenario: Raw specs retrievable

- **WHEN** a model's detail view is opened
- **THEN** every raw specification row Garmin published is available, grouped and ordered as on garmin.com
- **AND** rows that no normalized field covers are still shown

### Requirement: Unmapped-row reporting

Normalization SHALL report specification rows it could not map, so schema gaps are visible rather than silent.

#### Scenario: Unmapped rows reported

- **WHEN** normalization finishes
- **THEN** it emits a report of row labels present in the raw data that no normalized field consumed, with the models they occur on
- **AND** it emits a report of normalized fields that are empty for an unusually high share of models

### Requirement: Model identity and lineage

Each model SHALL carry a stable identifier, its family, and its generation, so successive generations can be recognised as related.

#### Scenario: Family and generation derived

- **WHEN** a model record is normalized
- **THEN** it records the product family, the generation or series designation, and any size or edition qualifier as separate attributes

#### Scenario: Stable ids across runs

- **WHEN** ingestion is re-run
- **THEN** an unchanged model keeps the same identifier
- **AND** URLs referring to it remain valid
