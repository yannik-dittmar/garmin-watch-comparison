import { useMemo } from 'react';
import type { CatalogModel, Dimensions } from '../data/contract';
import { formatNumber } from '../data/schema';
import { ChartFrame, UnavailableList } from './primitives';

/**
 * The signature view (design D10, `spec-visualization` — to-scale size).
 *
 * Case outlines drawn to a common scale as an engineering dimension drawing:
 * concentric plan outlines with a leader-line callout ladder, and a thickness
 * elevation beneath on the same scale. This is the one thing a specification
 * table genuinely cannot show — 43 mm and 51 mm are two numbers in a table and
 * two very different objects on a wrist — which is why it earns the space.
 *
 * Outlines are distinguished by line pattern and direct labels rather than by
 * hue: four overlapping colours could not clear the palette validator's
 * all-pairs floors, and monochrome line work is what the drawing convention
 * actually looks like.
 */

/** Pixels per millimetre — the scale the whole drawing is locked to. */
const PX_PER_MM = 8;
const PLAN_PADDING = 72;
const DASHES = ['0', '7 4', '2 3', '10 3 2 3'];

/** IBM Plex Mono at 11px advances ~6.65px per character. */
const CALLOUT_CHAR = 6.65;
const CALLOUT_LEAD = 60;
const CALLOUT_STEP = 18;
const ELEVATION_GAP = 14;
const NAME_LIMIT = 30;

function shortName(name: string): string {
  return name.length > NAME_LIMIT ? `${name.slice(0, NAME_LIMIT - 1)}…` : name;
}

interface Entry {
  model: CatalogModel;
  dimensions: Dimensions;
}

function dimensionsOf(model: CatalogModel): Dimensions | null {
  const value = model.specs.caseDimensions;
  return value?.kind === 'dimensions' ? value.value : null;
}

