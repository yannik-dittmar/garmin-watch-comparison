import type {
  BatteryMode,
  BoundKind,
  Dimensions,
  NormalizedValue,
  Resolution,
  WaterRating,
} from '../../src/data/contract.js';

/**
 * Typed parsers (tasks 5.3, 5.4).
 *
 * Everything here is German-locale aware: the decimal separator is a comma, and
 * Garmin separates a number from its unit with a non-breaking or thin space more
 * often than with a plain one. Bound semantics (`Bis zu` → upper bound) are kept
 * alongside the number instead of being flattened into it, and every parser
 * carries the source text so the original wording stays retrievable.
 */

const SPACES = /[\u00a0\u202f\u2009]/g;

export function normalizeSpaces(text: string): string {
  return text.replace(SPACES, ' ');
}

/** `42,6` → 42.6; `1.234,5` → 1234.5. */
export function parseGermanNumber(text: string): number | null {
  const cleaned = normalizeSpaces(text).trim().replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

const BOUND_PATTERNS: Array<{ test: RegExp; bound: BoundKind }> = [
  { test: /\bbis zu\b/i, bound: 'up-to' },
  { test: /\bup to\b/i, bound: 'up-to' },
  { test: /\bbis\b/i, bound: 'up-to' },
  { test: /\bmindestens\b|\bab\b/i, bound: 'at-least' },
  { test: /\bca\.|\betwa\b|~/i, bound: 'approx' },
];

export function detectBound(text: string): BoundKind {
  const normalized = normalizeSpaces(text);
  // A real range (`126 bis 203 mm`) beats the bare `bis` upper-bound reading.
  if (/\d\s*(?:bis|-|–|—)\s*\d/.test(normalized) && !/bis zu/i.test(normalized)) return 'range';
  for (const pattern of BOUND_PATTERNS) if (pattern.test.test(normalized)) return pattern.bound;
  return 'exact';
}

export interface ParsedNumber {
  value: number;
  bound: BoundKind;
  max?: number;
}

/** A number with its bound semantics — `Bis zu 15 Tage`, `126 bis 203 mm`. */
export function parseBoundedNumber(text: string): ParsedNumber | null {
  const normalized = normalizeSpaces(text);
  const bound = detectBound(normalized);

  if (bound === 'range') {
    const range = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:bis|-|–|—)\s*(\d+(?:[.,]\d+)?)/);
    if (range) {
      const low = parseGermanNumber(range[1]);
      const high = parseGermanNumber(range[2]);
      if (low !== null && high !== null) return { value: low, bound: 'range', max: high };
    }
  }
  const value = parseGermanNumber(normalized);
  return value === null ? null : { value, bound };
}

/**
 * `42,6 x 42,6 x 11,9 mm` → three millimetre numbers.
 *
 * Garmin publishes the unit inconsistently — `… 12,9 (mm)` and
 * `Durchmesser x Dicke: 46 x 15 mm` both occur — so the unit is matched
 * loosely and a two-number form is accepted as width × thickness.
 */
export function parseDimensions(text: string): Dimensions | null {
  const normalized = normalizeSpaces(text);

  // `Durchmesser x Dicke: 46 x 15 mm` — two numbers, the second is thickness.
  const diameterAndThickness = normalized.match(
    /Durchmesser\s*[x×]\s*Dicke\s*:\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i,
  );
  if (diameterAndThickness) {
    const diameter = parseGermanNumber(diameterAndThickness[1]);
    const thickness = parseGermanNumber(diameterAndThickness[2]);
    if (diameter !== null) {
      return { widthMm: diameter, heightMm: diameter, thicknessMm: thickness };
    }
  }

  const triple = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(?:mm)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:mm)?\s*(?:[x×]\s*(\d+(?:[.,]\d+)?))?\s*\(?\s*mm\)?/i,
  );
  if (!triple) return null;
  const widthMm = parseGermanNumber(triple[1]);
  const heightMm = parseGermanNumber(triple[2]);
  const thicknessMm = triple[3] ? parseGermanNumber(triple[3]) : null;
  if (widthMm === null || heightMm === null) return null;
  return { widthMm, heightMm, thicknessMm };
}

/** `390 x 390 Pixel`, `390x390 Pixel`. */
export function parseResolution(text: string): Resolution | null {
  const match = normalizeSpaces(text).match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

/** `41 g`, `61,5 g` → grams. */
export function parseMass(text: string): ParsedNumber | null {
  const normalized = normalizeSpaces(text);
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(g|kg)\b/i);
  if (!match) return null;
  const value = parseGermanNumber(match[1]);
  if (value === null) return null;
  return { value: match[2].toLowerCase() === 'kg' ? value * 1000 : value, bound: detectBound(normalized) };
}

