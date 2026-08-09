import { useId, useState, type ReactNode } from 'react';

/**
 * Shared chart primitives (task 11.2, design D6).
 *
 * Charts are hand-drawn SVG over `d3-scale`/`d3-shape` — React owns the DOM,
 * d3 only computes. That is what makes the mark specs (2px strokes, 4px rounded
 * data-ends, a 2px surface gap between adjacent fills, selective direct labels,
 * recessive axes) cheap to satisfy exactly.
 *
 * Every chart built from these gets, by construction:
 *   - a tabular fallback reachable by keyboard and screen reader
 *   - keyboard-reachable marks
 *   - horizontal scrolling inside its own container, never on the page
 *   - colour never as the only cue
 */

export const MARK = {
  /** Stroke width for lines and outlines. */
  stroke: 2,
  /** Radius on the free end of a bar; the baseline end stays square. */
  dataEnd: 4,
  /** Gap between adjacent fills, painted in the surface colour. */
  gap: 2,
  minMarker: 8,
} as const;

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function ChartFrame({
  title,
  description,
  legend,
  table,
  children,
  minWidth,
  note,
}: {
  title: string;
  description: string;
  legend?: ReactNode;
  /** The same data in tabular form — required, not optional (`spec-visualization`). */
  table: ReactNode;
  children: ReactNode;
  minWidth?: number;
  note?: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="display text-base">{title}</h2>
        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          aria-expanded={showTable}
          aria-controls={tableId}
          className="ml-auto border border-rule px-2 py-1 text-xs text-ink-muted hover:text-ink"
        >
          {showTable ? 'Diagramm zeigen' : 'Als Tabelle'}
        </button>
      </div>
      <p className="mt-1 max-w-prose text-xs text-ink-muted">{description}</p>
      {legend && <div className="mt-2">{legend}</div>}

      {showTable ? (
        <div id={tableId} className="mt-3 overflow-x-auto">
          {table}
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <div style={minWidth ? { minWidth } : undefined}>{children}</div>
        </div>
      )}

      {note && <p className="mt-2 max-w-prose text-xs text-ink-muted">{note}</p>}
    </section>
  );
}

/**
 * A 45° hatch in the series colour, cut by surface-coloured lines. It is the
 * second cue that keeps two series apart without colour — in greyscale, in
 * print, and for a viewer who sees no hue difference at all
 * (`spec-visualization` — non-colour encoding).
 */
export function HatchPattern({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill={color} />
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--panel)" strokeWidth={2} />
      </pattern>
    </defs>
  );
}

export function Legend({
  items,
}: {
  items: Array<{ label: string; color: string; shape?: 'bar' | 'dot' | 'line'; hatched?: boolean }>;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <svg width="16" height="10" aria-hidden="true">
            {item.hatched && <HatchPattern id={`legend-hatch-${item.label}`} color={item.color} />}
            {item.shape === 'dot' ? (
              <circle cx="8" cy="5" r="4" fill={item.color} />
            ) : item.shape === 'line' ? (
              <line x1="0" y1="5" x2="16" y2="5" stroke={item.color} strokeWidth={MARK.stroke} />
            ) : (
              <rect
                x="0"
                y="2"
                width="16"
                height="6"
                rx="1"
                fill={item.hatched ? `url(#legend-hatch-${item.label})` : item.color}
              />
            )}
          </svg>
          <span className="text-ink-muted">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** A bar whose free end is rounded and whose baseline end stays square. */
export function RoundedBar({
  x,
  y,
  width,
  height,
  fill,
  radius = MARK.dataEnd,
  orientation = 'horizontal',
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  radius?: number;
  orientation?: 'horizontal' | 'vertical';
}) {
  if (width <= 0 || height <= 0) return null;
  const r = Math.min(radius, orientation === 'horizontal' ? width : height);
  const path =
    orientation === 'horizontal'
      ? `M${x},${y} H${x + width - r} A${r},${r} 0 0 1 ${x + width},${y + r} V${y + height - r} A${r},${r} 0 0 1 ${x + width - r},${y + height} H${x} Z`
      : `M${x},${y + r} A${r},${r} 0 0 1 ${x + r},${y} H${x + width - r} A${r},${r} 0 0 1 ${x + width},${y + r} V${y + height} H${x} Z`;
  return <path d={path} fill={fill} />;
}

export function AxisBottom({
  ticks,
  y,
  width,
  format,
}: {
  ticks: Array<{ value: number; offset: number }>;
  y: number;
  width: number;
  format: (value: number) => string;
}) {
  return (
    <g aria-hidden="true">
      <line x1={0} y1={y} x2={width} y2={y} stroke="var(--rule)" strokeWidth={1} />
      {ticks.map((tick) => (
        <g key={tick.value} transform={`translate(${tick.offset},${y})`}>
          <line y2={4} stroke="var(--rule)" strokeWidth={1} />
          <text
            y={16}
            textAnchor="middle"
            className="num"
            fill="var(--ink-muted)"
            fontSize={10}
          >
            {format(tick.value)}
          </text>
        </g>
      ))}
    </g>
  );
}

export function GridLines({
  ticks,
  height,
  top = 0,
}: {
  ticks: Array<{ offset: number }>;
  height: number;
  top?: number;
}) {
  return (
    <g aria-hidden="true">
      {ticks.map((tick, index) => (
        <line
          key={index}
          x1={tick.offset}
          x2={tick.offset}
          y1={top}
          y2={height}
          stroke="var(--chart-grid)"
          strokeWidth={1}
        />
      ))}
    </g>
  );
}

/**
 * A hover/focus tooltip anchored in page coordinates. Charts pass the mark's
 * bounding position; the tooltip itself is plain HTML so it inherits type and
 * theme tokens.
 */
export function Tooltip({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 border border-rule-strong bg-panel px-2 py-1 text-xs shadow-none"
      style={{ left: x, top: y, transform: 'translate(-50%, -110%)' }}
    >
      {children}
    </div>
  );
}

/** Models a chart cannot plot are named, never drawn at a guessed value. */
export function UnavailableList({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; name: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <details className="mt-3 border border-dashed border-rule px-3 py-2 text-xs">
      <summary className="cursor-pointer text-ink-muted">
        {title} (<span className="num">{items.length}</span>)
      </summary>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </details>
  );
}
