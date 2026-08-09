import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * URL-as-state (task 7.2).
 *
 * Search, filters, sort, comparison selection, and differences-only all live in
 * the query string, so any view is restorable and shareable by copying its URL
 * (`catalog-browse` and `watch-comparison` both require it). Nothing here is
 * duplicated into component state — the URL is the single source of truth.
 */

export const MAX_COMPARE = 4;

export interface RangeFilter {
  min?: number;
  max?: number;
}

export interface CatalogState {
  query: string;
  families: string[];
  /** Field id → chosen text values, for the enum-ish text facets. */
  texts: Record<string, string[]>;
  /** Field id → numeric range, for price / size / weight / battery / water. */
  ranges: Record<string, RangeFilter>;
  /** Field ids that must be `supported`. */
  flags: string[];
  favouritesOnly: boolean;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  selection: string[];
  differencesOnly: boolean;
}

const LIST_SEPARATOR = '~';

function parseList(raw: string | null): string[] {
  return raw ? raw.split(LIST_SEPARATOR).filter(Boolean) : [];
}

function parseRange(raw: string | null): RangeFilter | null {
  if (!raw) return null;
  const [min, max] = raw.split(':');
  const range: RangeFilter = {};
  if (min !== '' && min !== undefined && Number.isFinite(Number(min))) range.min = Number(min);
  if (max !== '' && max !== undefined && Number.isFinite(Number(max))) range.max = Number(max);
  return range.min === undefined && range.max === undefined ? null : range;
}

function serialiseRange(range: RangeFilter): string {
  return `${range.min ?? ''}:${range.max ?? ''}`;
}

const RANGE_PREFIX = 'r.';
const TEXT_PREFIX = 't.';

export function readState(params: URLSearchParams): CatalogState {
  const ranges: Record<string, RangeFilter> = {};
  const texts: Record<string, string[]> = {};
  for (const [key, raw] of params.entries()) {
    if (key.startsWith(RANGE_PREFIX)) {
      const range = parseRange(raw);
      if (range) ranges[key.slice(RANGE_PREFIX.length)] = range;
    } else if (key.startsWith(TEXT_PREFIX)) {
      const values = parseList(raw);
      if (values.length > 0) texts[key.slice(TEXT_PREFIX.length)] = values;
    }
  }
  const sort = params.get('sort') ?? 'name:asc';
  const [sortField, sortDirection] = sort.split(':');

  return {
    query: params.get('q') ?? '',
    families: parseList(params.get('family')),
    texts,
    ranges,
    flags: parseList(params.get('flags')),
    favouritesOnly: params.get('fav') === '1',
    sortField: sortField || 'name',
    sortDirection: sortDirection === 'desc' ? 'desc' : 'asc',
    selection: parseList(params.get('sel')),
    differencesOnly: params.get('diff') === '1',
  };
}

function writeState(state: CatalogState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.families.length) params.set('family', state.families.join(LIST_SEPARATOR));
  for (const [field, values] of Object.entries(state.texts)) {
    if (values.length) params.set(`${TEXT_PREFIX}${field}`, values.join(LIST_SEPARATOR));
  }
  for (const [field, range] of Object.entries(state.ranges)) {
    if (range.min !== undefined || range.max !== undefined) {
      params.set(`${RANGE_PREFIX}${field}`, serialiseRange(range));
    }
  }
  if (state.flags.length) params.set('flags', state.flags.join(LIST_SEPARATOR));
  if (state.favouritesOnly) params.set('fav', '1');
  if (state.sortField !== 'name' || state.sortDirection !== 'asc') {
    params.set('sort', `${state.sortField}:${state.sortDirection}`);
  }
  if (state.selection.length) params.set('sel', state.selection.join(LIST_SEPARATOR));
  if (state.differencesOnly) params.set('diff', '1');
  return params;
}

export interface CatalogStateApi {
  state: CatalogState;
  update: (patch: Partial<CatalogState>) => void;
  toggleFamily: (family: string) => void;
  toggleFlag: (field: string) => void;
  toggleText: (field: string, value: string) => void;
  setRange: (field: string, range: RangeFilter | null) => void;
  toggleSelection: (id: string) => 'added' | 'removed' | 'refused';
  clearFilters: () => void;
  clearFilter: (kind: 'query' | 'family' | 'flag' | 'text' | 'range' | 'favourites', key?: string, value?: string) => void;
  activeFilterCount: number;
  /** Keeps the query string when moving between routes. */
  search: string;
}

export function useCatalogState(): CatalogStateApi {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => readState(params), [params]);

  const commit = useCallback(
    (next: CatalogState) => setParams(writeState(next), { replace: false }),
    [setParams],
  );

  const update = useCallback(
    (patch: Partial<CatalogState>) => commit({ ...state, ...patch }),
    [commit, state],
  );

  const toggleIn = (list: string[], item: string) =>
    list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];

  const api: CatalogStateApi = {
    state,
    update,
    toggleFamily: (family) => update({ families: toggleIn(state.families, family) }),
    toggleFlag: (field) => update({ flags: toggleIn(state.flags, field) }),
    toggleText: (field, value) => {
      const current = state.texts[field] ?? [];
      const next = toggleIn(current, value);
      const texts = { ...state.texts };
      if (next.length) texts[field] = next;
      else delete texts[field];
      update({ texts });
    },
    setRange: (field, range) => {
      const ranges = { ...state.ranges };
      if (range && (range.min !== undefined || range.max !== undefined)) ranges[field] = range;
      else delete ranges[field];
      update({ ranges });
    },
    toggleSelection: (id) => {
      if (state.selection.includes(id)) {
        update({ selection: state.selection.filter((entry) => entry !== id) });
        return 'removed';
      }
      if (state.selection.length >= MAX_COMPARE) return 'refused';
      update({ selection: [...state.selection, id] });
      return 'added';
    },
    clearFilters: () =>
      update({
        query: '',
        families: [],
        texts: {},
        ranges: {},
        flags: [],
        favouritesOnly: false,
      }),
    clearFilter: (kind, key, value) => {
      switch (kind) {
        case 'query':
          return update({ query: '' });
        case 'favourites':
          return update({ favouritesOnly: false });
        case 'family':
          return update({ families: state.families.filter((f) => f !== key) });
        case 'flag':
          return update({ flags: state.flags.filter((f) => f !== key) });
        case 'range': {
          const ranges = { ...state.ranges };
          if (key) delete ranges[key];
          return update({ ranges });
        }
        case 'text': {
          const texts = { ...state.texts };
          if (key) {
            const next = (texts[key] ?? []).filter((entry) => entry !== value);
            if (next.length) texts[key] = next;
            else delete texts[key];
          }
          return update({ texts });
        }
      }
    },
    activeFilterCount:
      (state.query ? 1 : 0) +
      state.families.length +
      state.flags.length +
      Object.values(state.texts).reduce((sum, values) => sum + values.length, 0) +
      Object.keys(state.ranges).length +
      (state.favouritesOnly ? 1 : 0),
    search: params.toString() ? `?${params.toString()}` : '',
  };

  return api;
}
