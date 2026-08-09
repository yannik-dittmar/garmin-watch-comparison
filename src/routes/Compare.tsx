import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../app/CatalogProvider';
import { MAX_COMPARE, useCatalogState } from '../app/state';
import { ModelImage, Price, SpecValueView } from '../components/ui';
import { FIELDS, SPEC_SECTIONS, type SpecField } from '../data/schema';
import type { CatalogModel, NormalizedValue } from '../data/contract';
import { foldText, numericValue } from '../lib/catalog';

/**
 * The side-by-side comparison (`watch-comparison`) — the view the whole site
 * exists for.
 *
 * Rows come from the normalized schema so every model answers the same question,
 * and each cell renders the tri-state, keeping "nicht unterstützt" apart from
 * "keine Angabe".
 */

/** Two cells are equal when their values are, ignoring the source wording. */
function comparisonKey(value: NormalizedValue | undefined): string {
  if (!value || value.kind === 'not-published') return 'not-published';
  switch (value.kind) {
    case 'flag':
      return `flag:${value.state}:${value.qualifier ?? ''}`;
    case 'number':
      return `number:${value.value}:${value.unit}:${value.bound}`;
    case 'dimensions':
      return `dim:${value.value.widthMm}x${value.value.heightMm}x${value.value.thicknessMm ?? '?'}`;
    case 'resolution':
      return `res:${value.value.width}x${value.value.height}`;
    case 'water':
      return `water:${value.value.label}`;
    case 'battery':
      return `battery:${value.modes.map((m) => `${m.id}=${m.hours}`).join(',')}`;
    case 'text':
      return `text:${value.text}`;
    case 'list':
      return `list:${[...value.items].sort().join('|')}`;
  }
}

/**
 * The leading cell is marked only where the direction is unambiguous — `better`
 * is declared per field in the schema, and a row without it gets no winner
 * (`watch-comparison` — best value marked).
 */
function leaders(field: SpecField, models: CatalogModel[]): Set<string> {
  if (!field.better) return new Set();
  const values = models
    .map((model) => ({ id: model.id, value: numericValue(model, field.id) }))
    .filter((entry): entry is { id: string; value: number } => entry.value !== null);
  if (values.length < 2) return new Set();

  const best = field.better === 'higher'
    ? Math.max(...values.map((v) => v.value))
    : Math.min(...values.map((v) => v.value));
  // A tie means nobody leads.
  const winners = values.filter((v) => v.value === best);
  return winners.length === values.length ? new Set() : new Set(winners.map((v) => v.id));
}

