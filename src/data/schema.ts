/**
 * The comparison schema (task 5.1).
 *
 * These descriptors are the single source of truth for *which* normalized fields
 * exist. The normalizer guarantees every id here is present on every model — as a
 * value or explicitly `not-published` — and the UI renders comparison rows,
 * filters, and the heatmap by walking this list rather than hard-coding fields.
 *
 * `better` is set only where the direction is unambiguous. A row without it is
 * never marked with a "winner" in the comparison view (`watch-comparison` —
 * best value marked).
 */

import type { NormalizedValue } from './contract';

export type FieldKind =
  | 'number'
  | 'dimensions'
  | 'resolution'
  | 'battery'
  | 'water'
  | 'text'
  | 'list'
  | 'flag';

export const SPEC_SECTIONS = [
  'Gehäuse & Display',
  'Akku & Energie',
  'Navigation & Sensoren',
  'Konnektivität',
  'Musik, Bezahlen & Karten',
  'Gesundheit & Training',
] as const;

export type SpecSection = (typeof SPEC_SECTIONS)[number];

export interface SpecField {
  id: string;
  /** German display label, matching the register Garmin's own spec table uses. */
  label: string;
  section: SpecSection;
  kind: FieldKind;
  unit?: string;
  /** Only where one direction is unambiguously better. */
  better?: 'higher' | 'lower';
  /** Shown in the detail view's summary block and on catalog cards. */
  headline?: boolean;
  /** Offered as a filter in the catalog rail. */
  facet?: boolean;
  /** Included in the feature-coverage heatmap (flags only). */
  heatmap?: boolean;
  /** One-line explanation surfaced as help text where the label is terse. */
  note?: string;
}

