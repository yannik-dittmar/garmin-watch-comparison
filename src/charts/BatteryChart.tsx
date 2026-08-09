import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import type { CatalogModel } from '../data/contract';
import { numericValue } from '../lib/catalog';
import { formatHours } from '../components/ui';
import {
  AxisBottom,
  ChartFrame,
  GridLines,
  HatchPattern,
  Legend,
  MARK,
  RoundedBar,
  Tooltip,
  UnavailableList,
} from './primitives';

/**
 * Battery life by operating mode (`spec-visualization` — battery).
 *
 * Both modes share one scale, so the trade the specs actually encode — weeks in
 * smartwatch mode against hours with GPS running — is visible as the same length
 * of bar. Models with no published figure are listed separately rather than
 * plotted at zero, which would read as "this watch lasts no time at all".
 */

const ROW_HEIGHT = 26;
const BAR_HEIGHT = 9;
const LABEL_WIDTH = 210;
const MARGIN = { top: 8, right: 56, bottom: 28, left: LABEL_WIDTH };

interface Row {
  model: CatalogModel;
  smartwatch: number | null;
  gps: number | null;
}

export function BatteryChart({ models }: { models: CatalogModel[] }) {
  const [hover, setHover] = useState<{ x: number; y: number; content: string } | null>(null);

  const { rows, missing, width, height, scale, ticks } = useMemo(() => {
    const all: Row[] = models.map((model) => ({
      model,
      smartwatch: numericValue(model, 'batterySmartwatchHours'),
      gps: numericValue(model, 'batteryGpsHours'),
    }));
    const plotted = all
      .filter((row) => row.smartwatch !== null || row.gps !== null)
      .sort((a, b) => (b.smartwatch ?? 0) - (a.smartwatch ?? 0));
    const unavailable = all.filter((row) => row.smartwatch === null && row.gps === null);

    const max = Math.max(
      1,
      ...plotted.flatMap((row) => [row.smartwatch ?? 0, row.gps ?? 0]),
    );
    const plotWidth = 560;
    const chartWidth = MARGIN.left + plotWidth + MARGIN.right;
    const chartHeight = MARGIN.top + plotted.length * ROW_HEIGHT + MARGIN.bottom;
    const x = scaleLinear().domain([0, max]).range([0, plotWidth]).nice();

    return {
      rows: plotted,
      missing: unavailable,
      width: chartWidth,
      height: chartHeight,
      scale: x,
      ticks: x.ticks(6).map((value) => ({ value, offset: x(value) })),
    };
  }, [models]);

  const table = (
    <table className="w-full border-collapse text-xs">
      <caption className="sr-only">Akkulaufzeit je Modus in Stunden</caption>
      <thead>
        <tr className="border-b border-rule text-left">
          <th scope="col" className="p-1">Modell</th>
          <th scope="col" className="p-1">Smartwatch-Modus</th>
          <th scope="col" className="p-1">GPS-Modus</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.model.id} className="border-b border-rule/60">
            <th scope="row" className="p-1 text-left font-normal">{row.model.name}</th>
            <td className="num p-1">{row.smartwatch !== null ? formatHours(row.smartwatch) : 'keine Angabe'}</td>
            <td className="num p-1">{row.gps !== null ? formatHours(row.gps) : 'keine Angabe'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      title="Akkulaufzeit"
      description="Smartwatch-Modus und GPS-Modus auf einer gemeinsamen Skala in Stunden. Alle Werte sind Garmins Obergrenzen („bis zu“)."
      legend={
        <Legend
          items={[
            { label: 'Smartwatch-Modus', color: 'var(--series-1)' },
            { label: 'GPS-Modus', color: 'var(--series-2)', hatched: true },
          ]}
        />
      }
      table={table}
      minWidth={width}
      note={
        <>
          Modelle ohne veröffentlichte Angabe werden nicht als Null gezeichnet, sondern hier
          genannt.
          <UnavailableList
            title="Ohne veröffentlichte Akkuangabe"
            items={missing.map((row) => ({ id: row.model.id, name: row.model.name }))}
          />
        </>
      }
    >
      <div className="relative">
        <svg
          width={width}
          height={height}
          // Not role="img": the bars are focusable, and an image may not
          // contain interactive descendants.
          role="group"
          aria-label={`Akkulaufzeit von ${rows.length} Modellen, Smartwatch- und GPS-Modus`}
        >
          <HatchPattern id="battery-gps-hatch" color="var(--series-2)" />
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            <GridLines ticks={ticks} height={rows.length * ROW_HEIGHT} />
            {rows.map((row, index) => {
              const y = index * ROW_HEIGHT;
              return (
                <g key={row.model.id}>
                  <text
                    x={-8}
                    y={y + ROW_HEIGHT / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={11}
                    fill="var(--ink)"
                  >
                    {row.model.name.length > 34 ? `${row.model.name.slice(0, 33)}…` : row.model.name}
                  </text>
                  {row.smartwatch !== null && (
                    <g
                      tabIndex={0}
                      role="button"
                      aria-label={`${row.model.name}, Smartwatch-Modus ${formatHours(row.smartwatch)}`}
                      onFocus={() =>
                        setHover({
                          x: MARGIN.left + scale(row.smartwatch!),
                          y: MARGIN.top + y,
                          content: `${row.model.name} · Smartwatch ${formatHours(row.smartwatch!)}`,
                        })
                      }
                      onBlur={() => setHover(null)}
                      onMouseEnter={() =>
                        setHover({
                          x: MARGIN.left + scale(row.smartwatch!),
                          y: MARGIN.top + y,
                          content: `${row.model.name} · Smartwatch ${formatHours(row.smartwatch!)}`,
                        })
                      }
                      onMouseLeave={() => setHover(null)}
                    >
                      <RoundedBar
                        x={0}
                        y={y + 3}
                        width={scale(row.smartwatch)}
                        height={BAR_HEIGHT}
                        fill="var(--series-1)"
                      />
                    </g>
                  )}
                  {row.gps !== null && (
                    <g
                      tabIndex={0}
                      role="button"
                      aria-label={`${row.model.name}, GPS-Modus ${formatHours(row.gps)}`}
                      onFocus={() =>
                        setHover({
                          x: MARGIN.left + scale(row.gps!),
                          y: MARGIN.top + y + BAR_HEIGHT,
                          content: `${row.model.name} · GPS ${formatHours(row.gps!)}`,
                        })
                      }
                      onBlur={() => setHover(null)}
                      onMouseEnter={() =>
                        setHover({
                          x: MARGIN.left + scale(row.gps!),
                          y: MARGIN.top + y + BAR_HEIGHT,
                          content: `${row.model.name} · GPS ${formatHours(row.gps!)}`,
                        })
                      }
                      onMouseLeave={() => setHover(null)}
                    >
                      <RoundedBar
                        x={0}
                        y={y + 3 + BAR_HEIGHT + MARK.gap}
                        width={scale(row.gps)}
                        height={BAR_HEIGHT}
                        fill="url(#battery-gps-hatch)"
                      />
                    </g>
                  )}
                  {/* Selective direct label: the longest-lasting figure only. */}
                  {index === 0 && row.smartwatch !== null && (
                    <text
                      x={scale(row.smartwatch) + 6}
                      y={y + 3 + BAR_HEIGHT}
                      fontSize={10}
                      className="num"
                      fill="var(--ink-muted)"
                    >
                      {formatHours(row.smartwatch)}
                    </text>
                  )}
                </g>
              );
            })}
            <AxisBottom
              ticks={ticks}
              y={rows.length * ROW_HEIGHT}
              width={scale.range()[1]}
              format={(value) => `${value} h`}
            />
          </g>
        </svg>
        {hover && (
          <Tooltip x={hover.x} y={hover.y}>
            {hover.content}
          </Tooltip>
        )}
      </div>
    </ChartFrame>
  );
}
