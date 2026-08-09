import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../app/CatalogProvider';
import { useCatalogState } from '../app/state';
import { useFavourites } from '../app/favourites';
import { filterModels } from '../lib/catalog';
import { BatteryChart } from '../charts/BatteryChart';
import { PriceCapabilityChart } from '../charts/PriceCapabilityChart';
import { FeatureHeatmap } from '../charts/FeatureHeatmap';
import { SizeOverlay } from '../charts/SizeOverlay';
import { GenerationLadder } from '../charts/GenerationLadder';

/**
 * The analysis views (`spec-visualization`).
 *
 * Every chart is fed from the same filtered model set the catalog view uses, so
 * "the visualization covers only the filtered models" holds by construction
 * (task 11.8). The size overlay is the exception by design: it draws the
 * comparison selection, since an overlay of eighty cases would say nothing.
 */
export function ChartsRoute() {
  const { catalog, byId } = useCatalog();
  const { state, search, activeFilterCount, clearFilters } = useCatalogState();
  const { favourites } = useFavourites();

  const models = catalog?.models ?? [];
  const context = useMemo(() => ({ favourites }), [favourites]);
  const filtered = useMemo(() => filterModels(models, state, context), [models, state, context]);

  const selected = state.selection
    .map((id) => byId.get(id))
    .filter((model): model is NonNullable<typeof model> => !!model);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="display text-lg">Diagramme</h1>
        <p className="text-sm text-ink-muted">
          <span className="num text-ink">{filtered.length}</span> von{' '}
          <span className="num">{models.length}</span> Modellen
          {activeFilterCount > 0 ? ' (Katalogfilter aktiv)' : ' (keine Filter aktiv)'}
        </p>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-accent underline underline-offset-2"
          >
            Filter zurücksetzen
          </button>
        )}
        <Link
          to={{ pathname: '/', search }}
          className="ml-auto text-xs text-accent underline underline-offset-2"
        >
          Filter im Katalog ändern →
        </Link>
      </div>

      {filtered.length === 0 ? (
        <p className="panel mt-4 p-6 text-sm text-ink-muted">
          Die aktiven Filter treffen auf kein Modell zu, daher gibt es nichts zu zeichnen.
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          <SizeOverlay models={selected.length >= 1 ? selected : filtered.slice(0, 3)} />
          {selected.length === 0 && (
            <p className="-mt-4 text-xs text-ink-muted">
              Die Maßstabszeichnung zeigt die ersten drei gefilterten Modelle, solange nichts für
              den Vergleich ausgewählt ist.
            </p>
          )}
          <BatteryChart models={filtered} />
          <PriceCapabilityChart models={filtered} />
          <FeatureHeatmap models={filtered} />
          <GenerationLadder models={filtered} />
        </div>
      )}
    </div>
  );
}
