import { cleanLabel, FIELD_MAP, GNSS_LABELS, SENSOR_SECTION } from './field-map.js';
import { parseFlagText, value } from './parsers.js';
import { FIELD_IDS } from '../../src/data/schema.js';
import type { NormalizedSpecs, NormalizedValue, RawSpecRow } from '../../src/data/contract.js';

/**
 * Mapping one model's raw rows onto the comparison schema (tasks 5.1–5.5).
 *
 * Kept apart from the CLI in `index.ts` so the tests can exercise it without
 * running a normalization pass as a side effect of importing it.
 */

const NOT_PUBLISHED: NormalizedValue = { kind: 'not-published' };

/** A normalized field is only overwritten while it is still unset. */
function setIfEmpty(specs: NormalizedSpecs, field: string, next: NormalizedValue | null): void {
  if (!next) return;
  const current = specs[field];
  if (!current || current.kind === 'not-published') specs[field] = next;
}

function isSupported(row: RawSpecRow): boolean {
  if (row.valueKind === 'marker-yes') return true;
  if (row.valueKind === 'marker-no') return false;
  return parseFlagText(row.value)?.state === 'supported';
}

export interface NormalizationResult {
  specs: NormalizedSpecs;
  /** Raw labels that fed at least one normalized field. */
  consumed: Set<string>;
}

export function normalizeRows(rows: RawSpecRow[]): NormalizationResult {
  const specs: NormalizedSpecs = {};
  for (const id of FIELD_IDS) specs[id] = NOT_PUBLISHED;
  const consumed = new Set<string>();

  /* Direct label → field mappings */
  for (const row of rows) {
    const label = cleanLabel(row.label);
    for (const mapping of FIELD_MAP) {
      if (!mapping.labels.some((pattern) => pattern.test(label))) continue;
      const parsed = mapping.parse(row);
      if (parsed) {
        setIfEmpty(specs, mapping.field, parsed);
        consumed.add(label);
      }
    }
  }

  /* Derived: geometry falls out of the dimension triple */
  const dimensions = specs.caseDimensions;
  if (dimensions?.kind === 'dimensions') {
    setIfEmpty(specs, 'caseSize', {
      kind: 'number',
      value: dimensions.value.widthMm,
      unit: 'mm',
      bound: 'exact',
      source: dimensions.source,
    });
    if (dimensions.value.thicknessMm !== null) {
      setIfEmpty(specs, 'caseThickness', {
        kind: 'number',
        value: dimensions.value.thicknessMm,
        unit: 'mm',
        bound: 'exact',
        source: dimensions.source,
      });
    }
  }

  /* Derived: the two battery modes the catalog sorts and charts on */
  const battery = specs.battery;
  if (battery?.kind === 'battery') {
    const longest = (role: string) =>
      battery.modes
        .filter((mode) => mode.role === role)
        .sort((a, b) => b.hours - a.hours)[0];

    const smartwatch = longest('smartwatch');
    if (smartwatch) {
      setIfEmpty(specs, 'batterySmartwatchHours', {
        kind: 'number',
        value: smartwatch.hours,
        unit: 'h',
        bound: smartwatch.bound,
        source: smartwatch.sourceText,
      });
    }
    const gps = longest('gps-only');
    if (gps) {
      setIfEmpty(specs, 'batteryGpsHours', {
        kind: 'number',
        value: gps.hours,
        unit: 'h',
        bound: gps.bound,
        source: gps.sourceText,
      });
    }
  }

  /* Derived: satellite systems, from the individual marker rows */
  const systems: string[] = [];
  for (const row of rows) {
    const label = cleanLabel(row.label);
    const match = GNSS_LABELS.find((entry) => entry.test.test(label));
    if (match && isSupported(row) && !systems.includes(match.name)) {
      systems.push(match.name);
      consumed.add(label);
    }
  }
  if (systems.length > 0) {
    setIfEmpty(specs, 'gnssSystems', value.list(systems, systems.join(', ')));
  }

  /**
   * Derived: the sensor list is Garmin's own `Sensoren` section, minus the
   * satellite systems it also files there — those are already `gnssSystems`, and
   * repeating them would pad every model's sensor list with six duplicates.
   */
  const sensors: string[] = [];
  for (const row of rows) {
    if (!SENSOR_SECTION.test(cleanLabel(row.section))) continue;
    if (!isSupported(row)) continue;
    const label = cleanLabel(row.label);
    if (GNSS_LABELS.some((entry) => entry.test.test(label))) continue;
    if (!sensors.includes(label)) sensors.push(label);
    consumed.add(label);
  }
  if (sensors.length > 0) {
    setIfEmpty(specs, 'sensors', value.list(sensors, sensors.join(', ')));
  }

  /* Derived: Wi-Fi is published inside the connectivity list, not as its own row */
  const connectivity = specs.connectivity;
  if (connectivity?.kind === 'list') {
    const wifi = connectivity.items.find((item) => /wlan|wi-?fi/i.test(item));
    if (wifi) {
      setIfEmpty(specs, 'wifi', { kind: 'flag', state: 'supported', source: wifi });
    }
  }

  return { specs, consumed };
}