export const SPEC_FIELDS = [
  /* ---------------- Gehäuse & Display ---------------- */
  {
    id: 'caseDimensions',
    label: 'Physische Größe',
    section: 'Gehäuse & Display',
    kind: 'dimensions',
    headline: true,
  },
  {
    id: 'caseSize',
    label: 'Gehäusedurchmesser',
    section: 'Gehäuse & Display',
    kind: 'number',
    unit: 'mm',
    facet: true,
    headline: true,
    note: 'Breite des Gehäuses aus der physischen Größe.',
  },
  {
    id: 'caseThickness',
    label: 'Gehäusedicke',
    section: 'Gehäuse & Display',
    kind: 'number',
    unit: 'mm',
    better: 'lower',
  },
  {
    id: 'weight',
    label: 'Gewicht',
    section: 'Gehäuse & Display',
    kind: 'number',
    unit: 'g',
    better: 'lower',
    facet: true,
    headline: true,
  },
  {
    id: 'wristRange',
    label: 'Handgelenkumfang',
    section: 'Gehäuse & Display',
    kind: 'text',
  },
  {
    id: 'displayType',
    label: 'Displaytyp',
    section: 'Gehäuse & Display',
    kind: 'text',
    facet: true,
    headline: true,
  },
  {
    id: 'displaySize',
    label: 'Anzeigegröße',
    section: 'Gehäuse & Display',
    kind: 'number',
    unit: 'mm',
    better: 'higher',
  },
  {
    id: 'displayResolution',
    label: 'Anzeigeauflösung',
    section: 'Gehäuse & Display',
    kind: 'resolution',
    headline: true,
  },
  {
    id: 'touchscreen',
    label: 'Touchdisplay',
    section: 'Gehäuse & Display',
    kind: 'flag',
    facet: true,
    heatmap: true,
    headline: true,
  },
  {
    id: 'colorDisplay',
    label: 'Farbdisplay',
    section: 'Gehäuse & Display',
    kind: 'flag',
    heatmap: true,
  },
  { id: 'lensMaterial', label: 'Displayglas', section: 'Gehäuse & Display', kind: 'text', facet: true },
  { id: 'bezelMaterial', label: 'Material der Lünette', section: 'Gehäuse & Display', kind: 'text' },
  { id: 'caseMaterial', label: 'Gehäusematerial', section: 'Gehäuse & Display', kind: 'text' },
  { id: 'bandMaterial', label: 'Armbandmaterial', section: 'Gehäuse & Display', kind: 'text' },
  {
    id: 'bandWidth',
    label: 'Armbandbreite',
    section: 'Gehäuse & Display',
    kind: 'number',
    unit: 'mm',
  },
  {
    id: 'waterRating',
    label: 'Wasserdichtigkeit',
    section: 'Gehäuse & Display',
    kind: 'water',
    better: 'higher',
    facet: true,
    headline: true,
  },

  /* ---------------- Akku & Energie ---------------- */
  { id: 'battery', label: 'Akkulaufzeit (alle Modi)', section: 'Akku & Energie', kind: 'battery', headline: true },
  {
    id: 'batterySmartwatchHours',
    label: 'Akku im Smartwatch-Modus',
    section: 'Akku & Energie',
    kind: 'number',
    unit: 'h',
    better: 'higher',
    facet: true,
    headline: true,
  },
  {
    id: 'batteryGpsHours',
    label: 'Akku im GPS-Modus',
    section: 'Akku & Energie',
    kind: 'number',
    unit: 'h',
    better: 'higher',
    headline: true,
  },
  {
    id: 'solarCharging',
    label: 'Solarladung',
    section: 'Akku & Energie',
    kind: 'flag',
    facet: true,
    heatmap: true,
  },
  {
    id: 'ultraTrac',
    label: 'UltraTrac-Modus',
    section: 'Akku & Energie',
    kind: 'flag',
    heatmap: true,
  },
  { id: 'charging', label: 'Ladeverfahren', section: 'Akku & Energie', kind: 'text' },
  { id: 'batteryType', label: 'Batterietyp', section: 'Akku & Energie', kind: 'text' },
  {
    id: 'memory',
    label: 'Speicher',
    section: 'Akku & Energie',
    kind: 'number',
    unit: 'GB',
    better: 'higher',
    headline: true,
  },

  /* ---------------- Navigation & Sensoren ---------------- */
  {
    id: 'gnssMultiband',
    label: 'Multi-Frequenz Empfang',
    section: 'Navigation & Sensoren',
    kind: 'flag',
    facet: true,
    heatmap: true,
    headline: true,
  },
  { id: 'gnssSystems', label: 'Satellitensysteme', section: 'Navigation & Sensoren', kind: 'list' },
  { id: 'satIq', label: 'SatIQ-Technologie', section: 'Navigation & Sensoren', kind: 'flag', heatmap: true },
  { id: 'sensors', label: 'Sensoren', section: 'Navigation & Sensoren', kind: 'list' },
  {
    id: 'barometricAltimeter',
    label: 'Barometrischer Höhenmesser',
    section: 'Navigation & Sensoren',
    kind: 'flag',
    heatmap: true,
  },
  { id: 'compass', label: 'Kompass', section: 'Navigation & Sensoren', kind: 'flag', heatmap: true },
  { id: 'gyroscope', label: 'Gyroskop', section: 'Navigation & Sensoren', kind: 'flag', heatmap: true },
  { id: 'thermometer', label: 'Thermometer', section: 'Navigation & Sensoren', kind: 'flag', heatmap: true },

  /* ---------------- Konnektivität ---------------- */
  { id: 'connectivity', label: 'Konnektivität', section: 'Konnektivität', kind: 'list', headline: true },
  { id: 'wifi', label: 'WLAN', section: 'Konnektivität', kind: 'flag', heatmap: true },
  {
    id: 'speakerMic',
    label: 'Lautsprecher und Mikrofon',
    section: 'Konnektivität',
    kind: 'flag',
    heatmap: true,
  },
  { id: 'voiceAssistant', label: 'Sprachassistent', section: 'Konnektivität', kind: 'flag', heatmap: true },
  {
    id: 'lte',
    label: 'LTE-Kommunikation',
    section: 'Konnektivität',
    kind: 'flag',
    facet: true,
    heatmap: true,
  },
  {
    id: 'satelliteMessaging',
    label: 'Satelliten-Kommunikation',
    section: 'Konnektivität',
    kind: 'flag',
    facet: true,
    heatmap: true,
  },
  { id: 'smartNotifications', label: 'Smart Notifications', section: 'Konnektivität', kind: 'flag', heatmap: true },
  {
    id: 'messengerApp',
    label: 'Garmin Messenger-App',
    section: 'Konnektivität',
    kind: 'flag',
    heatmap: true,
  },

  /* ---------------- Musik, Bezahlen & Karten ---------------- */
  {
    id: 'musicStorage',
    label: 'Musikspeicher',
    section: 'Musik, Bezahlen & Karten',
    kind: 'flag',
    facet: true,
    heatmap: true,
    headline: true,
  },
  {
    id: 'musicPlayback',
    label: 'Musikwiedergabe',
    section: 'Musik, Bezahlen & Karten',
    kind: 'flag',
    heatmap: true,
  },
  {
    id: 'garminPay',
    label: 'Garmin Pay',
    section: 'Musik, Bezahlen & Karten',
    kind: 'flag',
    facet: true,
    heatmap: true,
    headline: true,
  },
  {
    id: 'preloadedMaps',
    label: 'Vorinstallierte Karten',
    section: 'Musik, Bezahlen & Karten',
    kind: 'flag',
    facet: true,
    heatmap: true,
    headline: true,
  },
  {
    id: 'downloadableMaps',
    label: 'Herunterladbare Karten',
    section: 'Musik, Bezahlen & Karten',
    kind: 'flag',
    heatmap: true,
  },
  {
    id: 'pointToPointNavigation',
    label: 'Punkt-zu-Punkt-Navigation',
    section: 'Musik, Bezahlen & Karten',
    kind: 'flag',
    heatmap: true,
  },
  {
    id: 'ledFlashlight',
    label: 'LED-Taschenlampe',
    section: 'Musik, Bezahlen & Karten',
    kind: 'flag',
    facet: true,
    heatmap: true,
    headline: true,
  },
  {
    id: 'tracBack',
    label: 'TracBack',
    section: 'Musik, Bezahlen & Karten',
    kind: 'flag',
    heatmap: true,
  },
  {
    id: 'elevationProfile',
    label: 'Zukünftiges Höhenprofil',
    section: 'Musik, Bezahlen & Karten',
    kind: 'flag',
    heatmap: true,
  },
  { id: 'connectIq', label: 'Connect IQ', section: 'Musik, Bezahlen & Karten', kind: 'flag', heatmap: true },

  /* ---------------- Gesundheit & Training ---------------- */
  { id: 'wristHeartRate', label: 'Herzfrequenz am Handgelenk', section: 'Gesundheit & Training', kind: 'flag', heatmap: true },
  { id: 'pulseOx', label: 'Pulse Ox', section: 'Gesundheit & Training', kind: 'flag', heatmap: true },
  { id: 'ecgApp', label: 'EKG-App', section: 'Gesundheit & Training', kind: 'flag', heatmap: true },
  { id: 'sleepScore', label: 'Sleep Score', section: 'Gesundheit & Training', kind: 'flag', heatmap: true },
  { id: 'bodyBattery', label: 'Body Battery', section: 'Gesundheit & Training', kind: 'flag', heatmap: true },
  { id: 'hrvStatus', label: 'HFV Status', section: 'Gesundheit & Training', kind: 'flag', heatmap: true },
  {
    id: 'trainingReadiness',
    label: 'Trainingsbereitschaft',
    section: 'Gesundheit & Training',
    kind: 'flag',
    heatmap: true,
  },
  { id: 'vo2max', label: 'VO2max', section: 'Gesundheit & Training', kind: 'flag', heatmap: true },
  {
    id: 'healthSnapshot',
    label: 'Health Snapshot',
    section: 'Gesundheit & Training',
    kind: 'flag',
    heatmap: true,
  },
  {
    id: 'womensHealth',
    label: 'Frauengesundheit',
    section: 'Gesundheit & Training',
    kind: 'flag',
    heatmap: true,
  },
  { id: 'stressTracking', label: 'Stresslevelmessung', section: 'Gesundheit & Training', kind: 'flag', heatmap: true },
  { id: 'sleepCoach', label: 'Schlafcoach', section: 'Gesundheit & Training', kind: 'flag', heatmap: true },
  {
    id: 'trainingLoad',
    label: 'Trainingsbelastung',
    section: 'Gesundheit & Training',
    kind: 'flag',
    heatmap: true,
  },
  {
    id: 'runningDynamics',
    label: 'Laufeffizienzdaten',
    section: 'Gesundheit & Training',
    kind: 'flag',
    heatmap: true,
    note: 'Bodenkontaktzeit und deren Balance.',
  },
  { id: 'pacePro', label: 'PacePro', section: 'Gesundheit & Training', kind: 'flag', heatmap: true },
] as const satisfies readonly SpecField[];

