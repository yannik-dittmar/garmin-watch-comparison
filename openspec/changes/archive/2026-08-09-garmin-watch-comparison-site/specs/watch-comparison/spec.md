## Purpose

Puts selected watches next to each other across the full normalized specification schema and makes the differences between them immediately obvious, which is the core decision-making step the site exists for.

## ADDED Requirements

### Requirement: Side-by-side comparison

The comparison view SHALL display between two and four selected models as columns over a shared row set of normalized specifications, grouped into sections.

#### Scenario: Comparison renders

- **WHEN** two to four models are selected and the comparison view is opened
- **THEN** each selected model appears as a column with its image, name, and price
- **AND** every normalized specification appears as a row with each model's value

#### Scenario: Too few models

- **WHEN** fewer than two models are selected
- **THEN** the comparison view explains that at least two are needed and offers a way back to the catalog

#### Scenario: Missing values are explicit

- **WHEN** a model has no published value for a row
- **THEN** the cell states that the value is not published, distinctly from a value of "no"

### Requirement: Differences-only mode

The comparison view SHALL offer a mode that hides rows on which all compared models agree.

#### Scenario: Identical rows hidden

- **WHEN** differences-only mode is enabled
- **THEN** rows whose values are equal across all compared models are hidden
- **AND** the number of hidden rows is stated

#### Scenario: Toggle is reversible

- **WHEN** differences-only mode is disabled again
- **THEN** the full row set is shown

### Requirement: Difference highlighting

In the full comparison the view SHALL visually mark rows on which the compared models differ, and SHALL mark the best value on rows with a meaningful ordering.

#### Scenario: Differing rows marked

- **WHEN** a row's values are not equal across all compared models
- **THEN** the row is visually marked as differing

#### Scenario: Best value marked

- **WHEN** a row holds a comparable numeric value with an unambiguous better direction (for example longer battery life, lower weight, lower price)
- **THEN** the leading model's cell is marked
- **AND** rows without an unambiguous better direction are not marked

### Requirement: Column management

Models SHALL be addable, removable, and reorderable from within the comparison view.

#### Scenario: Remove a column

- **WHEN** a model's remove control is used
- **THEN** its column disappears and the remaining columns close the gap
- **AND** the comparison selection and URL update

#### Scenario: Add from within comparison

- **WHEN** the add control is used below the selection limit
- **THEN** a searchable picker offers the remaining catalog models

### Requirement: Readable at any width

The comparison SHALL remain legible as columns are added and on narrow viewports.

#### Scenario: Sticky context

- **WHEN** the comparison is scrolled vertically
- **THEN** the model headers remain visible
- **AND** the specification labels remain visible while scrolling horizontally

#### Scenario: Narrow viewport

- **WHEN** the viewport is too narrow for all columns
- **THEN** the table scrolls horizontally within its own container without the page scrolling horizontally

### Requirement: Shareable comparison

A comparison SHALL be fully reconstructible from its URL.

#### Scenario: Comparison URL

- **WHEN** a comparison URL is opened in a fresh session
- **THEN** the same models, order, and differences-only setting are restored
