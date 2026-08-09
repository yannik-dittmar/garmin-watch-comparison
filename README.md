# Garmin Watch Index

A private, offline comparison site over Garmin's current wrist smartwatch catalog.

garmin.com spreads ~100 wrist models across a dozen category pages, its own compare tool
caps out at a handful of watches, and each model's ~260-row spec table can only be read one
product at a time. This builds a local snapshot of the whole catalog and puts it in one
screen: faceted browse, a 2–4 model comparison matrix, a full per-model spec dump, and five
analysis views.

A full snapshot is **83 models, 190 variants, 1 641 images**, locale `de-DE`, store `DE`.
It is generated, not committed — the first run builds it.

> **Private use only.** Garmin's text, specifications and imagery are reproduced here for
> personal use. This site is not to be published, and it is not affiliated with Garmin.

## Requirements

- **Node.js ≥ 22.12** (or 20.19+) and npm — Vite 7's engine requirement
- Network access to `www.garmin.com` and `res.garmin.com`, but only when refreshing the
  snapshot. The site itself never contacts Garmin.
- ~120 MB of disk for the snapshot and imagery, plus ~96 MB if you keep the HTTP cache

## Quick start

```bash
docker compose up      # http://localhost:8080
```

That is the whole workflow. The container finds no snapshot on the first run, scrapes one,
builds the site from it and serves it — 10 to 15 minutes, with progress in the log. It lands
on the `./data` and `./public/img` mounts, so every later `up` serves in seconds.

Or with Node directly:

```bash
npm install
npm run ingest && npm run images && npm run normalize   # first run only
npm run dev            # http://localhost:5173
```

To serve the production build instead:

```bash
npm run build
npm run preview        # http://localhost:4173
```

**The repository carries no snapshot.** `data/` and `public/img/` are generated and
git-ignored: scraped third-party content is not source, and 61 MB of imagery that changes on
every refresh is not something git should be storing. Both are rebuilt by the pipeline.

`npm run dev` serves the snapshot straight from `data/`; the build copies the three things
the site actually reads (`catalog.json`, `meta.json`, `models/`) into `dist/data/`.

## Refreshing the snapshot

Three stages, in this order. Only the first two touch the network.

```bash
npm run ingest         # garmin.com  → data/raw/**
npm run images         # res.garmin.com → public/img/**
npm run normalize      # data/raw/**  → data/catalog.json, data/models/*.json
```

A full refresh from a cold cache takes a few minutes; re-running `normalize` after a
field-map change takes seconds and never re-fetches anything.

### Useful flags

| Command | Effect |
|---|---|
| `npm run ingest -- --family fenix` | one family unit only (`forerunner`, `fenix`, `instinct`, `venu`, `approach`, `descent`) |
| `npm run ingest -- --limit 5` | smoke test against five models |
| `npm run ingest -- --no-cache` | ignore the response cache and refetch |
| `npm run ingest -- --concurrency 2 --delay 800` | fetch more slowly still |
| `npm run normalize -- --force` | overwrite despite the regression guard |

### The regression guard

`normalize` refuses to overwrite the snapshot if a run yields fewer models, or loses specs
for models that previously had them. It writes `data/reports/normalize.json` and stops.
That is usually right — a broken label pattern looks exactly like this. Once you have read
the report and understand the shrinkage (a discontinued model, a deliberate schema change),
re-run with `--force`.

### Read the reports

Coverage is run output, not debug logging. After a refresh, check:

| File | What a non-empty entry means |
|---|---|
| `data/reports/discovery-gap.json` | A watch in Garmin's master list that no current category returned. `previous-model` entries are expected; `unexplained` ones deserve a look. |
| `data/reports/unmapped-labels.json` | Raw spec labels no normalized field consumed, classified `universal` / `candidate` / `niche`. A `candidate` is worth adding to the field map. |
| `data/reports/sparse-fields.json` | Normalized fields empty for most models. A genuinely rare feature belongs here; a common one means a label pattern stopped matching. |
| `data/reports/ingest.json` | Fetch failures and every product excluded from the catalog, with its reason. |
| `data/reports/images.json` | Images that failed to download after retries. |