export type SpecFieldId = (typeof SPEC_FIELDS)[number]['id'];

/**
 * The same list, widened to `SpecField`. `SPEC_FIELDS` is `as const` so field ids
 * stay a literal union for the field map; consumers that only render fields want
 * the uniform shape, with `unit`/`better` present-but-optional.
 */
export const FIELDS: readonly SpecField[] = SPEC_FIELDS;

export const FIELD_BY_ID = new Map<string, SpecField>(SPEC_FIELDS.map((f) => [f.id, f]));

export const FIELD_IDS: SpecFieldId[] = SPEC_FIELDS.map((f) => f.id);

export const HEADLINE_FIELDS: readonly SpecField[] = FIELDS.filter((f) => f.headline);
export const FACET_FIELDS: readonly SpecField[] = FIELDS.filter((f) => f.facet);
export const HEATMAP_FIELDS: readonly SpecField[] = FIELDS.filter((f) => f.heatmap);

export function fieldsInSection(section: SpecSection): SpecField[] {
  return FIELDS.filter((f) => f.section === section);
}

/** Formats a normalized value for display. Used by every view, so it lives here. */
export function formatValue(field: SpecField, value: NormalizedValue | undefined): string {
  if (!value || value.kind === 'not-published') return 'keine Angabe';
  switch (value.kind) {
    case 'flag':
      return value.state === 'supported'
        ? value.qualifier
          ? `Ja (${value.qualifier})`
          : 'Ja'
        : 'Nein';
    case 'number': {
      // Storage is normalized to GB so it sorts, but a 128 MB watch should not
      // read as "0,125 GB".
      if (field.unit === 'GB' && value.value < 1) {
        return `${formatNumber(value.value * 1024)} MB`;
      }
      const number = formatNumber(value.value);
      const unit = field.unit ? ` ${field.unit}` : '';
      const prefix = value.bound === 'up-to' ? 'bis zu ' : value.bound === 'at-least' ? 'ab ' : '';
      if (value.bound === 'range' && typeof value.max === 'number') {
        return `${number}–${formatNumber(value.max)}${unit}`;
      }
      return `${prefix}${number}${unit}`;
    }
    case 'dimensions': {
      const { widthMm, heightMm, thicknessMm } = value.value;
      const base = `${formatNumber(widthMm)} × ${formatNumber(heightMm)}`;
      return thicknessMm === null ? `${base} mm` : `${base} × ${formatNumber(thicknessMm)} mm`;
    }
    case 'resolution':
      return `${value.value.width} × ${value.value.height} Pixel`;
    case 'water':
      return value.value.label;
    case 'battery': {
      const smartwatch = value.modes.find((m) => m.role === 'smartwatch');
      return smartwatch
        ? `${formatNumber(smartwatch.hours / 24)} Tage (Smartwatch)`
        : `${value.modes.length} Modi`;
    }
    case 'text':
      return value.text;
    case 'list':
      return value.items.join(', ');
  }
}

/** German formatting: decimal comma, no trailing zeros. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value);
}
