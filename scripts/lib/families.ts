/**
 * Product classification, shared by discovery (which watches are in the catalog)
 * and normalization (which family a model belongs to).
 *
 * Garmin's own product names are the only signal used — no outside knowledge.
 */

/** Strips ®/™, normalises the non-breaking spaces Garmin sprinkles into names. */
export function cleanName(name: string): string {
  return name
    .replace(/[®™]/g, '')
    .replace(/[\u00a0\u202f\u2009]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Diacritic- and case-insensitive form, so `fēnix` and `fenix` compare equal. */
export function fold(text: string): string {
  return cleanName(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export interface FamilyRule {
  /** Canonical family name, written the way Garmin writes it. */
  family: string;
  /** Matched against the folded product name. */
  test: RegExp;
}

/**
 * Wrist-worn watch families. The proposal names the in-scope families; quatix and
 * D2 are included too because they are wrist smartwatches Garmin currently sells,
 * and excluding them would under-collect against `catalog-ingestion`.
 */
export const WATCH_FAMILIES: FamilyRule[] = [
  { family: 'Forerunner', test: /^forerunner\b/ },
  { family: 'fēnix', test: /^fenix\b/ },
  { family: 'epix', test: /^epix\b/ },
  { family: 'Enduro', test: /^enduro\b/ },
  { family: 'tactix', test: /^tactix\b/ },
  { family: 'MARQ', test: /^marq\b/ },
  { family: 'Instinct', test: /^instinct\b/ },
  { family: 'Venu', test: /^venu\b/ },
  { family: 'vívoactive', test: /^vivoactive\b/ },
  { family: 'vívomove', test: /^vivomove\b/ },
  { family: 'Lily', test: /^lily\b/ },
  { family: 'quatix', test: /^quatix\b/ },
  { family: 'D2', test: /^d2\b/ },
  // Golf: only the S-series (and the discontinued X-series) are worn on the wrist;
  // Approach G/R/Z/CT are handhelds, launch monitors, rangefinders and sensors.
  { family: 'Approach', test: /^approach s\d/ },
  // Dive: Mk-series computers and the G-series are wrist-worn; T-series are
  // transceivers and X-series are transmitters.
  { family: 'Descent', test: /^descent (mk|g\d)/ },
];

/** Names that are wrist-worn-looking but are accessories or non-watch hardware. */
const NON_WATCH_MARKERS: Array<{ test: RegExp; reason: string }> = [
  // Deliberately specific: a bare `band` would swallow devices that merely have
  // "Band" in their name rather than being one.
  {
    test: /\b(armband|wechselarmband|ersatzarmband|quickfit|schnellwechsel|strap)\b/,
    reason: 'band or strap accessory',
  },
  { test: /\b(ladekabel|ladegerat|charging|charger|kabel)\b/, reason: 'charging accessory' },
  { test: /\b(schutzfolie|displayschutz|hulle|case cover|tasche)\b/, reason: 'protective accessory' },
  { test: /\b(hrm|herzfrequenz|brustgurt|chest strap)\b/, reason: 'heart-rate strap, not a watch' },
  { test: /\b(waage|scale)\b/, reason: 'smart scale, not a watch' },
  { test: /^index\b/, reason: 'Index health monitor, not a watch' },
  { test: /\b(edge|varia|rally|vector|tacx|rad)\b/, reason: 'cycling hardware, not a watch' },
  { test: /\b(gpsmap|montana|etrex|inreach|alpha|astro)\b/, reason: 'handheld or communicator, not a watch' },
  { test: /\b(bounce|vivofit jr)\b/, reason: "kids' tracker, not a wrist smartwatch" },
  { test: /\b(zubehor|accessor)/, reason: 'accessory' },
];

export interface Classification {
  isWatch: boolean;
  family: string | null;
  /** Why it was included or excluded — carried straight into the run report. */
  reason: string;
}

export function classifyProduct(name: string): Classification {
  const folded = fold(name);

  for (const marker of NON_WATCH_MARKERS) {
    if (marker.test.test(folded)) {
      return { isWatch: false, family: null, reason: marker.reason };
    }
  }

  for (const rule of WATCH_FAMILIES) {
    if (rule.test.test(folded)) {
      return { isWatch: true, family: rule.family, reason: `matched family ${rule.family}` };
    }
  }

  return {
    isWatch: false,
    family: null,
    reason: 'name matches no wrist-worn watch family',
  };
}

/** True for any name that looks like a watch — used by the discovery-gap check. */
export function looksLikeWatch(name: string): boolean {
  const folded = fold(name);
  return WATCH_FAMILIES.some((r) => r.test.test(folded));
}
