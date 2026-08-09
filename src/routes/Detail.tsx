import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../app/CatalogProvider';
import { formatSnapshot } from '../app/Layout';
import { MAX_COMPARE, useCatalogState } from '../app/state';
import { useFavourites } from '../app/favourites';
import { loadModelDetail } from '../data/load';
import type { ModelDetail, RawSpecRow } from '../data/contract';
import { HEADLINE_FIELDS } from '../data/schema';
import { ModelImage, Price, SpecValueView, TriStateMark } from '../components/ui';
import { foldText } from '../lib/catalog';

/**
 * One model in full (`watch-detail`).
 *
 * The normalized headline sits above the complete raw table: every row Garmin
 * published, under its own section heading, in source order — including the rows
 * no normalized field covers.
 */

function useModelDetail(id: string | undefined) {
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    loadModelDetail(id)
      .then((loaded) => {
        if (!cancelled) setDetail(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { detail, error };
}

function groupSections(rows: RawSpecRow[]): Array<{ section: string; rows: RawSpecRow[] }> {
  const groups: Array<{ section: string; rows: RawSpecRow[] }> = [];
  for (const row of [...rows].sort((a, b) => a.order - b.order)) {
    const last = groups[groups.length - 1];
    if (last && last.section === row.section) last.rows.push(row);
    else groups.push({ section: row.section, rows: [row] });
  }
  return groups;
}

function sectionId(section: string): string {
  return `abschnitt-${foldText(section).replace(/[^a-z0-9]+/g, '-')}`;
}

export function DetailRoute() {
  const { id } = useParams<{ id: string }>();
  const { catalog, byId } = useCatalog();
  const { state, toggleSelection, update, search } = useCatalogState();
  const { isFavourite, toggle } = useFavourites();
  const { detail, error } = useModelDetail(id);

  const [specQuery, setSpecQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [variantIndex, setVariantIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const summary = id ? byId.get(id) : undefined;
  const selected = id ? state.selection.includes(id) : false;

  const related = useMemo(() => {
    if (!summary || !catalog) return [];
    return catalog.models.filter(
      (model) => model.id !== summary.id && model.lineage.family === summary.lineage.family,
    );
  }, [catalog, summary]);

  const groups = useMemo(() => (detail ? groupSections(detail.rawSpecs) : []), [detail]);
  const needle = foldText(specQuery.trim());
  const filteredGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          rows: needle
            ? group.rows.filter(
                (row) =>
                  foldText(row.label).includes(needle) || foldText(row.value).includes(needle),
              )
            : group.rows,
        }))
        .filter((group) => group.rows.length > 0),
    [groups, needle],
  );

  if (!id) return null;
  if (error) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
        <h1 className="display text-xl">Dieses Modell konnte nicht geladen werden</h1>
        <p className="mt-2 text-sm text-ink-muted">{error}</p>
        <Link to={{ pathname: '/', search }} className="mt-4 inline-block text-sm text-accent underline">
          Zurück zum Katalog
        </Link>
      </div>
    );
  }

  const variant = detail?.variants[variantIndex];
  const heroImage = variant?.images[0] ?? detail?.images[0] ?? summary?.image ?? null;
  const price = variant?.price ?? detail?.price ?? summary?.price ?? null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
      <Link to={{ pathname: '/', search }} className="text-xs text-accent underline underline-offset-2">
        ← Katalog
      </Link>

      <div className="mt-2 grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div>
          <ModelImage
            src={heroImage}
            alt={summary?.name ?? detail?.name ?? 'Modell'}
            className="mx-auto h-64 w-full max-w-[320px] object-contain"
          />

          {detail && detail.variants.length > 1 && (
            <section className="panel mt-4 p-3">
              <h2 className="display mb-2 text-xs uppercase tracking-[0.12em] text-ink-muted">
                Varianten ({detail.variants.length})
              </h2>
              <ul className="space-y-1">
                {detail.variants.map((entry, index) => (
                  <li key={entry.partNumber}>
                    <button
                      type="button"
                      onClick={() => setVariantIndex(index)}
                      aria-pressed={index === variantIndex}
                      className={`w-full border px-2 py-1 text-left text-xs ${
                        index === variantIndex
                          ? 'border-accent bg-[var(--accent-wash)]'
                          : 'border-rule hover:border-rule-strong'
                      }`}
                    >
                      <span className="block">{entry.name}</span>
                      <span className="num text-[11px] text-ink-muted">
                        {entry.partNumber}
                        {entry.price ? ` · ${entry.price.formatted}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {detail && detail.boxContents.length > 0 && (
            <section className="panel mt-4 p-3">
              <h2 className="display mb-2 text-xs uppercase tracking-[0.12em] text-ink-muted">
                Lieferumfang
              </h2>
              <ul className="list-disc pl-4 text-sm">
                {detail.boxContents.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">
            {summary?.lineage.family}
            {summary?.lineage.generation ? ` · ${summary.lineage.generation}` : ''}
            {summary?.lineage.qualifier ? ` · ${summary.lineage.qualifier}` : ''}
          </p>
          <h1 className="display text-2xl leading-tight">{summary?.name ?? detail?.name ?? '…'}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-lg">
              <Price price={price} prefix={!variant && (summary?.variantCount ?? 1) > 1 ? 'ab' : undefined} />
            </span>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => {
                if (toggleSelection(id) === 'refused') {
                  setNotice(`Es lassen sich höchstens ${MAX_COMPARE} Modelle vergleichen.`);
                }
              }}
              className={`border px-3 py-1 text-sm ${
                selected
                  ? 'border-accent bg-accent text-[var(--accent-ink)]'
                  : 'border-rule hover:border-rule-strong'
              }`}
            >
              {selected ? 'Im Vergleich' : 'Zum Vergleich hinzufügen'}
            </button>
            <button
              type="button"
              aria-pressed={isFavourite(id)}
              onClick={() => toggle(id)}
              className={`border px-3 py-1 text-sm ${
                isFavourite(id) ? 'border-mark text-mark' : 'border-rule hover:border-rule-strong'
              }`}
            >
              {isFavourite(id) ? '★ Favorit' : '☆ Favorit'}
            </button>
          </div>
          {notice && (
            <p role="status" className="mt-2 text-sm text-mark">
              {notice}
            </p>
          )}

          {/* Normalized headline summary */}
          {summary && (
            <section className="panel mt-4 p-3">
              <h2 className="display mb-2 text-xs uppercase tracking-[0.12em] text-ink-muted">
                Kennwerte
              </h2>
              <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {HEADLINE_FIELDS.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-baseline justify-between gap-3 border-b border-rule/60 py-1"
                  >
                    <dt className="text-sm text-ink-muted">{field.label}</dt>
                    <dd className="text-right text-sm">
                      <SpecValueView field={field} value={summary.specs[field.id]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Provenance */}
          {(detail ?? summary) && (
            <p className="mt-3 text-xs text-ink-muted">
              Erfasst am{' '}
              <span className="num">
                {formatSnapshot((detail ?? summary)!.fetchedAt)}
              </span>{' '}
              ·{' '}
              <a
                href={(detail ?? summary)!.sourceUrl}
                className="text-accent underline underline-offset-2"
                rel="noreferrer noopener"
                target="_blank"
              >
                Quelle auf garmin.com
              </a>
            </p>
          )}

          {/* Full raw spec table */}
          <section className="mt-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="display text-lg">Alle veröffentlichten Daten</h2>
              <label className="ml-auto">
                <span className="sr-only">Technische Daten durchsuchen</span>
                <input
                  type="search"
                  value={specQuery}
                  onChange={(event) => setSpecQuery(event.target.value)}
                  placeholder="in den Daten suchen …"
                  className="border border-rule bg-panel px-2 py-1 text-sm"
                />
              </label>
            </div>

            {!detail && <p className="mt-3 text-sm text-ink-muted">Technische Daten werden geladen …</p>}

            {detail && (
              <>
                <nav aria-label="Abschnitte" className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                  {groups.map((group) => (
                    <a
                      key={group.section}
                      href={`#${sectionId(group.section)}`}
                      className="text-xs text-accent underline underline-offset-2"
                    >
                      {group.section || 'Ohne Abschnitt'}
                    </a>
                  ))}
                </nav>

                {filteredGroups.length === 0 && (
                  <p className="mt-3 text-sm text-ink-muted">
                    Keine Zeile passt zu „{specQuery}“.
                  </p>
                )}

                {filteredGroups.map((group) => {
                  const key = group.section || 'ohne';
                  const isCollapsed = collapsed[key] ?? false;
                  return (
                    <div key={key} id={sectionId(group.section)} className="mt-4 border border-rule">
                      <button
                        type="button"
                        onClick={() => setCollapsed((current) => ({ ...current, [key]: !isCollapsed }))}
                        aria-expanded={!isCollapsed}
                        className="flex w-full items-center justify-between bg-panel px-3 py-2 text-left"
                      >
                        <span className="display text-xs uppercase tracking-[0.12em]">
                          {group.section || 'Ohne Abschnitt'}
                        </span>
                        <span className="num text-xs text-ink-muted">
                          {group.rows.length} {isCollapsed ? '▸' : '▾'}
                        </span>
                      </button>
                      {!isCollapsed && (
                        <table className="w-full border-collapse text-sm">
                          <tbody>
                            {group.rows.map((row) => (
                              <tr key={`${row.order}`} className="border-t border-rule">
                                <th
                                  scope="row"
                                  className="w-1/2 p-2 text-left align-top font-normal text-ink-muted"
                                >
                                  {row.label}
                                </th>
                                <td className="p-2 align-top">
                                  {row.valueKind === 'marker-yes' ? (
                                    <TriStateMark state="supported" />
                                  ) : row.valueKind === 'marker-no' ? (
                                    <TriStateMark state="unsupported" />
                                  ) : (
                                    <span className="whitespace-pre-line">{row.value}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </section>

          {/* Lineage */}
          {related.length > 0 && (
            <section className="mt-6">
              <h2 className="display text-lg">Weitere Modelle der Familie {summary?.lineage.family}</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {related.map((model) => (
                  <li key={model.id} className="flex items-center gap-1 border border-rule px-2 py-1">
                    <Link
                      to={{ pathname: `/modell/${model.id}`, search }}
                      className="text-sm hover:text-accent"
                    >
                      {model.name}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        // Both models are added in one commit: two toggles in a
                        // row would each write the same stale selection.
                        const next = [...new Set([...state.selection, id, model.id])];
                        if (next.length > MAX_COMPARE) {
                          setNotice(
                            `Es lassen sich höchstens ${MAX_COMPARE} Modelle vergleichen. Entferne zuerst eines aus der Auswahl.`,
                          );
                          return;
                        }
                        update({ selection: next });
                      }}
                      className="text-xs text-accent underline"
                      aria-label={`${model.name} mit ${summary?.name ?? ''} vergleichen`}
                    >
                      vergleichen
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      <p className="mt-6 text-xs text-ink-muted">
        Die Kennwerte oben sind eine Auswahl aus dem Vergleichsschema; die Tabelle darunter enthält
        jede Zeile, die Garmin für dieses Modell veröffentlicht — auch die, für die es kein
        normalisiertes Feld gibt.
      </p>
    </div>
  );
}