function AddColumn({ models }: { models: CatalogModel[] }) {
  const { state, toggleSelection } = useCatalogState();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const candidates = useMemo(() => {
    const needle = foldText(query.trim());
    return models
      .filter((model) => !state.selection.includes(model.id))
      .filter((model) => !needle || foldText(model.name).includes(needle))
      .slice(0, 40);
  }, [models, query, state.selection]);

  if (state.selection.length >= MAX_COMPARE) {
    return (
      <p className="text-xs text-ink-muted">
        Maximal <span className="num">{MAX_COMPARE}</span> Modelle.
      </p>
    );
  }

  return (
    <div className="w-56">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="w-full border border-dashed border-rule-strong px-3 py-2 text-sm text-ink-muted hover:text-ink"
      >
        + Modell hinzufügen
      </button>
      {open && (
        <div className="mt-2 border border-rule bg-panel p-2">
          <label>
            <span className="sr-only">Modell suchen</span>
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="suchen …"
              className="w-full border border-rule bg-page px-2 py-1 text-sm"
            />
          </label>
          <ul className="mt-2 max-h-64 overflow-y-auto">
            {candidates.map((model) => (
              <li key={model.id}>
                <button
                  type="button"
                  onClick={() => {
                    toggleSelection(model.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full px-1 py-1 text-left text-sm hover:bg-[var(--selection)]"
                >
                  {model.name}
                </button>
              </li>
            ))}
            {candidates.length === 0 && (
              <li className="px-1 py-1 text-sm text-ink-muted">nichts gefunden</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CompareRoute() {
  const { catalog, byId } = useCatalog();
  const { state, update, toggleSelection, search } = useCatalogState();
  const models = state.selection
    .map((id) => byId.get(id))
    .filter((model): model is CatalogModel => !!model);

  const rows = useMemo(
    () =>
      SPEC_SECTIONS.map((section) => ({
        section,
        fields: FIELDS.filter((field) => field.section === section).map((field) => {
          const keys = models.map((model) => comparisonKey(model.specs[field.id]));
          const differs = new Set(keys).size > 1;
          const allEmpty = keys.every((key) => key === 'not-published');
          return { field, differs, allEmpty, winners: leaders(field, models) };
        }),
      })),
    [models],
  );

  const hiddenCount = rows
    .flatMap((group) => group.fields)
    .filter((row) => !row.differs && !row.allEmpty).length;

  if (models.length < 2) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
        <h1 className="display text-xl">Für einen Vergleich sind mindestens zwei Modelle nötig</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">
          Aktuell {models.length === 0 ? 'ist kein Modell' : 'ist ein Modell'} ausgewählt. Wähle im
          Katalog bis zu <span className="num">{MAX_COMPARE}</span> Modelle über „Vergleichen“ aus.
        </p>
        <div className="mt-4 flex flex-wrap items-start gap-4">
          <Link
            to={{ pathname: '/', search }}
            className="border border-accent bg-accent px-3 py-1.5 text-sm text-[var(--accent-ink)]"
          >
            Zum Katalog
          </Link>
          <AddColumn models={catalog?.models ?? []} />
        </div>
      </div>
    );
  }

  const move = (index: number, delta: number) => {
    const next = [...state.selection];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update({ selection: next });
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display text-lg">Vergleich</h1>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.differencesOnly}
            onChange={() => update({ differencesOnly: !state.differencesOnly })}
            className="accent-[var(--accent)]"
          />
          Nur Unterschiede
        </label>
        {state.differencesOnly && (
          <span className="text-xs text-ink-muted">
            <span className="num">{hiddenCount}</span> identische Zeilen ausgeblendet
          </span>
        )}
        <div className="ml-auto">
          <AddColumn models={catalog?.models ?? []} />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto border border-rule">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Vergleich von {models.map((model) => model.name).join(', ')}
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 top-0 z-20 min-w-[190px] border-b border-r border-rule bg-panel p-2 text-left align-bottom"
              >
                <span className="text-xs uppercase tracking-[0.1em] text-ink-muted">Merkmal</span>
              </th>
              {models.map((model, index) => (
                <th
                  key={model.id}
                  scope="col"
                  className="sticky top-0 z-10 min-w-[220px] border-b border-r border-rule bg-panel p-2 text-left align-bottom"
                >
                  <div className="flex flex-col gap-2">
                    <ModelImage
                      src={model.image}
                      alt={model.name}
                      className="h-24 w-full object-contain"
                    />
                    <Link
                      to={{ pathname: `/modell/${model.id}`, search }}
                      className="display text-sm leading-tight hover:text-accent"
                    >
                      {model.name}
                    </Link>
                    <Price price={model.price} prefix={model.variantCount > 1 ? 'ab' : undefined} />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={`${model.name} nach links verschieben`}
                        className="border border-rule px-1.5 text-xs text-ink-muted disabled:opacity-40 hover:enabled:text-ink"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === models.length - 1}
                        aria-label={`${model.name} nach rechts verschieben`}
                        className="border border-rule px-1.5 text-xs text-ink-muted disabled:opacity-40 hover:enabled:text-ink"
                      >
                        →
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSelection(model.id)}
                        aria-label={`${model.name} aus dem Vergleich entfernen`}
                        className="ml-auto border border-rule px-1.5 text-xs text-ink-muted hover:text-mark"
                      >
                        entfernen
                      </button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {rows.map((group) => {
            const visibleFields = group.fields.filter(
              (row) => !state.differencesOnly || row.differs,
            );
            if (visibleFields.length === 0) return null;
            return (
              <tbody key={group.section}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={models.length + 1}
                    className="sticky left-0 border-y border-rule bg-panel-sunken p-2 text-left"
                  >
                    <span className="display text-xs uppercase tracking-[0.12em]">
                      {group.section}
                    </span>
                  </th>
                </tr>
                {visibleFields.map((row) => (
                  <tr
                    key={row.field.id}
                    className={row.differs ? 'bg-[var(--accent-wash)]/40' : undefined}
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-r border-rule bg-panel p-2 text-left align-top font-normal"
                    >
                      <span className={row.differs ? 'font-medium' : undefined}>
                        {row.field.label}
                      </span>
                      {row.differs && (
                        <span className="ml-1 text-[10px] text-accent" title="Unterschied">
                          ≠
                        </span>
                      )}
                      {row.field.unit && (
                        <span className="num ml-1 text-[11px] text-ink-muted">
                          ({row.field.unit})
                        </span>
                      )}
                    </th>
                    {models.map((model) => {
                      const isWinner = row.winners.has(model.id);
                      return (
                        <td
                          key={model.id}
                          className={`border-b border-r border-rule p-2 align-top ${
                            isWinner ? 'bg-[var(--state-supported-wash)]' : ''
                          }`}
                        >
                          <SpecValueView field={row.field} value={model.specs[row.field.id]} />
                          {isWinner && (
                            <span className="ml-1 text-[10px] uppercase tracking-wide text-[var(--state-supported)]">
                              ▲ bester Wert
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        „keine Angabe“ bedeutet, dass Garmin für dieses Modell nichts veröffentlicht — nicht, dass
        die Funktion fehlt.
      </p>
    </div>
  );
}
