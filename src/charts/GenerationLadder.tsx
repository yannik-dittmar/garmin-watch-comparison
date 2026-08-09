import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogModel } from '../data/contract';
import { useCatalogState } from '../app/state';
import { ChartFrame } from './primitives';

/**
 * The family generation ladder (`spec-visualization` — generation ladder, D7).
 *
 * Garmin publishes no release dates anywhere in this data, and the
 * official-sources-only rule forbids importing them. So this is deliberately not
 * a time axis: models are grouped by family and ordered by the generation
 * designation Garmin itself prints in the product name. A model whose generation
 * cannot be read from that name is shown in its family as unordered rather than
 * placed at a guessed position.
 */

export function GenerationLadder({ models }: { models: CatalogModel[] }) {
  const { search } = useCatalogState();

  const families = useMemo(() => {
    const byFamily = new Map<string, CatalogModel[]>();
    for (const model of models) {
      const list = byFamily.get(model.lineage.family) ?? [];
      list.push(model);
      byFamily.set(model.lineage.family, list);
    }
    return [...byFamily.entries()]
      .map(([family, list]) => {
        const ordered = list
          .filter((model) => model.lineage.generationRank !== null)
          .sort(
            (a, b) =>
              (a.lineage.generationRank ?? 0) - (b.lineage.generationRank ?? 0) ||
              a.name.localeCompare(b.name, 'de'),
          );
        const unordered = list
          .filter((model) => model.lineage.generationRank === null)
          .sort((a, b) => a.name.localeCompare(b.name, 'de'));
        return { family, ordered, unordered };
      })
      .sort((a, b) => a.family.localeCompare(b.family, 'de'));
  }, [models]);

  const table = (
    <table className="w-full border-collapse text-xs">
      <caption className="sr-only">Modelle je Familie nach Generationsbezeichnung</caption>
      <thead>
        <tr className="border-b border-rule text-left">
          <th scope="col" className="p-1">Familie</th>
          <th scope="col" className="p-1">Generation</th>
          <th scope="col" className="p-1">Modell</th>
        </tr>
      </thead>
      <tbody>
        {families.flatMap((group) =>
          [...group.ordered, ...group.unordered].map((model) => (
            <tr key={model.id} className="border-b border-rule/60">
              <th scope="row" className="p-1 text-left font-normal">{group.family}</th>
              <td className="num p-1">{model.lineage.generation ?? 'nicht ableitbar'}</td>
              <td className="p-1">{model.name}</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      title="Generationen je Familie"
      description="Garmin veröffentlicht in diesen Daten keine Erscheinungsdaten. Die Reihenfolge folgt daher der Generationsbezeichnung im Produktnamen und Garmins eigener Katalogeinordnung — es ist keine Zeitachse."
      table={table}
      note="Modelle, deren Generation sich aus Garmins Daten nicht ableiten lässt, stehen unsortiert am Ende ihrer Familie."
    >
      <div className="space-y-5">
        {families.map((group) => (
          <section key={group.family}>
            <h3 className="display text-xs uppercase tracking-[0.12em] text-ink-muted">
              {group.family}
            </h3>
            <ol className="mt-2 flex flex-wrap items-stretch gap-2">
              {group.ordered.map((model, index) => (
                <li key={model.id} className="flex items-center gap-2">
                  {index > 0 && (
                    <span aria-hidden="true" className="text-ink-muted">
                      →
                    </span>
                  )}
                  <Link
                    to={{ pathname: `/modell/${model.id}`, search }}
                    className="block border border-rule bg-panel px-2 py-1 hover:border-accent"
                  >
                    <span className="num block text-[11px] text-ink-muted">
                      {model.lineage.generation}
                    </span>
                    <span className="block text-sm">{model.name}</span>
                  </Link>
                </li>
              ))}
            </ol>
            {group.unordered.length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] text-ink-muted">
                  ohne ableitbare Generation — nicht einsortiert:
                </p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {group.unordered.map((model) => (
                    <li key={model.id}>
                      <Link
                        to={{ pathname: `/modell/${model.id}`, search }}
                        className="block border border-dashed border-rule px-2 py-1 text-sm hover:border-accent"
                      >
                        {model.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>
    </ChartFrame>
  );
}
