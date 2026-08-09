import { useMemo, useState } from 'react';
import { useCatalog } from '../app/CatalogProvider';
import { useCatalogState } from '../app/state';
import { useFavourites } from '../app/favourites';
import { FilterRail } from '../components/FilterRail';
import { ModelCard } from '../components/ModelCard';
import { Chip } from '../components/ui';
import { describeFilter, filterModels, sortModels } from '../lib/catalog';

/**
 * The catalog overview (`catalog-browse`).
 *
 * Search, filters and sort all read from and write to the URL, so the view is
 * shareable and restorable; the rail collapses into a sheet on narrow viewports.
 */

const SORTS: Array<{ field: string; label: string }> = [
  { field: 'name', label: 'Name' },
  { field: 'price', label: 'Preis' },
  { field: 'batterySmartwatchHours', label: 'Akkulaufzeit' },
  { field: 'weight', label: 'Gewicht' },
  { field: 'caseSize', label: 'Gehäusegröße' },
  { field: 'generation', label: 'Generation' },
];

export function CatalogRoute() {
  const { catalog, families } = useCatalog();
  const { state, update, clearFilters, clearFilter, activeFilterCount } = useCatalogState();
  const { favourites, toggle, isFavourite } = useFavourites();
  const [railOpen, setRailOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const models = catalog?.models ?? [];
  const context = useMemo(() => ({ favourites }), [favourites]);

  const visible = useMemo(() => {
    const filtered = filterModels(models, state, context);
    return sortModels(filtered, state.sortField, state.sortDirection);
  }, [models, state, context]);

  const chips: Array<{ kind: string; key: string; value?: string }> = [
    ...(state.query ? [{ kind: 'query', key: 'query', value: state.query }] : []),
    ...(state.favouritesOnly ? [{ kind: 'favourites', key: 'favourites' }] : []),
    ...state.families.map((family) => ({ kind: 'family', key: family })),
    ...Object.entries(state.texts).flatMap(([field, values]) =>
      values.map((value) => ({ kind: 'text', key: field, value })),
    ),
    ...Object.keys(state.ranges).map((field) => ({ kind: 'range', key: field })),
    ...state.flags.map((field) => ({ kind: 'flag', key: field })),
  ];

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex-1 min-w-[220px]">
          <span className="sr-only">Modelle durchsuchen</span>
          <input
            type="search"
            value={state.query}
            onChange={(event) => update({ query: event.target.value })}
            placeholder="Suche nach Name, Familie oder Teilenummer (z. B. fenix, 010-02969-10)"
            className="w-full border border-rule bg-panel px-3 py-2 text-sm"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Sortierung</span>
          <select
            value={state.sortField}
            onChange={(event) => update({ sortField: event.target.value })}
            className="border border-rule bg-panel px-2 py-2 text-sm"
          >
            {SORTS.map((sort) => (
              <option key={sort.field} value={sort.field}>
                {sort.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => update({ sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc' })}
            className="border border-rule px-2 py-2 text-xs text-ink-muted hover:text-ink"
            aria-label={`Sortierrichtung: ${state.sortDirection === 'asc' ? 'aufsteigend' : 'absteigend'}. Umschalten.`}
          >
            {state.sortDirection === 'asc' ? '↑ aufsteigend' : '↓ absteigend'}
          </button>
        </label>

        <button
          type="button"
          onClick={() => setRailOpen(true)}
          className="border border-rule px-3 py-2 text-sm lg:hidden"
          aria-expanded={railOpen}
        >
          Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <Chip
              key={`${chip.kind}:${chip.key}:${chip.value ?? ''}`}
              onRemove={() =>
                clearFilter(chip.kind as Parameters<typeof clearFilter>[0], chip.key, chip.value)
              }
              removeLabel={`${describeFilter(chip.kind, chip.key, chip.value)} entfernen`}
            >
              {describeFilter(chip.kind, chip.key, chip.value)}
            </Chip>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-accent underline underline-offset-2"
          >
            alle entfernen
          </button>
        </div>
      )}

      {notice && (
        <p role="status" className="mt-3 border border-mark bg-[var(--mark-wash)] px-3 py-2 text-sm">
          {notice}{' '}
          <button type="button" className="underline" onClick={() => setNotice(null)}>
            verstanden
          </button>
        </p>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Desktop rail */}
        <aside className="hidden lg:block">
          <FilterRail models={models} families={families} context={context} />
        </aside>

        {/* Mobile sheet */}
        {railOpen && (
          <div className="fixed inset-0 z-30 flex lg:hidden">
            <div
              className="flex-1 bg-black/40"
              onClick={() => setRailOpen(false)}
              aria-hidden="true"
            />
            <div className="w-[85vw] max-w-sm overflow-y-auto border-l border-rule-strong bg-page p-4">
              <button
                type="button"
                onClick={() => setRailOpen(false)}
                className="mb-2 border border-rule px-2 py-1 text-xs"
              >
                Schließen
              </button>
              <FilterRail models={models} families={families} context={context} />
            </div>
          </div>
        )}

        <section aria-label="Modelle">
          <p className="mb-3 text-sm text-ink-muted">
            <span className="num text-ink">{visible.length}</span> von{' '}
            <span className="num">{models.length}</span> Modellen
            {catalog && (
              <>
                {' '}
                · Preise mit Stand{' '}
                <span className="num">
                  {new Date(catalog.meta.generatedAt).toLocaleDateString('de-DE')}
                </span>
              </>
            )}
          </p>

          {visible.length === 0 ? (
            <div className="panel p-6">
              <h2 className="display text-base">Keine Modelle für diese Filter</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Aktiv sind:{' '}
                {chips.map((chip) => describeFilter(chip.kind, chip.key, chip.value)).join(' · ')}
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 border border-accent bg-accent px-3 py-1 text-sm text-[var(--accent-ink)]"
              >
                Filter zurücksetzen
              </button>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visible.map((model) => (
                <li key={model.id} className="contents">
                  <ModelCard
                    model={model}
                    isFavourite={isFavourite(model.id)}
                    onToggleFavourite={() => toggle(model.id)}
                    onRefused={setNotice}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
