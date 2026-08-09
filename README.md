# Garmin Smartwatch Vergleich

A static comparison site over Garmin's current wrist smartwatch catalog, published to
GitHub Pages and refreshed by a scheduled workflow.

garmin.com spreads ~100 wrist models across a dozen category pages, its own compare tool
caps out at a handful of watches, and each model's ~260-row spec table can only be read one
product at a time. This builds a snapshot of the whole catalog and puts it in one screen:
faceted browse, a 2–4 model comparison matrix, a full per-model spec dump, and five
analysis views.

Current snapshot: **83 models, 190 variants**, locale `de-DE`, store `DE`.

> **Unofficial.** Not affiliated with, endorsed by, or connected to Garmin. Product names,
> specifications and imagery are Garmin's property and are shown for comparison only, with
> no guarantee of accuracy or currency. The site carries the full disclaimer at `#/legal`
> and is marked `noindex`.

## Requirements

- **Node.js ≥ 22.12** (or 20.19+) and npm — Vite 7's engine requirement
- Network access to `www.garmin.com` when refreshing the snapshot
- ~110 MB of disk for the snapshot, of which ~96 MB is the optional HTTP cache

**The site is not offline-capable.** Catalog data — every model, spec and price — is served
from the site's own origin, but the browser loads product imagery from `res.garmin.com` and
web fonts from `cdn.jsdelivr.net` directly. Both are stated in the disclaimer. Without them
the site still works: imagery falls back to a labelled placeholder and type falls back to
the system stack.

Imagery is loaded in two renditions, both from `res.garmin.com`: the detail view's gallery
shows the 600 px asset for the image on display and the 150 px one for each thumbnail in the
contact sheet, so paging through a variant's set costs one full-size fetch per image looked
at rather than one per image published.

## Quick start

The snapshot is committed (`data/catalog.json`, `data/meta.json`, `data/models/`), so you
can go straight to the site:

```bash
npm install
npm run dev            # http://localhost:5173
```

To serve the production build instead:

```bash
npm run build
npm run preview        # http://localhost:4173
```

`npm run dev` serves the snapshot straight from `data/`; the build copies the three things
the site actually reads (`catalog.json`, `meta.json`, `models/`) into `dist/data/`.

## Refreshing the snapshot

Two stages, in this order. Only the first touches the network.

```bash
npm run ingest         # garmin.com  → data/raw/**
npm run normalize      # data/raw/**  → data/catalog.json, data/models/*.json
```

A full refresh from a cold cache takes a few minutes; re-running `normalize` after a
field-map change takes seconds and never re-fetches anything.

Imagery is referenced, not downloaded: ingestion keeps Garmin's own `res.garmin.com` URLs
in the records — a full-size URL and, where the CDN publishes one, its 150 px sibling — and
both stages fail the run if an image URL is ever on another host. Media that is not a still
image is dropped at the boundary and reported instead of being published as a broken image.

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
| `data/reports/normalize.json` | Regression-guard problems, plus models Garmin publishes no image for. |

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

## Deployment

GitHub Pages is the primary deployment; Docker below is a local option.

`.github/workflows/scrape-and-publish.yml` is the whole cycle in one file: scrape →
normalize → regression guard → commit the snapshot → build → deploy. It runs on a daily
schedule, on `workflow_dispatch`, and on pushes that touch site code — where it skips the
scrape entirely and republishes from the committed snapshot, so a CSS change never contacts
Garmin.

Two jobs, not one. `scrape` needs `contents: write` and nothing else; `publish` needs
`pages: write` and `id-token: write`. They hand off through an artifact rather than a second
checkout, so the build uses exactly what the scrape produced instead of racing its push.

A project page is served from a subdirectory, so the base path is a build argument rather
than a constant — `vite build --base=/<repo>/` in CI, plain `vite build` (base `/`) for
Docker. `HashRouter` means no rewrite rules are needed either way.

**Failure is safe.** The regression guard in `normalize` exits non-zero rather than
overwriting a snapshot that got worse, so a blocked or broken scrape fails the run, publishes
nothing, and leaves visitors on the last good deploy.

To set it up: enable Pages with **Source: GitHub Actions** — *not* "Deploy from a branch",
which publishes the repository tree as-is and serves the unbuilt `index.html`, leaving the
browser asking for `/src/main.tsx`. Then run the workflow once via `workflow_dispatch` and
uncomment the `schedule:` block.

`workflow_dispatch` takes a **Publish from the committed snapshot without scraping** tick
box. Use it to get a deploy out without touching garmin.com — the snapshot in git is the
build input either way.

### If Cloudflare blocks the scrape

GitHub's runners are Azure datacenter ranges, and `www.garmin.com` runs Cloudflare bot
management. If a `workflow_dispatch` run fails at the ingest step, move that job — and only
that job — to a machine on a residential connection. It is one line:

```yaml
jobs:
  scrape:
    runs-on: ubuntu-latest      # → self-hosted
```

Nothing else changes: `publish` stays on a GitHub runner, and the artifact handoff between
them is why the two can live on different machines at all.

## Docker

```bash
docker compose up site                    # http://localhost:8080
```

One image, one container: Node and nginx both live in it, because the snapshot is baked into
the bundle at build time (`vite.config.ts` copies `data/` into `dist/data/`), so the site
cannot be built until the snapshot exists. On a cold volume that ordering can only be
satisfied at container start — which is what `docker/entrypoint.sh` does.

nginx gzips the snapshot (`catalog.json` is ~1 MB raw, ~37 KB gzipped) and pins the hashed
assets for a year. It serves neither fonts nor imagery: both are fetched by the client from
jsDelivr and `res.garmin.com`. Without those hosts the site still works — the system font
stack and the labelled placeholder stand in.

**The container needs a snapshot, and makes one if it finds none.** With the snapshot
committed, `./data` is already populated and the first start serves in seconds. An empty
mount makes it scrape garmin.com first:

```bash
docker compose up                         # scrapes only if data/catalog.json is absent
REFRESH=1 docker compose up               # refetch first, ignoring the response cache
```

The `./data` mount is what makes the snapshot and its response cache survive the container.
Without it every restart would scrape from scratch.

To build and run the image directly:

```bash
docker build -t garmin-watch-index .
docker run --rm -p 8080:80 -v "$PWD/data:/app/data" garmin-watch-index
```

> Not yet run against a Docker daemon — this environment has none. The Dockerfile is
> written against the same commands used above, but treat the first build as unverified.

## Layout

```
scripts/ingest/      stage 1   fetch     → data/raw/**            (cached, resumable)
scripts/normalize/   stage 2   map       → data/catalog.json, data/models/<id>.json
src/data/            the frozen contract + the comparison schema
src/                 the site (routes, charts, components)
data/                generated; the normalized half is committed, data/raw/ is not
.github/workflows/   the scheduled refresh and the Pages deploy
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
