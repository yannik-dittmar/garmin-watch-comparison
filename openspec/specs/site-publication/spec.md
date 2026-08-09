# site-publication Specification

## Purpose

Governs how the comparison site reaches its audience: static hosting on GitHub Pages under a repository base path, an automated daily refresh whose failures never degrade what visitors see, exclusion from search indexes, and the attribution and warranty disclaimer the published pages must carry.

## Requirements

### Requirement: Static hosting under a base path

The site SHALL be publishable as a static artifact served from a subdirectory of a domain, with no server-side routing, rewriting, or request-time computation.

#### Scenario: Served from a repository subpath

- **WHEN** the built site is served from a subdirectory rather than a domain root
- **THEN** every asset, snapshot file, and route it requests resolves correctly under that subpath
- **AND** no request depends on a server-side rewrite rule

#### Scenario: Deep link survives a cold load

- **WHEN** a route other than the entry route is opened directly in a fresh session
- **THEN** that view renders without the host returning a 404

### Requirement: Automated periodic refresh

The published snapshot SHALL be refreshed on a recurring schedule without manual intervention, and SHALL also be refreshable on demand.

#### Scenario: Scheduled refresh republishes

- **WHEN** the recurring schedule fires
- **THEN** the catalog is re-scraped, re-normalized, and the published site is rebuilt from the new snapshot

#### Scenario: On-demand refresh

- **WHEN** a refresh is triggered manually
- **THEN** it performs the same work as a scheduled run

#### Scenario: Code change republishes without re-scraping

- **WHEN** site code changes but the snapshot does not
- **THEN** the site can be rebuilt and republished from the committed snapshot without contacting Garmin

#### Scenario: Refresh does not reuse stale responses

- **WHEN** a scheduled refresh runs
- **THEN** it fetches prices and specifications from Garmin rather than serving them from a previously stored response cache

### Requirement: A failed refresh never degrades the published site

A refresh that cannot produce a snapshot at least as complete as the published one SHALL fail without changing what visitors see.

#### Scenario: Upstream blocks the scrape

- **WHEN** a refresh run is refused or rate-limited by Garmin and cannot complete
- **THEN** the run reports failure
- **AND** no snapshot is published
- **AND** visitors continue to be served the last good snapshot

#### Scenario: Upstream page structure changes

- **WHEN** a refresh run completes but yields fewer models, or loses specifications for models that previously had them
- **THEN** the regression is reported and the run fails
- **AND** the previously published snapshot remains the live one

#### Scenario: Refresh failure is surfaced

- **WHEN** a scheduled refresh fails
- **THEN** the failure is visible to the maintainer rather than passing silently

### Requirement: Exclusion from search indexes

The published site SHALL instruct search engines not to index it, in a way that a compliant crawler can actually observe.

#### Scenario: Pages are marked not to be indexed

- **WHEN** a crawler fetches any page of the site
- **THEN** the response instructs it not to index the page or follow its links

#### Scenario: Crawling is permitted so the instruction is readable

- **WHEN** a crawler consults the site's robots directives
- **THEN** it is not blocked from fetching the pages
- **AND** the not-to-be-indexed instruction is therefore reachable

### Requirement: Attribution and warranty disclaimer

Every page SHALL carry a disclaimer stating the site's unofficial status, Garmin's ownership of the displayed content, and the absence of any guarantee about the data.

#### Scenario: Disclaimer is always reachable

- **WHEN** any view of the site is displayed
- **THEN** a disclaimer is present on the page
- **AND** it links to a dedicated page carrying the full text

#### Scenario: Disclaimer content

- **WHEN** the full disclaimer is read
- **THEN** it states that the site is unofficial and not affiliated with, endorsed by, or connected to Garmin
- **AND** that product names, specifications, and imagery are the property of Garmin and are shown for comparison purposes
- **AND** that prices and specifications carry no guarantee of accuracy, completeness, or currency, and may differ from what Garmin offers
- **AND** that the reader should confirm any price or specification on garmin.com before purchasing
- **AND** that the browser loads imagery and fonts directly from third-party hosts

#### Scenario: Data is dated and scoped

- **WHEN** prices are displayed anywhere on the site
- **THEN** the snapshot's capture date is visible
- **AND** the store and currency the prices were read from are identified

### Requirement: Typography is served from a pinned CDN

The site SHALL render in its intended typefaces, loaded from version-pinned CDN URLs rather than from files served by the site itself.

#### Scenario: Intended typefaces render

- **WHEN** the published site loads with network access
- **THEN** its display, body, and data typefaces render as specified rather than falling back to system faces

#### Scenario: Font references are pinned and resolvable

- **WHEN** the site's font references are inspected
- **THEN** each names an exact package version rather than a mutable range
- **AND** each resolves to a font file that exists

#### Scenario: Extended Latin is covered

- **WHEN** text containing extended Latin characters such as `fēnix` is rendered
- **THEN** those characters render in the intended typeface rather than a fallback face
