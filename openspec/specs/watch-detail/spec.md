# watch-detail Specification

## Purpose

Shows everything Garmin publishes about one chosen watch — the complete specification table, all purchasable variants, imagery, price, and box contents — so a shortlisted model can be examined in full depth without leaving the site.

## Requirements

### Requirement: Complete specification disclosure

The detail view SHALL expose every raw specification captured for the model, grouped and ordered as Garmin publishes them.

#### Scenario: All specs available

- **WHEN** a model's detail view is opened
- **THEN** every captured specification row is present, under its original section heading
- **AND** no captured row is omitted from the view

#### Scenario: Sections navigable

- **WHEN** the specification set spans many sections
- **THEN** sections can be collapsed and expanded
- **AND** a way to jump to a section is provided

#### Scenario: In-page spec search

- **WHEN** a query is typed into the detail view's spec filter
- **THEN** only rows whose label or value match are shown

### Requirement: Normalized summary

The detail view SHALL open with a summary of the headline normalized fields before the full raw table.

#### Scenario: Summary shown first

- **WHEN** the detail view loads
- **THEN** case size, weight, display type and resolution, battery life by mode, water rating, GNSS capability, and the headline feature flags are shown above the full table

### Requirement: Variants

All captured SKUs of the model SHALL be listed with their distinguishing attributes.

#### Scenario: Variant list

- **WHEN** a model has multiple SKUs
- **THEN** each is listed with its part number, variant name, price, and image
- **AND** selecting a variant updates the displayed image and price

#### Scenario: Single-variant model

- **WHEN** a model has exactly one SKU
- **THEN** the variant list is omitted rather than shown with a single entry

### Requirement: Imagery and box contents

The detail view SHALL show the model's local images and its published box contents.

#### Scenario: Images shown

- **WHEN** the detail view loads
- **THEN** the locally stored product image is displayed
- **AND** if no image was captured, a labelled placeholder is shown instead of a broken image

#### Scenario: Box contents

- **WHEN** box contents were captured
- **THEN** they are listed

### Requirement: Provenance and freshness

The detail view SHALL state where its data came from and when it was captured.

#### Scenario: Source link

- **WHEN** the detail view is displayed
- **THEN** it shows the capture date for this model
- **AND** it links to the model's page on garmin.com as the source

### Requirement: Navigation into comparison and lineage

The detail view SHALL connect to the rest of the site.

#### Scenario: Add to comparison

- **WHEN** the add-to-comparison control is used
- **THEN** the model joins the comparison selection and the control reflects the new state

#### Scenario: Related models

- **WHEN** other models share this model's family
- **THEN** they are listed as related, with a direct link to compare against the current model

### Requirement: Addressable detail pages

Each model's detail view SHALL have its own stable URL.

#### Scenario: Direct link

- **WHEN** a model's detail URL is opened directly in a fresh session
- **THEN** that model's detail view renders
- **AND** the browser back control returns to the previous view
