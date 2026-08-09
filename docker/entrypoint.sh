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
  # The response cache has no TTL, so a stored price is served forever. A refresh
  # that reused it could not detect the change it exists to detect, which is why
  # REFRESH=1 bypasses it and a first fetch (with no cache to speak of) does not
  # need to (design D8).
  if [ "${REFRESH:-0}" = "1" ]; then
    say "REFRESH=1 — refetching the snapshot from garmin.com, ignoring the response cache"
    npm run ingest -- --no-cache
  else
    say "no snapshot at data/catalog.json — fetching one from garmin.com"
    say "expect a few minutes: the fetchers are rate-limited on purpose"
    npm run ingest
  fi

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
