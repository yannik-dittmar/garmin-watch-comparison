import type { NormalizedValue, RawSpecRow } from '../../src/data/contract.js';
import type { SpecFieldId } from '../../src/data/schema.js';
import {
  normalizeSpaces,
  parseBatteryModes,
  parseDimensions,
  parseDurationHours,
  parseFlagText,
  parseMass,
  parseMillimetres,
  parseResolution,
  parseStorageGb,
  parseWaterRating,
  value,
} from './parsers.js';

/**
 * The label map (task 5.2).
 *
 * Normalization is a mapping problem, not a parsing problem: Garmin's row labels
 * are German free text that drifts between families and generations, so each
 * normalized field declares the label patterns that feed it, the parser to run,
 * and the unit. Adding a field means adding a row here — never touching the
 * normalizer.
 *
 * Patterns are matched against the cleaned label (soft hyphens and non-breaking
 * spaces removed), case-insensitively.
 */

/** Garmin's labels carry soft hyphens and nbsp; both would break naive matching. */
export function cleanLabel(label: string): string {
  return normalizeSpaces(label)
    .replace(/\u00ad/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The tri-state at its source. `class="yes"` is support; `class="no"` is an
 * explicit denial; text is read for an affirmative or negative word. A row that
 * never appears reaches none of these branches and stays not-published.
 */
export function flagFromRow(row: RawSpecRow): NormalizedValue | null {
  if (row.valueKind === 'marker-yes') return { kind: 'flag', state: 'supported', source: 'yes' };
  if (row.valueKind === 'marker-no') return { kind: 'flag', state: 'unsupported', source: 'no' };
  const parsed = parseFlagText(row.value);
  return parsed ? value.flag(parsed, row.value) : null;
}

export interface FieldMapping {
  field: SpecFieldId;
  labels: RegExp[];
  parse: (row: RawSpecRow) => NormalizedValue | null;
}

const flag = (field: SpecFieldId, ...labels: RegExp[]): FieldMapping => ({
  field,
  labels,
  parse: flagFromRow,
});

const text = (field: SpecFieldId, ...labels: RegExp[]): FieldMapping => ({
  field,
  labels,
  parse: (row) => (row.value.trim() ? value.text(cleanLabel(row.value), row.value) : null),
});

export const FIELD_MAP: FieldMapping[] = [
  /* ---------------- Gehäuse & Display ---------------- */
  {
    field: 'caseDimensions',
    labels: [/^physische größe$/i, /^abmessungen$/i],
    parse: (row) => {
      const dimensions = parseDimensions(row.value);
      return dimensions ? { kind: 'dimensions', value: dimensions, source: row.value } : null;
    },
  },
  {
    field: 'weight',
    labels: [/^gewicht$/i],
    parse: (row) => {
      const mass = parseMass(row.value);
      return mass ? value.number(mass, 'g', row.value) : null;
    },
  },
  {
    field: 'wristRange',
    // The wrist range rides on the second line of the physical-size cell.
    labels: [/^physische größe$/i],
    parse: (row) => {
      const line = row.value.split('\n').find((l) => /handgelenk/i.test(l));
      return line ? value.text(cleanLabel(line), row.value) : null;
    },
  },
  text('displayType', /^displaytyp der smartwatch$/i, /^displaytyp$/i, /^display$/i),
  {
    field: 'displaySize',
    labels: [/^anzeigegröße$/i, /^displaygröße$/i],
    parse: (row) => {
      const mm = parseMillimetres(row.value);
      return mm ? value.number(mm, 'mm', row.value) : null;
    },
  },
  {
    field: 'displayResolution',
    labels: [/^anzeigeauflösung$/i, /^displayauflösung$/i],
    parse: (row) => {
      const resolution = parseResolution(row.value);
      return resolution ? { kind: 'resolution', value: resolution, source: row.value } : null;
    },
  },
  flag('touchscreen', /^touchdisplay$/i, /^touchscreen$/i),
  flag('colorDisplay', /^farbdisplay$/i),
  text('lensMaterial', /^displayglas$/i, /^linsenmaterial$/i, /^material des displays$/i),
  text('bezelMaterial', /^material der lünette$/i, /^lünettenmaterial$/i),
  text('caseMaterial', /^gehäusematerial$/i, /^material des gehäuses$/i),
  text('bandMaterial', /^armbandmaterial$/i, /^material des armbands$/i),
  {
    field: 'bandWidth',
    // Published only as the qualifier of the quick-release row: `Ja (20 mm, …)`.
    labels: [/^schnellwechsel-armbänder$/i, /^quickfit/i],
    parse: (row) => {
      const mm = parseMillimetres(row.value);
      return mm ? value.number(mm, 'mm', row.value) : null;
    },
  },
  {
    field: 'waterRating',
    labels: [/^wasserdichtigkeit$/i, /^wasserfestigkeit$/i],
    parse: (row) => {
      const rating = parseWaterRating(row.value);
      return rating ? { kind: 'water', value: rating, source: row.value } : null;
    },
  },

  /* ---------------- Akku & Energie ---------------- */
  {
    field: 'battery',
    labels: [/^akkulaufzeit$/i, /^batterielaufzeit$/i],
    parse: (row) => {
      const modes = parseBatteryModes(row.value);
      return modes.length > 0 ? { kind: 'battery', modes, source: row.value } : null;
    },
  },
  {
    field: 'batterySmartwatchHours',
    // Published as its own row on nearly every model; the multi-mode block is
    // only the fallback for the models that omit it.
    labels: [/^akkulaufzeit \(smartwatch-modus\)$/i, /^akkulaufzeit smartwatch-modus$/i],
    parse: (row) => {
      const hours = parseDurationHours(row.value);
      return hours ? value.number(hours, 'h', row.value) : null;
    },
  },
  flag('solarCharging', /^solarladung$/i, /^solar$/i, /^power glass/i),
  flag('ultraTrac', /^ultratrac-modus$/i, /^ultratrac$/i),
  text('charging', /^ladeverfahren$/i, /^laden$/i),
  text('batteryType', /^batterietyp$/i, /^akkutyp$/i),
  {
    field: 'memory',
    labels: [/^speicher\/protokoll$/i, /^speicher$/i, /^interner speicher$/i],
    parse: (row) => {
      const gb = parseStorageGb(row.value);
      return gb ? value.number(gb, 'GB', row.value) : null;
    },
  },

  /* ---------------- Navigation & Sensoren ---------------- */
  flag('gnssMultiband', /^multi-?frequenz empfang$/i, /^multiband$/i),
  flag('satIq', /^satiq™?-technologie$/i),
  flag('barometricAltimeter', /^barometrischer höhenmesser$/i),
  flag('compass', /^kompass$/i, /^3-achsen-kompass$/i),
  flag('gyroscope', /^gyroskop$/i),
  flag('thermometer', /^thermometer$/i),

  /* ---------------- Konnektivität ---------------- */
  {
    field: 'connectivity',
    labels: [/^konnektivität$/i, /^verbindungen$/i],
    parse: (row) => {
      const items = cleanLabel(row.value)
        .split(/,|•/)
        .map((s) => s.trim())
        .filter(Boolean);
      return items.length > 0 ? value.list(items, row.value) : null;
    },
  },
  flag('speakerMic', /^eingebauter lautsprecher/i, /^lautsprecher und mikrofon$/i),
  flag('voiceAssistant', /^sprachbefehl$/i, /^sprachassistent/i),
  flag('lte', /^lte-kommunikation$/i),
  flag('satelliteMessaging', /^satelliten-kommunikation$/i, /^inreach/i),
  flag('smartNotifications', /^erhalte smart notifications$/i, /^smart notifications$/i),
  flag('messengerApp', /^kompatibel mit garmin messenger-app$/i),

  /* ---------------- Musik, Bezahlen & Karten ---------------- */
  flag('musicStorage', /^musikspeicher$/i),
  flag('musicPlayback', /^musikwiedergabe$/i),
  flag('garminPay', /^garmin pay™?$/i),
  flag(
    'preloadedMaps',
    /^vorinstallierte karten$/i,
    /^vorinstallierte straßen- und trail-karten$/i,
    /^vollständige vektorkarte$/i,
  ),
  flag('downloadableMaps', /^unterstützung für herunterladbare karten$/i),
  flag('pointToPointNavigation', /^punkt-zu-punkt-navigation$/i),
  flag('ledFlashlight', /^led-taschenlampe$/i),
  flag('tracBack', /^tracback®?$/i),
  flag('elevationProfile', /^zukünftiges höhenprofil$/i, /^höhenprofil$/i),
  flag('connectIq', /^connect iq/i),

  /* ---------------- Gesundheit & Training ---------------- */
  flag('wristHeartRate', /^garmin elevate/i, /^herzfrequenzmessung am handgelenk$/i),
  flag('pulseOx', /^pulse ox/i),
  flag('ecgApp', /^garmin ekg-app$/i, /^ekg-app$/i),
  flag('sleepScore', /^sleep score/i),
  flag('bodyBattery', /^body battery/i),
  flag('hrvStatus', /^hfv status$/i, /^hrv status$/i),
  flag('trainingReadiness', /^trainingsbereitschaft$/i),
  flag('vo2max', /^vo2max/i),
  flag('healthSnapshot', /^health snapshot/i),
  flag('womensHealth', /^frauengesundheit$/i),
  flag('stressTracking', /^stresslevelmessung$/i),
  flag('sleepCoach', /^schlafcoach$/i),
  flag('trainingLoad', /^trainingsbelastung$/i),
  flag('runningDynamics', /^bodenkontaktzeit und balance der bodenkontaktzeit$/i, /^laufeffizienzdaten$/i),
  flag('pacePro', /^pacepro™?-pace-strategien$/i, /^pacepro/i),
];

/** Labels that feed the derived list fields — consumed, but not mapped 1:1. */
export const GNSS_LABELS: Array<{ test: RegExp; name: string }> = [
  { test: /^gps$/i, name: 'GPS' },
  { test: /^glonass$/i, name: 'GLONASS' },
  { test: /^galileo$/i, name: 'Galileo' },
  { test: /^beidou$/i, name: 'BeiDou' },
  { test: /^qzss$/i, name: 'QZSS' },
  { test: /^irnss$/i, name: 'IRNSS' },
  { test: /^multi-?frequenz empfang$/i, name: 'Multi-Frequenz' },
  { test: /^satiq™?-technologie$/i, name: 'SatIQ' },
];

/** Sensor rows are marker rows in Garmin's own `Sensoren` section. */
export const SENSOR_SECTION = /^sensoren$/i;

export function matchField(label: string): FieldMapping[] {
  const clean = cleanLabel(label);
  return FIELD_MAP.filter((mapping) => mapping.labels.some((pattern) => pattern.test(clean)));
}
