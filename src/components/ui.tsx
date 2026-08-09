import { useState } from 'react';
import type {
  CatalogModel,
  NormalizedValue,
  Price as PriceValue,
  ProductImage,
  SpecValue,
} from '../data/contract';
import { triState } from '../data/contract';
import { formatValue, type SpecField } from '../data/schema';
import { imageUrl } from '../data/load';

/* ------------------------------------------------------------------ */
/* Tri-state                                                           */
/* ------------------------------------------------------------------ */

/**
 * The tri-state, rendered so "nicht unterstützt" and "keine Angabe" can never be
 * mistaken for one another (`watch-comparison` — missing values explicit).
 * Colour is never the only cue: each state carries its own glyph and its own
 * word, which is also what makes the feature heatmap readable without colour.
 */
const TRI_STATE = {
  supported: { glyph: '●', label: 'Ja', className: 'text-[var(--state-supported)]' },
  unsupported: { glyph: '○', label: 'Nein', className: 'text-[var(--state-unsupported)]' },
  'not-published': { glyph: '–', label: 'keine Angabe', className: 'text-[var(--state-unknown)] italic' },
} as const satisfies Record<SpecValue, { glyph: string; label: string; className: string }>;

export function TriStateMark({ state, qualifier }: { state: SpecValue; qualifier?: string }) {
  const style = TRI_STATE[state];
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${style.className}`}>
      <span aria-hidden="true" className="num text-[0.8em]">
        {style.glyph}
      </span>
      <span>
        {style.label}
        {qualifier ? <span className="text-ink-muted"> ({qualifier})</span> : null}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Values                                                              */
/* ------------------------------------------------------------------ */

export function SpecValueView({
  field,
  value,
}: {
  field: SpecField;
  value: NormalizedValue | undefined;
}) {
  if (!value || value.kind === 'not-published') return <TriStateMark state="not-published" />;
  if (value.kind === 'flag') return <TriStateMark state={value.state} qualifier={value.qualifier} />;

  if (value.kind === 'battery') {
    return (
      <ul className="space-y-0.5">
        {value.modes.map((mode) => (
          <li key={mode.id} className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-ink-muted">{mode.label}</span>
            <span className="num">{formatHours(mode.hours)}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (value.kind === 'list') {
    return <span>{value.items.join(', ')}</span>;
  }

  const isNumeric = value.kind === 'number' || value.kind === 'dimensions' || value.kind === 'resolution';
  return <span className={isNumeric ? 'num' : undefined}>{formatValue(field, value)}</span>;
}

export function formatHours(hours: number): string {
  if (hours >= 48) {
    const days = hours / 24;
    return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(days)} Tage`;
  }
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(hours)} h`;
}

export function Price({ price, prefix }: { price: PriceValue | null; prefix?: string }) {
  if (!price) return <span className="text-ink-muted italic">kein Preis veröffentlicht</span>;
  return (
    <span className="num">
      {prefix ? <span className="text-ink-muted">{prefix} </span> : null}
      {price.formatted}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Imagery                                                             */
/* ------------------------------------------------------------------ */

/**
 * The single owner of how a product image is loaded (design D10). Imagery is
 * referenced from res.garmin.com rather than mirrored, so whether an image exists
 * is no longer knowable when the snapshot is built: both "the snapshot records no
 * image" and "the browser could not load it" resolve to the same labelled
 * placeholder here (`catalog-ingestion` — unreachable imagery degrades
 * gracefully; `watch-detail` — referenced image fails to load).
 *
 * The failure is remembered per URL rather than per mount, so the detail view's
 * hero image recovers when the reader selects a variant whose image does load.
 *
 * `loading="lazy"` is load-bearing on the catalog grid: ~83 remote images at
 * ~33 KB of WebP each is a first paint nobody should pay for up front.
 *
 * A `ProductImage` may be passed instead of a URL, together with the rendition
 * wanted: `thumb` picks the CDN's 150 px asset and falls back to the full-size
 * one where the CDN publishes none. That fallback is not a failure — it is the
 * `null` case of the contract — so it resolves before the single failure path
 * below, which stays the only owner of "this image could not be shown".
 */
export type ImageSource = string | ProductImage | null;

function renditionUrl(src: ImageSource, size: 'full' | 'thumb'): string | null {
  if (!src) return null;
  if (typeof src === 'string') return src;
  return size === 'thumb' ? (src.thumb ?? src.full) : src.full;
}

export function ModelImage({
  src,
  alt,
  size = 'full',
  className = '',
}: {
  src: ImageSource;
  alt: string;
  /** Which rendition to load; `thumb` falls back to the full-size URL. */
  size?: 'full' | 'thumb';
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = imageUrl(renditionUrl(src, size));

  if (!url || failedUrl === url) {
    return (
      <div
        role="img"
        aria-label={`${alt} — kein Bild verfügbar`}
        className={`flex items-center justify-center border border-dashed border-rule bg-panel-sunken text-center text-[11px] text-ink-muted ${className}`}
      >
        kein Bild verfügbar
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailedUrl(url)}
      className={className}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Small chrome                                                        */
/* ------------------------------------------------------------------ */

export function Chip({
  children,
  onRemove,
  removeLabel,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 border border-rule bg-panel px-2 py-0.5 text-xs">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? 'Filter entfernen'}
          className="text-ink-muted hover:text-mark"
        >
          ×
        </button>
      )}
    </span>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="display text-xs uppercase tracking-[0.12em] text-ink-muted">{children}</h2>
  );
}

export function modelState(model: CatalogModel, field: string): SpecValue {
  return triState(model.specs[field]);
}
