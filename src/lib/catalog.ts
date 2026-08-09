import type { CatalogModel, NormalizedValue, SpecValue } from '../data/contract';
import { triState } from '../data/contract';
import { FIELD_BY_ID } from '../data/schema';
import type { CatalogState } from '../app/state';

/**
 * Filtering, searching and sorting over the normalized catalog.
 *
 * Shared by the browse view and the charts, which is what makes "charts respect
 * the active filters" (`spec-visualization`) true by construction rather than by
 * remembering to reapply them.
 */

/** Diacritic- and case-insensitive: `fenix` has to match `fēnix`. */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00a0\u202f\u2009]/g, ' ')
    .toLowerCase();
}

/** The comparable number behind a field, or null when there is nothing to compare. */
export function numericValue(model: CatalogModel, field: string): number | null {
  if (field === 'price') return model.price?.amount ?? null;
  if (field === 'name') return null;
  if (field === 'generation') return model.lineage.generationRank;

  const value: NormalizedValue | undefined = model.specs[field];
  if (!value) return null;
  switch (value.kind) {
    case 'number':
      return value.value;
    case 'water':
      return value.value.value;
    case 'dimensions':
      return value.value.widthMm;
    case 'resolution':
      return value.value.width * value.value.height;
    case 'battery': {
      const smartwatch = value.modes.find((mode) => mode.role === 'smartwatch');
      return smartwatch?.hours ?? null;
    }
    default:
      return null;
  }
}

export function textValue(model: CatalogModel, field: string): string | null {
  const value = model.specs[field];
  if (!value) return null;
  if (value.kind === 'text') return value.text;
  if (value.kind === 'water') return value.value.label;
  return null;
}

export function flagState(model: CatalogModel, field: string): SpecValue {
  return triState(model.specs[field]);
}

/**
 * Display types are published as free text (`AMOLED; optional Always-On Display`,
 * `Sonnenlichtlesbares, transflektives … (MIP)`). The facet buckets them by the
 * panel technology Garmin names, which is the distinction a buyer actually makes.
 */
export function displayBucket(model: CatalogModel): string | null {
  const text = textValue(model, 'displayType');
  if (!text) return null;
  if (/amoled/i.test(text)) return 'AMOLED';
  if (/microled/i.test(text)) return 'MicroLED';
  if (/mip|transflektiv|speicherstabil/i.test(text)) return 'MIP (transflektiv)';
  if (/lcd/i.test(text)) return 'LCD';
  return 'Sonstige';
}

export function waterBucket(model: CatalogModel): string | null {
  const value = model.specs.waterRating;
  if (!value || value.kind !== 'water') return null;
  if (value.value.standard === 'ATM' && value.value.value !== null) return `${value.value.value} ATM`;
  return value.value.label;
}

/** The facet accessor for text-ish facets that are bucketed rather than raw. */
export function facetValue(model: CatalogModel, field: string): string | null {
  if (field === 'displayType') return displayBucket(model);
  if (field === 'waterRating') return waterBucket(model);
  const text = textValue(model, field);
  return text;
}

export function searchHaystack(model: CatalogModel): string {
  return foldText(
    [model.name, model.lineage.family, model.lineage.generation ?? '', ...model.partNumbers].join(' '),
  );
}

export interface MatchContext {
  favourites: string[];
}

/** One predicate per filter kind, so a single filter can be skipped for counting. */
type Predicate = (model: CatalogModel) => boolean;

export interface NamedPredicate {
  /** Stable key identifying the filter, e.g. `family`, `flag:musicStorage`. */
  key: string;
  test: Predicate;
}

