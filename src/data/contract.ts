/**
 * The frozen data contract between the three pipeline stages and the site.
 *
 *   scripts/ingest    → RawProduct        (data/raw/products/<id>.json)
 *   scripts/normalize → CatalogModel      (data/catalog.json)
 *                     → ModelDetail       (data/models/<id>.json)
 *   src/              reads both, and nothing else
 *
 * Nothing in here may be widened without updating every stage: ingestion and UI
 * work is written against these shapes in parallel (design D9).
 */

/* ------------------------------------------------------------------ */
/* Tri-state                                                           */
/* ------------------------------------------------------------------ */

/**
 * The three states a specification can be in. Keeping `not-published` distinct
 * from `unsupported` end-to-end is the point: collapsing them would tell the
 * reader a watch lacks a feature when Garmin simply printed nothing (design D10
 * risk note). It is never reconstructed in the UI from an empty string.
 */
export type SpecValue = 'supported' | 'unsupported' | 'not-published';

/* ------------------------------------------------------------------ */
/* Value primitives                                                    */
/* ------------------------------------------------------------------ */

/** How a published number relates to reality — `bis zu 14 Tage` is an upper bound. */
export type BoundKind = 'exact' | 'up-to' | 'at-least' | 'approx' | 'range';

export interface Dimensions {
  /** Millimetres. For round cases width and height are equal. */
  widthMm: number;
  heightMm: number;
  thicknessMm: number | null;
}

export interface Resolution {
  width: number;
  height: number;
}

export interface BatteryMode {
  /** Stable slug derived from the label, used as a chart/series key. */
  id: string;
  /** Garmin's own German mode name, verbatim. */
  label: string;
  /**
   * The two roles the specs and charts need to address directly
   * (`spec-normalization` — battery modes parsed); everything else stays `other`
   * and is still carried with its label.
   */
  role: 'smartwatch' | 'gps-only' | 'gps-music' | 'battery-saver' | 'expedition' | 'other';
  hours: number;
  bound: BoundKind;
  /** True when the figure is Garmin's solar-assisted variant of the mode. */
  solar: boolean;
  sourceText: string;
}

export interface WaterRating {
  /** `5 ATM`, `10 ATM`, `EN 13319`, … */
  label: string;
  standard: 'ATM' | 'WR' | 'EN13319' | 'IPX' | 'other';
  /** Numeric magnitude where the standard has one (ATM/WR metres), else null. */
  value: number | null;
}

export interface Price {
  amount: number;
  /** ISO 4217, e.g. `EUR`. */
  currency: string;
  /** Garmin's own formatted string, kept for display fidelity. */
  formatted: string;
}

/* ------------------------------------------------------------------ */
/* Normalized values                                                   */
/* ------------------------------------------------------------------ */

/**
 * One normalized field's value. `not-published` is a first-class member, so a
 * field is always present on every model even when Garmin says nothing
 * (`spec-normalization` — every model exposes the schema).
 *
 * `source` always holds the raw text the value was parsed from, so the original
 * wording stays retrievable (`spec-normalization` — ranges preserved).
 */
export type NormalizedValue =
  | { kind: 'not-published' }
  | { kind: 'flag'; state: 'supported' | 'unsupported'; qualifier?: string; source: string }
  | { kind: 'number'; value: number; unit: string; bound: BoundKind; max?: number; source: string }
  | { kind: 'dimensions'; value: Dimensions; source: string }
  | { kind: 'resolution'; value: Resolution; source: string }
  | { kind: 'battery'; modes: BatteryMode[]; source: string }
  | { kind: 'water'; value: WaterRating; source: string }
  | { kind: 'text'; text: string; source: string }
  | { kind: 'list'; items: string[]; source: string };

export const NOT_PUBLISHED: NormalizedValue = { kind: 'not-published' };

/** The tri-state a value renders as. The only place the collapse could happen. */
export function triState(value: NormalizedValue | undefined): SpecValue {
  if (!value || value.kind === 'not-published') return 'not-published';
  if (value.kind === 'flag') return value.state;
  return 'supported';
}

export function isPublished(value: NormalizedValue | undefined): boolean {
  return !!value && value.kind !== 'not-published';
}

/** Field ids are declared by `src/data/schema.ts`; the contract stays open here. */
export type FieldId = string;

/** Every field id declared in the schema is present on every model. */
export type NormalizedSpecs = Record<FieldId, NormalizedValue>;

/* ------------------------------------------------------------------ */
/* Models                                                              */
/* ------------------------------------------------------------------ */

export interface Variant {
  /** Garmin SKU / product id of the variant. */
  sku: string;
  partNumber: string;
  /** Colour / case / band name as published, e.g. `Schiefergrau mit schwarzem Armband`. */
  name: string;
  price: Price | null;
  /** Local paths under `/img/…`; never a remote URL (`catalog-ingestion` — localised images). */
  images: string[];
}

