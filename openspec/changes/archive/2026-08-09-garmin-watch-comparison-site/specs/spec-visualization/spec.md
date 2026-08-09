## Purpose

Turns the normalized catalog into charts — battery, price against capability, feature coverage, physical size, release timeline — so patterns across a hundred-plus models become visible in ways a specification table cannot show.

## ADDED Requirements

### Requirement: Battery life comparison

The site SHALL visualize battery life across models, broken down by operating mode.

#### Scenario: Battery chart

- **WHEN** the battery visualization is shown for the current model set
- **THEN** each model appears with its smartwatch-mode and GPS-mode durations on a shared scale
- **AND** models with no published battery figure are listed separately rather than plotted as zero

#### Scenario: Respects filters

- **WHEN** catalog filters are active
- **THEN** the visualization covers only the filtered models

### Requirement: Price against capability

The site SHALL plot price against a capability measure so value outliers are identifiable.

#### Scenario: Scatter plot

- **WHEN** the price/capability visualization is shown
- **THEN** each model is a point positioned by price and by its capability measure
- **AND** the capability measure's definition is stated in the view

#### Scenario: Point identification

- **WHEN** a point is hovered or focused
- **THEN** the model's name, price, and measure value are shown
- **AND** activating it opens that model's detail view

### Requirement: Feature coverage matrix

The site SHALL present a matrix of models against boolean feature flags.

#### Scenario: Heatmap

- **WHEN** the feature matrix is shown
- **THEN** each cell encodes supported, not supported, or not published for that model and feature
- **AND** rows and columns are labelled and reachable by keyboard

#### Scenario: Sortable by coverage

- **WHEN** a feature column is chosen as the sort key
- **THEN** models supporting that feature are grouped together

### Requirement: To-scale size comparison

The site SHALL render selected watches' case dimensions to scale against one another.

#### Scenario: Size overlay

- **WHEN** two or more models are selected
- **THEN** their case diameters and thicknesses are drawn to a common scale
- **AND** the numeric dimensions are stated alongside

#### Scenario: Missing dimensions

- **WHEN** a selected model has no published dimensions
- **THEN** it is named as unavailable for the overlay rather than drawn at a guessed size

### Requirement: Family generation ladder

The site SHALL show models grouped by family and ordered by generation, so successive generations within a family are visible in sequence.

#### Scenario: Ladder

- **WHEN** the generation view is shown
- **THEN** models are grouped by family and ordered by their generation designation

#### Scenario: Ordering basis is stated, not invented

- **WHEN** the generation view is shown
- **THEN** it states that Garmin publishes no release dates and that ordering follows generation designation and catalog placement
- **AND** no model is assigned a release date that Garmin does not publish

#### Scenario: Ungradeable models

- **WHEN** a model's generation cannot be derived from Garmin's data
- **THEN** it is shown in its family group as unordered rather than placed at a guessed position

### Requirement: Chart legibility and accessibility

Every visualization SHALL be readable in both themes and SHALL not depend on colour alone to convey meaning.

#### Scenario: Theme adaptation

- **WHEN** the theme changes between light and dark
- **THEN** chart marks, axes, and labels remain legible with sufficient contrast

#### Scenario: Non-colour encoding

- **WHEN** a chart distinguishes categories or states by colour
- **THEN** a second cue such as label, shape, or pattern carries the same distinction

#### Scenario: Tabular fallback

- **WHEN** a chart is displayed
- **THEN** the same data is available in a tabular or textual form reachable by keyboard and screen reader

#### Scenario: Narrow viewport

- **WHEN** the viewport is too narrow for the chart's natural width
- **THEN** the chart scrolls within its own container without the page scrolling horizontally