`data/README.md` documents every generated file and which stage produces it.

## Tests

```bash
npm test               # 29 tests over committed HTML fixtures
npm run test:watch
```

The parsers are where silent wrongness lives — the UI is visually verifiable, a spec table
is not. The fixtures in `tests/fixtures/` cover one hazard each: a page carrying three
models at once, a qualified `Ja (…)`, a textual `Nein`, the multi-mode battery block,
German decimal commas, and a model missing a whole section.

## Docker

One image, one container, one command:

```bash
docker compose up                  # http://localhost:8080
docker compose up --build          # after a code change
REFRESH=1 docker compose up        # refetch the snapshot first
```

`docker/entrypoint.sh` decides what a start means: no `data/catalog.json` (or `REFRESH=1`)
means scrape, build, serve; otherwise straight to serve. nginx then gzips the snapshot
(`catalog.json` is ~1 MB raw, ~37 KB gzipped) and pins the hashed assets and fonts for a year.

Node stays in the runtime image rather than being dropped after a build stage, because the
scrape has to happen before the build: `vite.config.ts` copies the snapshot into `dist/data/`,
so a bundle built without one would serve an empty site.

The `./data` and `./public/img` mounts are what make the scrape a one-time cost. They also
carry `data/raw/.http-cache`, so a first run that fails partway resumes from the cache
instead of refetching everything.

> Not yet run against a Docker daemon — this environment has none. Treat the first build as
> unverified.

## Layout

```
scripts/ingest/      stage 1   fetch     → data/raw/**            (cached, resumable)
scripts/images/      stage 2b  download  → public/img/<id>/*.jpg
scripts/normalize/   stage 2   map       → data/catalog.json, data/models/<id>.json
src/data/            the frozen contract + the comparison schema
src/                 the site (routes, charts, components)
data/                generated snapshot, git-ignored (only its README is tracked)
tests/               parser tests + HTML fixtures
```

Stages are separate executables with file boundaries between them, so re-running
normalization after a mapping fix never re-fetches 40 pages.

### Where to change things

| To change… | Edit |
|---|---|
| which products count as watches | `scripts/lib/families.ts` |
| which German labels feed a field | `scripts/normalize/field-map.ts` |
| how a value is parsed | `scripts/normalize/parsers.ts` |
| which fields exist, and their filters/heatmap membership | `src/data/schema.ts` |
| colours, type, spacing | `src/styles/tokens.css` |

Adding a comparison field means declaring it in `src/data/schema.ts` and giving it a label
pattern in `field-map.ts`. The filter rail, comparison matrix and heatmap all read the
schema, so nothing else needs touching.

## How the data works

**Everything comes from garmin.com.** The fetcher enforces a host allowlist, so a request
to anywhere else throws rather than being quietly recorded.

**Specs come from the page's `GarminAppBootstrap` JSON**, not from rendered HTML — the full
spec table ships inline before any JS runs. One product page carries the SKUs of every
sibling in its group (the fēnix 8 page serves nine distinct models), so the parser selects
by product id and asserts the match. That is the single most likely source of wrong data
and it has a dedicated test.

**"Not published" is not "not supported".** Garmin marks support with `class="yes"` cells
and expresses absence by omitting the row entirely. The tri-state is carried end-to-end as
a distinct value and rendered with its own glyph and word — a spec Garmin is silent about
reads as *keine Angabe*, never as *Nein*.

**No release dates exist in this data**, so the generation view orders models by the
designation Garmin prints in the product name and says so on the view. A model whose
generation cannot be read from its name is shown unordered rather than at a guessed
position.

## Known limits

- **`de-DE` only.** Prices are euro, store `DE`, and some aviation models ship untranslated
  English spec text upstream (the parsers handle both).
- **Current models only.** Garmin's `previous-models` categories are deliberately excluded;
  the discovery-gap report classifies what that leaves out.
- **Prices are frozen** at snapshot time and shown with that date on every view.
- **One model is included by hand.** `D2 Mach 2 Pro` is a current, priced product that
  appears in no wearable category at all; it sits in an explicit, dated list in
  `scripts/ingest/discovery.ts` rather than being swept in by a rule.
