import { Link } from 'react-router-dom';
import { useCatalog } from '../app/CatalogProvider';
import { MAX_COMPARE, useCatalogState } from '../app/state';

/**
 * The comparison selection, visible at all times while it is non-empty
 * (`catalog-browse` — selection visible). It survives filtering and route
 * changes because it lives in the URL, not in a component.
 */
export function SelectionBar() {
  const { state, toggleSelection, update, search } = useCatalogState();
  const { byId } = useCatalog();

  if (state.selection.length === 0) return null;

  const selected = state.selection.map((id) => ({ id, model: byId.get(id) }));

  return (
    <div className="sticky bottom-0 z-20 border-t border-rule-strong bg-panel">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
        <span className="text-xs text-ink-muted">
          Vergleich <span className="num">{state.selection.length}</span>/
          <span className="num">{MAX_COMPARE}</span>
        </span>
        <ul className="flex flex-wrap items-center gap-2">
          {selected.map(({ id, model }) => (
            <li key={id}>
              <span className="inline-flex items-center gap-1 border border-rule px-2 py-0.5 text-xs">
                {model?.name ?? id}
                <button
                  type="button"
                  onClick={() => toggleSelection(id)}
                  aria-label={`${model?.name ?? id} aus dem Vergleich entfernen`}
                  className="text-ink-muted hover:text-mark"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => update({ selection: [] })}
            className="border border-rule px-2 py-1 text-xs text-ink-muted hover:text-ink"
          >
            Auswahl leeren
          </button>
          <Link
            to={{ pathname: '/vergleich', search }}
            className="border border-accent bg-accent px-3 py-1 text-xs text-[var(--accent-ink)]"
          >
            Vergleichen
          </Link>
        </div>
      </div>
    </div>
  );
}
