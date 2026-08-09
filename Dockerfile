# syntax=docker/dockerfile:1

# One image, one container, one command. Node scrapes the catalogue and builds the
# site; nginx serves it.
#
# Both live in the same image because the snapshot is baked into the bundle
# (vite.config.ts copies data/ into dist/data/ at build time), so the build cannot
# run before the scrape. On a cold volume that ordering can only be satisfied at
# container start — see docker/entrypoint.sh.

FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache nginx

# The `playwright` dev dependency downloads ~500 MB of browsers on install.
# They are only needed for the local verification scripts, never in the image.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Dependencies first, so a source edit does not re-run `npm ci`. The dev
# dependencies stay: `npm run build` type-checks, and the pipeline is tsx.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80

# The first start scrapes before it can serve anything, so the grace period covers
# a full cold run rather than the seconds a warm start needs.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20m --retries=3 \
  CMD wget -qO- http://localhost/data/meta.json >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
