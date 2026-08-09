## 1. Drop the image mirror

- [x] 1.1 Delete `scripts/images/index.ts` and the `images` script from `package.json`
- [x] 1.2 Remove the image-localisation step from `scripts/ingest/product.ts` so `product.images` and each `variant.images` keep their `res.garmin.com` URLs
- [x] 1.3 Add the inverted host guard in ingestion: every model and variant image URL must be on `res.garmin.com`, or the run fails (design D9)
- [x] 1.4 Assert the same host constraint in `scripts/normalize/` before the snapshot is written (design D9)
- [x] 1.5 Retire `missingImages` from `src/data/contract.ts` and update the image-path doc comments at `contract.ts:131`, `:157`, `:177`, `:224` to describe remote URLs
- [x] 1.6 Report models Garmin publishes no image for via the existing reporter, non-fatally
- [x] 1.7 Remove `/public/img/` from `.gitignore` and delete the local `public/img/` tree
- [x] 1.8 Run `npm run ingest && npm run normalize` and confirm every `image`/`images` value in `data/catalog.json` and `data/models/*.json` is an absolute `res.garmin.com` URL — *3 474 URLs across catalog and all 83 model files, 0 off-host, 0 local `/img/` paths*

## 2. Client-side image handling

- [x] 2.1 Add a shared image component owning `onError` → labelled placeholder, `loading="lazy"`, and `decoding="async"` (design D10)
- [x] 2.2 Use it in `src/components/ModelCard.tsx`
- [x] 2.3 Use it in `src/routes/Detail.tsx`, including the variant image that changes on variant selection
- [x] 2.4 Use it anywhere `src/routes/Compare.tsx` renders a model image
- [x] 2.5 Verify the placeholder appears — and the surrounding view still renders — when an image URL is made deliberately unreachable

## 3. Fonts to jsDelivr

- [x] 3.1 Rewrite all 16 `@font-face` `src` URLs in `src/styles/fonts.css` to exact-version `cdn.jsdelivr.net/npm/@fontsource*@5.3.0/files/<same-filename>.woff2` (design D11)
- [x] 3.2 Update the file's header comment: no longer self-hosted, and no longer a no-network guarantee
- [x] 3.3 Add `<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>` to `index.html`
- [x] 3.4 Confirm `unicode-range` splits are preserved and that `fēnix` renders in Archivo/IBM Plex rather than a fallback face
- [x] 3.5 Confirm no `@fontsource` package remains in `package.json` and no reference to `/fonts/` remains in the source

## 4. Identity, disclaimer, indexing

- [x] 4.1 Change the `index.html` `<title>` to `Garmin Smartwatch Vergleich` and confirm `<meta name="robots" content="noindex, nofollow">` survives the edit
- [x] 4.2 Update the site name wherever it appears in `src/app/Layout.tsx` and any header component
- [x] 4.3 Add a persistent footer disclaimer, present on every route, linking to the full text
- [x] 4.4 Add a `#/legal` route carrying the full disclaimer: unofficial and unaffiliated; names, specifications and imagery are Garmin's property; no guarantee of accuracy or currency; confirm on garmin.com before purchasing; imagery and fonts load from third-party hosts
- [x] 4.5 Show the snapshot capture date plus store and currency (Germany / de-DE / EUR) wherever prices appear
- [x] 4.6 Add `public/robots.txt` that permits crawling and does **not** `Disallow: /` (design D12)
- [x] 4.7 Add `public/.nojekyll`

## 5. Commit the snapshot

- [x] 5.1 Change `.gitignore` to track `data/catalog.json`, `data/meta.json`, and `data/models/`, while keeping `data/raw/` and `data/reports/` ignored
- [x] 5.2 Update the `.gitignore` comment block, which currently states the snapshot is not git's job to version and names the deleted `images` stage in its rebuild instructions
- [x] 5.3 Commit the current snapshot so the regression guard has a baseline in git (design D4)

## 6. Scraper resilience

- [x] 6.1 Add a per-run in-memory cookie jar to `scripts/lib/fetcher.ts`: collect `set-cookie`, replay on later requests in the same run (design D7)
- [x] 6.2 Confirm a run still passes the host allowlist check and that the fetch log is unchanged in shape
- [x] 6.3 Fix `docker/entrypoint.sh` so the `REFRESH=1` path passes `--no-cache` to `npm run ingest`, which today re-reads the cache and can change nothing (design D8)

## 7. Pages build configuration

- [x] 7.1 Confirm `vite.config.ts` keeps `base: '/'` as its default so the Docker build is unaffected, and that the Pages build overrides it with `--base` (design D5)
- [x] 7.2 Verify a `--base=/some-repo/` build produces a bundle whose asset, snapshot, and font URLs all resolve under that prefix
- [x] 7.3 Serve that build from a subdirectory locally and confirm a deep hash route loads cold

## 8. Workflow

- [x] 8.1 Add `.github/workflows/scrape-and-publish.yml` with `schedule`, `workflow_dispatch`, and a `push` trigger filtered to site-code paths
- [x] 8.2 Write the `scrape` job: checkout, `npm ci`, `npm run ingest -- --no-cache`, `npm run normalize`, with `contents: write` and nothing more
- [x] 8.3 Make the job fail on a regression rather than commit — verify `scripts/normalize/index.ts` exits non-zero when its guard trips, and fix it if it does not (design D4)
- [x] 8.4 Commit changed snapshot files on every successful run, including runs with no data change, and upload `data/` as an artifact
- [x] 8.5 Skip the `scrape` job when the trigger is a code-only push, so a CSS change does not scrape Garmin
- [x] 8.6 Write the `publish` job: `needs: scrape`, download the artifact, `vite build --base=/${{ github.event.repository.name }}/`, `upload-pages-artifact`, `deploy-pages`, with `pages: write` and `id-token: write`
- [x] 8.7 Add a hotlink smoke check that fails the run if a known `res.garmin.com` image URL does not return 200 with a foreign referer (design, second risk)
- [x] 8.8 Leave the `schedule` trigger commented out or disabled for the first exercise of the workflow

## 9. Docker and documentation

- [x] 9.1 Remove the `npm run images` stage from `docker/entrypoint.sh`
- [x] 9.2 Remove the now-dead `/img/` block from `docker/nginx.conf`
- [x] 9.3 Correct `README.md`: the site is no longer offline-capable, the `images` stage no longer exists, the snapshot is committed, and Pages is the primary deployment with Docker as a local option
- [x] 9.4 Document the self-hosted-runner fallback and which single line changes to take it (design D2)

## 10. Verification

- [x] 10.1 `npm run test` and `npm run build` both pass
- [ ] 10.2 Trigger the workflow via `workflow_dispatch` and confirm the scrape completes from a GitHub-hosted runner without being blocked by Cloudflare — if blocked, switch the `scrape` job to a self-hosted runner and re-run — *needs a GitHub remote; none is configured*
- [ ] 10.3 Enable Pages and confirm the deployed site renders under `/<repo>/`: catalog grid, a detail view, comparison, charts, and the legal route — *all five verified against a `--base=/some-repo/` build served from a subdirectory locally; the Pages deploy itself is untried*
- [x] 10.4 Confirm in the browser's network panel that the only remote hosts contacted are `res.garmin.com` and `cdn.jsdelivr.net`, and that no catalog request leaves the site's origin
- [x] 10.5 Confirm images are served as WebP by content negotiation
- [ ] 10.6 Enable the `schedule` trigger and confirm the next run commits and republishes on its own — *depends on 10.2*
