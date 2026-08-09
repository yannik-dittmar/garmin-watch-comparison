#!/bin/sh
# Cold start: scrape, build, serve. Warm start: serve.
#
# The snapshot lives on a volume rather than in the image, so "is there a
# snapshot?" is a runtime question. And because vite.config.ts bakes the snapshot
# into the bundle at build time, the build cannot run until the scrape has — which
# is why both happen here, at container start, instead of in the Dockerfile.

set -e

cd /app

say() { echo "==> $*"; }

if [ "${REFRESH:-0}" = "1" ] || [ ! -f data/catalog.json ]; then
  if [ "${REFRESH:-0}" = "1" ]; then
    say "REFRESH=1 — refetching the snapshot from garmin.com"
  else
    say "no snapshot at data/catalog.json — fetching one from garmin.com"
    say "expect 10-15 minutes: the fetchers are rate-limited on purpose"
  fi

  # Order matters: images rewrites the remote URLs in data/raw/products/*.json to
  # local paths, and normalize reads those records afterwards.
  npm run ingest
  npm run images
  npm run normalize

  # A new snapshot invalidates the bundle it was baked into.
  rm -rf dist
else
  say "snapshot present — skipping the scrape (set REFRESH=1 to refetch)"
fi

if [ ! -f dist/index.html ]; then
  say "building the site"
  npm run build
fi

mkdir -p /run/nginx
say "serving on port 80"
exec nginx -g 'daemon off;'
