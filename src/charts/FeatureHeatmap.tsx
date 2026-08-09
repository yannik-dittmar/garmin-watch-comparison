import { useMemo, useState } from 'react';
import type { CatalogModel, SpecValue } from '../data/contract';
import { HEATMAP_FIELDS } from '../data/schema';
import { flagState } from '../lib/catalog';
import { ChartFrame } from './primitives';

/**
 * Feature coverage across the catalog (`spec-visualization` — feature matrix).
 *
 * Every cell is the tri-state, and every cell carries a glyph as well as a
 * colour, so the matrix stays readable without colour and in forced-colours
 * mode. Sorting by a feature column groups the models that support it.
 *
 * The flag set is the schema's `heatmap` fields — the curated subset, not all
 * ~380 raw labels (design Open Question 1, settled in task 12.7).
 */

const CELL = 26;
const LABEL_WIDTH = 200;

const CELL_STYLE: Record<SpecValue, { glyph: string; fill: string; ink: string; word: string }> = {
  supported: {
    glyph: '●',
    fill: 'var(--state-supported-wash)',
    ink: 'var(--state-supported)',
    word: 'unterstützt',
  },
  unsupported: {
    glyph: '○',
    fill: 'var(--state-unsupported-wash)',
    ink: 'var(--state-unsupported)',
    word: 'nicht unterstützt',
  },
  'not-published': {
    glyph: '–',
    fill: 'transparent',
    ink: 'var(--state-unknown)',
    word: 'keine Angabe',
  },
};

export function FeatureHeatmap({ models }: { models: CatalogModel[] }) {
  const [sortField, setSortField] = useState<string | null>(null);

  const rows = useMemo(() => {
    const scored = models.map((model) => ({
      model,
      states: HEATMAP_FIELDS.map((field) => flagState(model, field.id)),
    }));
    if (!sortField) return scored;
    const index = HEATMAP_FIELDS.findIndex((field) => field.id === sortField);
    if (index === -1) return scored;
    const rank = { supported: 0, unsupported: 1, 'not-published': 2 } as const;
    return [...scored].sort(
      (a, b) =>
        rank[a.states[index]] - rank[b.states[index]] ||
        a.model.name.localeCompare(b.model.name, 'de'),
    );
  }, [models, sortField]);

  const width = LABEL_WIDTH + HEATMAP_FIELDS.length * CELL;

  const table = (
    <table className="w-full border-collapse text-xs">
      <caption className="sr-only">Funktionsabdeckung je Modell</caption>
      <thead>
        <tr className="border-b border-rule text-left">
          <th scope="col" className="p-1">Modell</th>
          {HEATMAP_FIELDS.map((field) => (
            <th key={field.id} scope="col" className="p-1">
              {field.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.model.id} className="border-b border-rule/60">
            <th scope="row" className="p-1 text-left font-normal">{row.model.name}</th>
            {row.states.map((state, index) => (
              <td key={HEATMAP_FIELDS[index].id} className="p-1">
                {CELL_STYLE[state].word}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      title="Funktionsabdeckung"
      description={`${HEATMAP_FIELDS.length} Funktionsmerkmale über ${rows.length} Modelle. ● unterstützt · ○ nicht unterstützt · – keine Angabe. Eine Spaltenüberschrift sortiert nach diesem Merkmal.`}
      table={table}
      minWidth={width}
      note="„keine Angabe“ heißt, dass Garmin für dieses Modell nichts zu diesem Merkmal veröffentlicht — nicht, dass es fehlt."
    >
      <table className="border-collapse" style={{ width }}>
        <caption className="sr-only">
          Funktionsabdeckung als Matrix, Zeilen sind Modelle, Spalten sind Merkmale
        </caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 bg-panel text-left align-bottom text-[11px]">
              <span className="text-ink-muted">Modell</span>
            </th>
            {HEATMAP_FIELDS.map((field) => (
              <th key={field.id} scope="col" className="h-[178px] align-bottom p-0">
                <button
                  type="button"
                  onClick={() => setSortField(sortField === field.id ? null : field.id)}
                  aria-pressed={sortField === field.id}
                  title={`Nach „${field.label}“ sortieren`}
                  className="flex h-[178px] w-[26px] items-end justify-center pb-1 hover:text-accent"
                >
                  <span
                    className="whitespace-nowrap text-[11px]"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    {field.label}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.model.id}>
              <th
                scope="row"
                className="sticky left-0 truncate bg-panel pr-2 text-left text-[11px] font-normal"
                style={{ maxWidth: LABEL_WIDTH }}
              >
                {row.model.name}
              </th>
              {row.states.map((state, index) => {
                const field = HEATMAP_FIELDS[index];
                const style = CELL_STYLE[state];
                return (
                  <td key={field.id} className="p-0">
                    <span
                      tabIndex={0}
                      role="img"
                      aria-label={`${row.model.name}, ${field.label}: ${style.word}`}
                      title={`${field.label}: ${style.word}`}
                      className="num flex h-[24px] w-[24px] items-center justify-center text-[11px]"
                      style={{ background: style.fill, color: style.ink, margin: 1 }}
                    >
                      {style.glyph}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ChartFrame>
  );
}