export function buildPredicates(state: CatalogState, context: MatchContext): NamedPredicate[] {
  const predicates: NamedPredicate[] = [];

  if (state.query.trim()) {
    const needle = foldText(state.query.trim());
    predicates.push({ key: 'query', test: (model) => searchHaystack(model).includes(needle) });
  }
  if (state.families.length) {
    predicates.push({
      key: 'family',
      test: (model) => state.families.includes(model.lineage.family),
    });
  }
  for (const [field, values] of Object.entries(state.texts)) {
    predicates.push({
      key: `text:${field}`,
      test: (model) => {
        const value = facetValue(model, field);
        return value !== null && values.includes(value);
      },
    });
  }
  for (const [field, range] of Object.entries(state.ranges)) {
    predicates.push({
      key: `range:${field}`,
      test: (model) => {
        const value = numericValue(model, field);
        if (value === null) return false;
        if (range.min !== undefined && value < range.min) return false;
        if (range.max !== undefined && value > range.max) return false;
        return true;
      },
    });
  }
  for (const field of state.flags) {
    predicates.push({
      key: `flag:${field}`,
      test: (model) => flagState(model, field) === 'supported',
    });
  }
  if (state.favouritesOnly) {
    predicates.push({ key: 'favourites', test: (model) => context.favourites.includes(model.id) });
  }
  return predicates;
}

export function filterModels(
  models: CatalogModel[],
  state: CatalogState,
  context: MatchContext,
  exceptKey?: string,
): CatalogModel[] {
  const predicates = buildPredicates(state, context).filter((p) => p.key !== exceptKey);
  return models.filter((model) => predicates.every((p) => p.test(model)));
}

/**
 * Sorting (`catalog-browse` — sort applied). Models with no value for the sort
 * field are grouped at the end in both directions; treating a missing figure as
 * zero would rank a watch that publishes nothing as the lightest on the list.
 */
export function sortModels(
  models: CatalogModel[],
  field: string,
  direction: 'asc' | 'desc',
): CatalogModel[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...models].sort((a, b) => {
    if (field === 'name') return sign * a.name.localeCompare(b.name, 'de');

    const left = numericValue(a, field);
    const right = numericValue(b, field);
    if (left === null && right === null) return a.name.localeCompare(b.name, 'de');
    if (left === null) return 1;
    if (right === null) return -1;
    if (left === right) return a.name.localeCompare(b.name, 'de');
    return sign * (left - right);
  });
}

export interface FacetOption {
  value: string;
  count: number;
  active: boolean;
}

/**
 * Option counts (`catalog-browse` — filter option counts): each option is counted
 * against every *other* active filter, so the numbers say what would happen if
 * this option were toggled, not what is already on screen.
 */
export function facetOptions(
  models: CatalogModel[],
  state: CatalogState,
  context: MatchContext,
  field: string,
  accessor: (model: CatalogModel) => string | null,
  key: string,
): FacetOption[] {
  const pool = filterModels(models, state, context, key);
  const counts = new Map<string, number>();
  for (const model of pool) {
    const value = accessor(model);
    if (value === null) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const selected = field === 'family' ? state.families : (state.texts[field] ?? []);
  for (const value of selected) if (!counts.has(value)) counts.set(value, 0);

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, active: selected.includes(value) }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'de'));
}

export function flagFacetCount(
  models: CatalogModel[],
  state: CatalogState,
  context: MatchContext,
  field: string,
): number {
  return filterModels(models, state, context, `flag:${field}`).filter(
    (model) => flagState(model, field) === 'supported',
  ).length;
}

/** Human label for a filter chip. */
export function describeFilter(kind: string, key: string, value?: string): string {
  switch (kind) {
    case 'query':
      return `Suche: „${value ?? ''}“`;
    case 'family':
      return `Familie: ${key}`;
    case 'flag':
      return FIELD_BY_ID.get(key)?.label ?? key;
    case 'text':
      return `${FIELD_BY_ID.get(key)?.label ?? key}: ${value ?? ''}`;
    case 'range':
      return FIELD_BY_ID.get(key)?.label ?? (key === 'price' ? 'Preis' : key);
    case 'favourites':
      return 'Nur Favoriten';
    default:
      return key;
  }
}

/** Capability measure for the price/value scatter — see design D8. */
export function supportedFlagCount(model: CatalogModel, fields: readonly { id: string }[]): number {
  return fields.filter((field) => flagState(model, field.id) === 'supported').length;
}
