import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { scaleLinear } from 'd3-scale';
import type { CatalogModel } from '../data/contract';
import { HEATMAP_FIELDS } from '../data/schema';
import { supportedFlagCount } from '../lib/catalog';
import { useCatalogState } from '../app/state';
import { AxisBottom, ChartFrame, GridLines, Tooltip, UnavailableList } from './primitives';

/**
 * Price against capability (`spec-visualization` — price/capability, design D8).
 *
 * The capability measure is deliberately crude and stated in the view: the count
 * of feature flags Garmin marks as supported. A weighted score would encode our
 * own preferences and present them as if they were Garmin's data.
 */

const MARGIN = { top: 12, right: 24, bottom: 40, left: 52 };
const PLOT = { width: 620, height: 380 };
const RADIUS = 5;

export function PriceCapabilityChart({ models }: { models: CatalogModel[] }) {
  const navigate = useNavigate();
  const { search } = useCatalogState();
  const [hover, setHover] = useState<{ x: number; y: number; model: CatalogModel } | null>(null);

  const { points, missing, x, y, xTicks, yTicks } = useMemo(() => {
    const scored = models.map((model) => ({
      model,
      price: model.price?.amount ?? null,
      capability: supportedFlagCount(model, HEATMAP_FIELDS),
    }));
    const plotted = scored.filter(
      (point): point is { model: CatalogModel; price: number; capability: number } =>
        point.price !== null,
    );
    const unavailable = scored.filter((point) => point.price === null);

    const xScale = scaleLinear()
      .domain([0, Math.max(1, ...plotted.map((p) => p.capability))])
      .range([0, PLOT.width])
      .nice();
    const yScale = scaleLinear()
      .domain([0, Math.max(1, ...plotted.map((p) => p.price))])
      .range([PLOT.height, 0])
      .nice();

    return {
      points: plotted,
      missing: unavailable,
      x: xScale,
      y: yScale,
      xTicks: xScale.ticks(6).map((value) => ({ value, offset: xScale(value) })),
      yTicks: yScale.ticks(6).map((value) => ({ value, offset: yScale(value) })),
    };
  }, [models]);

  const table = (
    <table className="w-full border-collapse text-xs">
      <caption className="sr-only">Preis und Anzahl unterstützter Funktionen je Modell</caption>
      <thead>
        <tr className="border-b border-rule text-left">
          <th scope="col" className="p-1">Modell</th>
          <th scope="col" className="p-1">Preis</th>
          <th scope="col" className="p-1">unterstützte Funktionen</th>
        </tr>
      </thead>
      <tbody>
        {[...points]
          .sort((a, b) => b.capability - a.capability)
          .map((point) => (
            <tr key={point.model.id} className="border-b border-rule/60">
              <th scope="row" className="p-1 text-left font-normal">{point.model.name}</th>
              <td className="num p-1">{point.model.price?.formatted}</td>
              <td className="num p-1">
                {point.capability} / {HEATMAP_FIELDS.length}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      title="Preis und Funktionsumfang"
      description={`Funktionsumfang ist hier schlicht die Anzahl der ${HEATMAP_FIELDS.length} Funktionsmerkmale des Vergleichsschemas, die Garmin für ein Modell als vorhanden ausweist — ungewichtet. Punkte links oben sind teuer für wenig, rechts unten günstig für viel.`}
      table={table}
      minWidth={MARGIN.left + PLOT.width + MARGIN.right}
      note={
        <UnavailableList
          title="Ohne veröffentlichten Preis"
          items={missing.map((point) => ({ id: point.model.id, name: point.model.name }))}
        />
      }
    >
      <div className="relative">
        <svg
          width={MARGIN.left + PLOT.width + MARGIN.right}
          height={MARGIN.top + PLOT.height + MARGIN.bottom}
          // Not role="img": every point is focusable and opens its model.
          role="group"
          aria-label={`Streudiagramm: Preis gegen Funktionsumfang für ${points.length} Modelle`}
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            <GridLines ticks={xTicks} height={PLOT.height} />
            {yTicks.map((tick) => (
              <g key={tick.value}>
                <line
                  x1={0}
                  x2={PLOT.width}
                  y1={tick.offset}
                  y2={tick.offset}
                  stroke="var(--chart-grid)"
                  strokeWidth={1}
                />
                <text
                  x={-8}
                  y={tick.offset}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  className="num"
                  fill="var(--ink-muted)"
                >
                  {tick.value} €
                </text>
              </g>
            ))}

            {points.map((point) => (
              <g
                key={point.model.id}
                tabIndex={0}
                role="button"
                aria-label={`${point.model.name}, ${point.model.price?.formatted}, ${point.capability} von ${HEATMAP_FIELDS.length} Funktionen. Aktivieren öffnet die Detailansicht.`}
                onFocus={() => setHover({ x: MARGIN.left + x(point.capability), y: MARGIN.top + y(point.price), model: point.model })}
                onBlur={() => setHover(null)}
                onMouseEnter={() => setHover({ x: MARGIN.left + x(point.capability), y: MARGIN.top + y(point.price), model: point.model })}
                onMouseLeave={() => setHover(null)}
                onClick={() => navigate({ pathname: `/modell/${point.model.id}`, search })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate({ pathname: `/modell/${point.model.id}`, search });
                  }
                }}
                className="cursor-pointer"
              >
                {/* 2px surface ring keeps overlapping points readable. */}
                <circle
                  cx={x(point.capability)}
                  cy={y(point.price)}
                  r={RADIUS + 2}
                  fill="var(--panel)"
                />
                <circle
                  cx={x(point.capability)}
                  cy={y(point.price)}
                  r={RADIUS}
                  fill="var(--series-1)"
                />
              </g>
            ))}

            <AxisBottom
              ticks={xTicks}
              y={PLOT.height}
              width={PLOT.width}
              format={(value) => String(value)}
            />
            <text
              x={PLOT.width / 2}
              y={PLOT.height + 34}
              textAnchor="middle"
              fontSize={10}
              fill="var(--ink-muted)"
            >
              unterstützte Funktionsmerkmale
            </text>
          </g>
        </svg>
        {hover && (
          <Tooltip x={hover.x} y={hover.y}>
            <span className="block">{hover.model.name}</span>
            <span className="num block text-ink-muted">
              {hover.model.price?.formatted} ·{' '}
              {supportedFlagCount(hover.model, HEATMAP_FIELDS)} / {HEATMAP_FIELDS.length} Funktionen
            </span>
          </Tooltip>
        )}
      </div>
    </ChartFrame>
  );
}