/** `30,4 mm (1,2") Durchmesser`, `43 x 43 x 11,6 mm` → the leading millimetre value. */
export function parseMillimetres(text: string): ParsedNumber | null {
  const normalized = normalizeSpaces(text);
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*mm/i);
  if (!match) return null;
  const value = parseGermanNumber(match[1]);
  return value === null ? null : { value, bound: detectBound(normalized) };
}

/** `4 GB`, `32 GB`, `16 MB` → gigabytes. */
export function parseStorageGb(text: string): ParsedNumber | null {
  const normalized = normalizeSpaces(text);
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(GB|MB|TB)\b/i);
  if (!match) return null;
  const value = parseGermanNumber(match[1]);
  if (value === null) return null;
  const unit = match[2].toUpperCase();
  const gb = unit === 'MB' ? value / 1024 : unit === 'TB' ? value * 1024 : value;
  return { value: gb, bound: detectBound(normalized) };
}

/** `10 ATM`, `Schwimmen, 5 ATM`, `EN 13319`. */
export function parseWaterRating(text: string): WaterRating | null {
  const normalized = normalizeSpaces(text).trim();
  if (!normalized) return null;

  const atm = normalized.match(/(\d+(?:[.,]\d+)?)\s*ATM/i);
  if (atm) {
    const value = parseGermanNumber(atm[1]);
    return { label: normalized, standard: 'ATM', value };
  }
  const wr = normalized.match(/(?:WR|Wasserdicht(?:igkeit)?)\s*(\d+)\s*m/i);
  if (wr) return { label: normalized, standard: 'WR', value: Number(wr[1]) };
  if (/EN\s*13319/i.test(normalized)) return { label: normalized, standard: 'EN13319', value: null };
  const ip = normalized.match(/IP(X?\d+)/i);
  if (ip) return { label: normalized, standard: 'IPX', value: null };
  return { label: normalized, standard: 'other', value: null };
}

/* ------------------------------------------------------------------ */
/* Battery                                                             */
/* ------------------------------------------------------------------ */

const HOURS_PER_DAY = 24;

/**
 * Duration units, German and English: the de-DE pages carry untranslated English
 * battery blocks on the aviation models, and simpler watches are rated in weeks.
 */
const DURATION = /(\d+(?:[.,]\d+)?)\s*(Tage?|Wochen?|Stunden?|Std\.?|h|Minuten?|days?|weeks?|hours?|hrs?|minutes?)\b/i;

function toHours(amount: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('tag') || u.startsWith('day')) return amount * HOURS_PER_DAY;
  if (u.startsWith('woche') || u.startsWith('week')) return amount * HOURS_PER_DAY * 7;
  if (u.startsWith('minute')) return amount / 60;
  return amount;
}