export function SizeOverlay({ models }: { models: CatalogModel[] }) {
  const { entries, missing } = useMemo(() => {
    const withDimensions: Entry[] = [];
    const without: CatalogModel[] = [];
    for (const model of models) {
      const dimensions = dimensionsOf(model);
      if (dimensions) withDimensions.push({ model, dimensions });
      else without.push(model);
    }
    // Largest first, so a smaller case is never hidden inside a bigger outline.
    withDimensions.sort((a, b) => b.dimensions.widthMm - a.dimensions.widthMm);
    return { entries: withDimensions, missing: without };
  }, [models]);

  const table = (
    <table className="w-full border-collapse text-xs">
      <caption className="sr-only">Gehäusemaße der ausgewählten Modelle</caption>
      <thead>
        <tr className="border-b border-rule text-left">
          <th scope="col" className="p-1">Modell</th>
          <th scope="col" className="p-1">Breite</th>
          <th scope="col" className="p-1">Höhe</th>
          <th scope="col" className="p-1">Dicke</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.model.id} className="border-b border-rule/60">
            <th scope="row" className="p-1 text-left font-normal">{entry.model.name}</th>
            <td className="num p-1">{formatNumber(entry.dimensions.widthMm)} mm</td>
            <td className="num p-1">{formatNumber(entry.dimensions.heightMm)} mm</td>
            <td className="num p-1">
              {entry.dimensions.thicknessMm !== null
                ? `${formatNumber(entry.dimensions.thicknessMm)} mm`
                : 'keine Angabe'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (entries.length === 0) {
    return (
      <ChartFrame
        title="Gehäusegrößen im Maßstab"
        description="Zeichnet die Gehäuse der ausgewählten Modelle maßstabsgetreu übereinander."
        table={table}
        note={
          <UnavailableList
            title="Ohne veröffentlichte Maße — nicht gezeichnet"
            items={missing.map((model) => ({ id: model.id, name: model.name }))}
          />
        }
      >
        <p className="text-sm text-ink-muted">
          Für die ausgewählten Modelle sind keine Maße veröffentlicht.
        </p>
      </ChartFrame>
    );
  }

  const maxWidth = Math.max(...entries.map((entry) => entry.dimensions.widthMm));
  const planSize = Math.max(maxWidth, ...entries.map((e) => e.dimensions.heightMm)) * PX_PER_MM;

  const calloutText = (entry: Entry) =>
    `⌀ ${formatNumber(entry.dimensions.widthMm)} mm · ${shortName(entry.model.name)}`;
  const labelWidth =
    28 + 22 + Math.max(...entries.map((entry) => calloutText(entry).length * CALLOUT_CHAR));
  const gutter = CALLOUT_LEAD + labelWidth;

  const centreX = PLAN_PADDING + planSize / 2;
  const centreY = PLAN_PADDING + planSize / 2;
  const calloutX = PLAN_PADDING + planSize + CALLOUT_LEAD;
  const calloutTop = centreY - ((entries.length - 1) * CALLOUT_STEP) / 2;

  /* Elevations are stacked, each on its own baseline — they are solids, so
     overlaying them would be unreadable where the plan overlay is not. */
  const elevationTop = PLAN_PADDING + planSize + 76;
  let cursor = 0;
  const elevations = entries.map((entry) => {
    const height = (entry.dimensions.thicknessMm ?? 0) * PX_PER_MM;
    const row = { entry, y: cursor, height };
    cursor += (entry.dimensions.thicknessMm === null ? 16 : height) + ELEVATION_GAP;
    return row;
  });

  const svgWidth = PLAN_PADDING + planSize + gutter + 16;
  const svgHeight = elevationTop + cursor + 16;

  return (
    <ChartFrame
      title="Gehäusegrößen im Maßstab"
      description={`Maßstabsgetreue Zeichnung, 1 mm = ${PX_PER_MM} px: oben die Aufsichten konzentrisch übereinander, unten die Bauhöhen im selben Maßstab. Unterschieden wird über Linienart und Beschriftung, nicht über Farbe.`}
      table={table}
      minWidth={svgWidth}
      note={
        <UnavailableList
          title="Ohne veröffentlichte Maße — nicht gezeichnet"
          items={missing.map((model) => ({ id: model.id, name: model.name }))}
        />
      }
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        role="img"
        aria-label={`Maßstabszeichnung der Gehäuse von ${entries
          .map((entry) => `${entry.model.name} ${formatNumber(entry.dimensions.widthMm)} mm`)
          .join(', ')}`}
      >
        {/* Centre cross-hairs, as on a dimension drawing */}
        <g stroke="var(--rule)" strokeWidth={1} strokeDasharray="8 3 2 3">
          <line x1={centreX} y1={PLAN_PADDING - 16} x2={centreX} y2={centreY + planSize / 2 + 16} />
          <line
            x1={centreX - planSize / 2 - 16}
            y1={centreY}
            x2={centreX + planSize / 2 + 16}
            y2={centreY}
          />
        </g>

        {entries.map((entry, index) => {
          const w = entry.dimensions.widthMm * PX_PER_MM;
          const h = entry.dimensions.heightMm * PX_PER_MM;
          const isRound = Math.abs(entry.dimensions.widthMm - entry.dimensions.heightMm) < 0.6;
          const dash = DASHES[index % DASHES.length];
          const calloutY = calloutTop + index * CALLOUT_STEP;
          // Leader starts on the outline itself, at 45° up-right.
          const anchorX = centreX + (w / 2) * 0.7071;
          const anchorY = centreY - (h / 2) * 0.7071;

          return (
            <g key={entry.model.id}>
              {isRound ? (
                <circle
                  cx={centreX}
                  cy={centreY}
                  r={w / 2}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth={2}
                  strokeDasharray={dash}
                />
              ) : (
                <rect
                  x={centreX - w / 2}
                  y={centreY - h / 2}
                  width={w}
                  height={h}
                  rx={4}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth={2}
                  strokeDasharray={dash}
                />
              )}

              <polyline
                points={`${anchorX},${anchorY} ${calloutX - 12},${calloutY} ${calloutX - 4},${calloutY}`}
                fill="none"
                stroke="var(--ink-muted)"
                strokeWidth={1}
              />
              <circle cx={anchorX} cy={anchorY} r={2} fill="var(--ink-muted)" />
              {/* The callout repeats the line pattern, so label and outline pair up. */}
              <line
                x1={calloutX}
                y1={calloutY - 7}
                x2={calloutX + 22}
                y2={calloutY - 7}
                stroke="var(--ink)"
                strokeWidth={2}
                strokeDasharray={dash}
              />
              <text
                x={calloutX + 28}
                y={calloutY}
                dominantBaseline="middle"
                fontSize={11}
                className="num"
                fill="var(--ink)"
              >
                {calloutText(entry)}
              </text>
            </g>
          );
        })}

        {/* Dimension line for the largest case */}
        <g stroke="var(--ink-muted)" strokeWidth={1}>
          <line
            x1={centreX - (maxWidth * PX_PER_MM) / 2}
            y1={centreY + planSize / 2 + 30}
            x2={centreX + (maxWidth * PX_PER_MM) / 2}
            y2={centreY + planSize / 2 + 30}
          />
          <line
            x1={centreX - (maxWidth * PX_PER_MM) / 2}
            y1={centreY + planSize / 2 + 24}
            x2={centreX - (maxWidth * PX_PER_MM) / 2}
            y2={centreY + planSize / 2 + 36}
          />
          <line
            x1={centreX + (maxWidth * PX_PER_MM) / 2}
            y1={centreY + planSize / 2 + 24}
            x2={centreX + (maxWidth * PX_PER_MM) / 2}
            y2={centreY + planSize / 2 + 36}
          />
        </g>
        <text
          x={centreX}
          y={centreY + planSize / 2 + 25}
          textAnchor="middle"
          fontSize={10}
          className="num"
          fill="var(--ink-muted)"
        >
          {formatNumber(maxWidth)} mm
        </text>

        {/* Thickness elevations, same scale, stacked */}
        <g transform={`translate(0,${elevationTop})`}>
          <text x={PLAN_PADDING} y={-14} fontSize={10} fill="var(--ink-muted)">
            Bauhöhe — Seitenansicht, gleicher Maßstab
          </text>
          {elevations.map(({ entry, y, height }, index) => {
            const w = entry.dimensions.widthMm * PX_PER_MM;
            if (entry.dimensions.thicknessMm === null) {
              return (
                <text
                  key={entry.model.id}
                  x={PLAN_PADDING}
                  y={y + 12}
                  fontSize={11}
                  className="num"
                  fill="var(--ink-muted)"
                >
                  {shortName(entry.model.name)}: keine Dicke veröffentlicht
                </text>
              );
            }
            return (
              <g key={entry.model.id}>
                <rect
                  x={PLAN_PADDING}
                  y={y}
                  width={w}
                  height={height}
                  rx={2}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth={2}
                  strokeDasharray={DASHES[index % DASHES.length]}
                />
                <text
                  x={PLAN_PADDING + w + 14}
                  y={y + height / 2}
                  dominantBaseline="middle"
                  fontSize={11}
                  className="num"
                  fill="var(--ink)"
                >
                  {formatNumber(entry.dimensions.thicknessMm)} mm · {shortName(entry.model.name)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </ChartFrame>
  );
}