export interface ModelLineage {
  /** `Forerunner`, `fēnix`, `Instinct`, … */
  family: string;
  /** Generation or series designation as Garmin writes it, e.g. `965`, `8`, `2X`. */
  generation: string | null;
  /**
   * Rank within the family used to order the generation ladder. Null when it
   * cannot be derived from Garmin's data — such models are shown unordered
   * rather than at a guessed position (`spec-visualization` — ungradeable).
   */
  generationRank: number | null;
  /** `Music`, `Solar`, `47 mm`, `Sapphire`, … — kept separate from the generation. */
  qualifier: string | null;
}

/** A row of `data/catalog.json` — normalized fields only, loaded on boot (design D5). */
export interface CatalogModel {
  /** Stable across re-runs: Garmin's own product id (`spec-normalization` — stable ids). */
  id: string;
  name: string;
  lineage: ModelLineage;
  price: Price | null;
  /** Local path to the card image, or null when no image was captured. */
  image: string | null;
  /** Every Garmin category the product was enumerated from. */
  categories: string[];
  /** Part numbers of all captured SKUs, so search can match on them. */
  partNumbers: string[];
  variantCount: number;
  specs: NormalizedSpecs;
  /** Canonical garmin.com page this model was derived from. */
  sourceUrl: string;
  /** ISO timestamp at which this model's page was fetched. */
  fetchedAt: string;
}

/** `data/models/<id>.json` — the heavy part, fetched only when a detail view opens. */
export interface ModelDetail {
  id: string;
  name: string;
  lineage: ModelLineage;
  price: Price | null;
  images: string[];
  variants: Variant[];
  boxContents: string[];
  /** Every row Garmin published, in source order, grouped as published. */
  rawSpecs: RawSpecRow[];
  specs: NormalizedSpecs;
  sourceUrl: string;
  fetchedAt: string;
  /** Images Garmin published that could not be downloaded (run report mirror). */
  missingImages: string[];
}

/* ------------------------------------------------------------------ */
/* Raw ingestion shapes                                                */
/* ------------------------------------------------------------------ */

/**
 * `marker-yes` / `marker-no` are Garmin's `class="yes"` / `class="no"` cells;
 * `text` is everything else. A row that is simply absent is neither — that is
 * what makes the tri-state derivable (design D3).
 */
export type SpecValueKind = 'text' | 'marker-yes' | 'marker-no';

export interface RawSpecRow {
  /** Section heading as published, e.g. `Allgemein`, `Uhrenfunktionen`. */
  section: string;
  label: string;
  /** Text content of the value cell; empty string for marker cells. */
  value: string;
  valueKind: SpecValueKind;
  /** Position in the source table, preserved for faithful re-rendering. */
  order: number;
}

/** `data/raw/products/<id>.json` — stage 1 output, stage 2 input. */
export interface RawProduct {
  id: string;
  name: string;
  sourceUrl: string;
  fetchedAt: string;
  locale: string;
  storeCode: string;
  categories: string[];
  price: Price | null;
  specs: RawSpecRow[];
  variants: Variant[];
  boxContents: string[];
  images: string[];
  missingImages?: string[];
  /** Short marketing description, if published. Never a source of spec values. */
  description?: string;
}

export interface RawCategory {
  categoryKey: string;
  url: string;
  name: string;
}

export interface ProductIndexEntry {
  id: string;
  name: string;
  url: string;
  imageUrl: string | null;
  partNumbers: string[];
  categories: string[];
  price: Price | null;
  /** Set when the product was enumerated but excluded, with the reason why. */
  excluded?: string;
}

/* ------------------------------------------------------------------ */
/* Snapshot metadata and reports                                       */
/* ------------------------------------------------------------------ */

export interface SnapshotMeta {
  /** ISO timestamp at which the normalize run completed. */
  generatedAt: string;
  /** ISO timestamp of the oldest page fetch in the snapshot. */
  oldestFetchAt: string | null;
  locale: string;
  storeCode: string;
  modelCount: number;
  variantCount: number;
  /** Origin hosts the data came from — displayed as provenance. */
  sources: string[];
}

export interface RunReportEntry {
  kind:
    | 'excluded'
    | 'discovery-gap'
    | 'image-failure'
    | 'unmapped-label'
    | 'sparse-field'
    | 'fetch-failure'
    | 'note';
  subject: string;
  detail: string;
}

export interface RunReport {
  stage: 'ingest' | 'images' | 'normalize';
  startedAt: string;
  finishedAt: string;
  entries: RunReportEntry[];
}
