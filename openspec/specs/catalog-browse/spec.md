# catalog-browse Specification

## Purpose

Gives an at-a-glance overview of the entire Garmin wrist-smartwatch catalog with search, faceted filtering, and sorting, so a shortlist can be narrowed down from a hundred-plus models within a few interactions.

## Requirements

### Requirement: Complete catalog overview

The overview SHALL present every model in the snapshot as a card showing its image, name, family, price, and a small set of headline specifications.

#### Scenario: All models listed

- **WHEN** the overview is opened with no filters applied
- **THEN** every model in the snapshot is reachable through the list
- **AND** the number of models shown is displayed

#### Scenario: Snapshot date shown

- **WHEN** the overview is displayed
- **THEN** the date of the underlying data snapshot is visible
- **AND** prices are labelled as of that date

### Requirement: Faceted filtering

The overview SHALL offer filters over normalized fields, at minimum: family, price range, case size, display type, battery life in smartwatch mode, water rating, and the presence of individual features (music, payments, maps, touchscreen, multi-band GNSS, solar, LED flashlight, cellular/satellite messaging).

#### Scenario: Filters narrow results

- **WHEN** one or more filters are applied
- **THEN** only models satisfying all active filters are shown
- **AND** the result count updates

#### Scenario: Filter option counts

- **WHEN** filter options are displayed
- **THEN** each option shows how many models currently match it

#### Scenario: Filters are clearable

- **WHEN** filters are active
- **THEN** each filter can be removed individually and all filters can be cleared at once

#### Scenario: Empty result is explained

- **WHEN** an active filter combination matches no model
- **THEN** an explicit empty state is shown naming the filters responsible
- **AND** a one-click way to relax them is offered

### Requirement: Search

The overview SHALL provide a text search over model name, family, and part number.

#### Scenario: Substring and diacritic-insensitive match

- **WHEN** a query such as `fenix` is entered
- **THEN** models named `fēnix` match
- **AND** matches update as the query is typed

### Requirement: Sorting

The overview SHALL allow sorting by price, battery life, weight, case size, and release recency, ascending or descending.

#### Scenario: Sort applied

- **WHEN** a sort field and direction are chosen
- **THEN** the visible models are ordered accordingly
- **AND** models missing a value for that field are grouped at the end rather than treated as zero

### Requirement: Selection for comparison

Models SHALL be selectable from the overview for comparison, with the current selection visible at all times.

#### Scenario: Select and deselect

- **WHEN** a model's compare control is activated
- **THEN** it is added to the comparison selection
- **AND** activating it again removes it

#### Scenario: Selection limit

- **WHEN** the selection already holds the maximum comparable number of models
- **THEN** further selection is refused with an explanation naming the limit

#### Scenario: Selection survives filtering

- **WHEN** filters change so a selected model is no longer visible
- **THEN** it remains in the selection

### Requirement: Favourites shortlist

The site SHALL let models be marked as favourites, persisted locally across sessions.

#### Scenario: Favourite persists

- **WHEN** a model is favourited and the browser is reloaded
- **THEN** it is still marked as a favourite

#### Scenario: Filter to favourites

- **WHEN** the favourites-only filter is active
- **THEN** only favourited models are shown

### Requirement: Shareable and restorable view state

Search text, active filters, sort, and comparison selection SHALL be encoded in the URL.

#### Scenario: URL reflects state

- **WHEN** filters, sorting, or selection change
- **THEN** the URL updates without a full page reload

#### Scenario: URL restores state

- **WHEN** a previously copied URL is opened
- **THEN** the same filters, sort, and comparison selection are restored

### Requirement: Responsive, accessible, themed presentation

The site SHALL be usable on desktop and mobile widths, operable by keyboard, and SHALL support light and dark themes.

#### Scenario: Mobile layout

- **WHEN** the viewport is narrow
- **THEN** the layout reflows without horizontal page scrolling
- **AND** filters remain reachable

#### Scenario: Keyboard operation

- **WHEN** the interface is navigated using only the keyboard
- **THEN** every control including filters, selection, and navigation is reachable and activatable
- **AND** the focused element is visibly indicated

#### Scenario: Theme

- **WHEN** the viewer's system theme is dark, or dark mode is chosen explicitly
- **THEN** the site renders in a dark palette with text contrast meeting WCAG AA