function slugify(label: string): string {
  return normalizeSpaces(label)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function modeRole(label: string): BatteryMode['role'] {
  const folded = normalizeSpaces(label).toLowerCase();
  // Saver is tested first: `Battery Saver Watch Mode` would otherwise read as
  // the smartwatch mode, and `Uhrmodus` on simpler watches genuinely is it.
  if (/energiespar|akku-?spar|battery saver/.test(folded)) return 'battery-saver';
  if (/expedition/.test(folded)) return 'expedition';
  // `GPS-Modus ohne Musik` is a GPS mode, not a music one — the negation has to
  // be removed before the mode is tested for music.
  const musicClaim = folded.replace(/ohne\s+musik|without\s+music/g, '');
  if (/musik|music/.test(musicClaim)) return 'gps-music';
  if (/smartwatch|uhrmodus|watch mode/.test(folded)) return 'smartwatch';
  if (/gps|gnss|satellit|satellite/.test(folded)) return 'gps-only';
  return 'other';
}

/**
 * Splits a multi-mode battery block into one entry per mode.
 *
 * The block is one cell holding lines like
 *   `Smartwatch-Modus: Bis zu 11 Tage (5 Tage bei eingeschaltetem Display)`
 *   `GNSS-Modus mit allen Systemen: Bis zu 17 Stunden`
 * Durations are normalized to hours so modes are comparable and chartable, while
 * each entry keeps its own label and source line.
 */
export function parseDurationHours(text: string): ParsedNumber | null {
  const normalized = normalizeSpaces(text);
  const headline = normalized.split('(')[0];
  const match = headline.match(DURATION);
  if (!match) return null;
  const amount = parseGermanNumber(match[1]);
  if (amount === null) return null;
  return { value: toHours(amount, match[2]), bound: detectBound(headline) };
}

export function parseBatteryModes(text: string): BatteryMode[] {
  const normalized = normalizeSpaces(text);
  const modes: BatteryMode[] = [];
  const seen = new Set<string>();

  for (const rawLine of normalized.split(/\n|;/)) {
    const line = rawLine.trim();
    if (!line || /^\*/.test(line) || /^siehe details/i.test(line)) continue;

    const split = line.match(/^(.{2,80}?):\s*(.+)$/);
    if (!split) continue;
    const label = split[1].trim();
    const rest = split[2].trim();

    // The headline figure is what precedes any parenthetical caveat.
    const headline = rest.split('(')[0];
    const duration = headline.match(DURATION);
    if (!duration) continue;

    const amount = parseGermanNumber(duration[1]);
    if (amount === null) continue;
    const hours = toHours(amount, duration[2]);

    let id = slugify(label);
    if (seen.has(id)) id = `${id}-${modes.length}`;
    seen.add(id);

    modes.push({
      id,
      label,
      role: modeRole(label),
      hours,
      bound: detectBound(headline),
      solar: /solar/i.test(label),
      sourceText: line,
    });
  }

  // Simpler models (Lily) publish one unlabelled figure — `Bis zu 5 Tage` — with
  // no mode structure at all. It is still a battery figure and is kept as one
  // unnamed mode rather than dropped.
  if (modes.length === 0) {
    const single = parseDurationHours(normalized);
    if (single) {
      modes.push({
        id: 'akkulaufzeit',
        label: 'Akkulaufzeit',
        role: 'other',
        hours: single.value,
        bound: single.bound,
        solar: false,
        sourceText: normalized.split('\n')[0].trim(),
      });
    }
  }

  return modes;
}

/* ------------------------------------------------------------------ */
/* Flags                                                               */
/* ------------------------------------------------------------------ */

const AFFIRMATIVE = /^(ja|yes|standard|optimiert|automatisch|erweitert|vorinstalliert|inklusive)\b/i;
const NEGATIVE = /^(nein|no|nicht|keine)\b/i;

export interface ParsedFlag {
  state: 'supported' | 'unsupported';
  /** `Ja (mit kompatiblem Zubehör)` keeps its qualifier, per the spec. */
  qualifier?: string;
}

/**
 * A yes/no row's value, including the qualified forms Garmin uses heavily
 * (`Ja (über ANT+ oder BLE)`, `Nein (16 Graustufen)`).
 *
 * Returning `null` means "this text is not a yes/no answer" — the caller then
 * leaves the field not-published rather than guessing a boolean.
 */
export function parseFlagText(text: string): ParsedFlag | null {
  const normalized = normalizeSpaces(text).trim();
  if (!normalized) return null;

  const qualifier = normalized.match(/^[^(]*\(([^)]*)\)/)?.[1]?.trim();

  if (NEGATIVE.test(normalized)) return { state: 'unsupported', ...(qualifier ? { qualifier } : {}) };
  if (AFFIRMATIVE.test(normalized)) return { state: 'supported', ...(qualifier ? { qualifier } : {}) };

  // Anything else that is non-empty text is an affirmative answer with detail:
  // Garmin writes `Optimiert`, `Tennis, Pickleball` and similar in place of `Ja`.
  return { state: 'supported', qualifier: normalized };
}

/** Convenience wrappers producing contract values straight from source text. */
export const value = {
  number(parsed: ParsedNumber, unit: string, source: string): NormalizedValue {
    return {
      kind: 'number',
      value: parsed.value,
      unit,
      bound: parsed.bound,
      ...(parsed.max !== undefined ? { max: parsed.max } : {}),
      source,
    };
  },
  text(text: string, source: string): NormalizedValue {
    return { kind: 'text', text, source };
  },
  list(items: string[], source: string): NormalizedValue {
    return { kind: 'list', items, source };
  },
  flag(parsed: ParsedFlag, source: string): NormalizedValue {
    return {
      kind: 'flag',
      state: parsed.state,
      ...(parsed.qualifier ? { qualifier: parsed.qualifier } : {}),
      source,
    };
  },
};
