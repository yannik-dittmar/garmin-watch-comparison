import { useEffect, useRef } from 'react';
import type { ProductImage } from '../data/contract';
import { ModelImage } from './ui';

/**
 * The per-variant image gallery on the detail view (`watch-detail` — imagery and
 * box contents, enlarged image view).
 *
 * A contact sheet, not a carousel (design G6): every image of the selected
 * variant is visible at once as a square hairline cell, numbered in mono, under
 * a hero that opens the enlarged view. Position is the only thing about these
 * images that is verifiably true — the filename tokens do not encode a reliable
 * angle vocabulary — so numbering is what the component asserts and the counter,
 * the cells and the overlay caption all state the same `NN/NN`.
 *
 * The index is owned by the route (design G4): the overlay reads the same index
 * as the sheet, so closing it leaves the reader on the image they stopped at,
 * and selecting another variant resets it to the first frame.
 */

export interface GalleryProps {
  images: ProductImage[];
  index: number;
  onIndexChange: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelName: string;
  variantName?: string | null;
}

function frame(position: number): string {
  return String(position).padStart(2, '0');
}

/**
 * The rail is 340 px at `lg` and full-width below it, so the gallery grows with
 * the column — but never past the 600 px rendition's own size, which is the
 * point at which the hero would start upscaling.
 */
const COLUMN = 'mx-auto w-full max-w-[600px] lg:max-w-[320px]';

const CONTROL =
  'absolute bottom-0 z-10 flex h-7 w-7 items-center justify-center border border-rule ' +
  'bg-[var(--panel)] text-sm leading-none opacity-0 transition-opacity ' +
  'hover:border-rule-strong focus-visible:opacity-100 group-hover:opacity-100 ' +
  '[@media(hover:none)]:opacity-100';

export function VariantGallery({
  images,
  index,
  onIndexChange,
  open,
  onOpenChange,
  modelName,
  variantName,
}: GalleryProps) {
  const heroRef = useRef<HTMLButtonElement>(null);
  /**
   * A snapshot written before `images` existed — or one served by a build of a
   * different generation than the bundle, which is what a stale container does —
   * must degrade to the placeholder the way unreachable imagery already does.
   * Reading `.length` off whatever arrives would throw during render and take the
   * whole page down with it, which is the one outcome that helps nobody.
   */
  const set = Array.isArray(images) ? images : [];
  const count = set.length;
  const current = set[index] ?? set[0] ?? null;

  /** Wraps at both ends: a disabled arrow is a dead control the reader has to notice. */
  const step = (delta: number) => onIndexChange((index + delta + count) % count);

  const altFor = (position: number) =>
    [modelName, variantName, `Bild ${position} von ${count}`].filter(Boolean).join(', ');

  // No imagery for this variant: the placeholder, and nothing to cycle or enlarge.
  if (count === 0) {
    return (
      <ModelImage
        src={null}
        alt={[modelName, variantName].filter(Boolean).join(', ')}
        className={`${COLUMN} aspect-square object-contain`}
      />
    );
  }

  return (
    <div>
      <div className={`group relative ${COLUMN}`}>
        <button
          ref={heroRef}
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label={`${altFor(index + 1)} — Bild vergrößern`}
          className="block w-full cursor-zoom-in border border-rule bg-panel p-2"
        >
          <ModelImage
            src={current}
            alt={altFor(index + 1)}
            className="aspect-square w-full object-contain"
          />
        </button>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Vorheriges Bild"
              className={`${CONTROL} left-0`}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Nächstes Bild"
              className={`${CONTROL} right-0`}
            >
              ›
            </button>
          </>
        )}
      </div>

      <p className={`${COLUMN} mt-1 flex items-baseline gap-2 text-[11px] text-ink-muted`}>
        <span className="num">
          {frame(index + 1)}/{frame(count)}
        </span>
        {/* True by construction: `skuImages()` puts Garmin's own defaultImage first. */}
        {index === 0 && <span className="uppercase tracking-[0.1em]">Garmins Standardbild</span>}
      </p>

      {count > 1 && (
        <ul className={`${COLUMN} mt-2 grid grid-cols-6 gap-1 lg:grid-cols-4`}>
          {set.map((image, position) => (
            <li key={image?.full ?? position}>
              <button
                type="button"
                onClick={() => onIndexChange(position)}
                aria-pressed={position === index}
                className={`relative block aspect-square w-full border p-0.5 ${
                  position === index
                    ? 'border-accent bg-[var(--accent-wash)]'
                    : 'border-rule hover:border-rule-strong'
                }`}
              >
                <ModelImage
                  src={image}
                  size="thumb"
                  alt={altFor(position + 1)}
                  className="h-full w-full object-contain"
                />
                <span
                  aria-hidden="true"
                  className="num absolute bottom-0 left-0 bg-[var(--panel)] px-0.5 text-[10px] leading-tight text-ink-muted"
                >
                  {frame(position + 1)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ImageOverlay
        open={open}
        images={set}
        index={index}
        onIndexChange={onIndexChange}
        onClose={() => {
          onOpenChange(false);
          // React can lose the dialog's implicit focus return across a re-render,
          // so the trigger is refocused explicitly on every close path.
          heroRef.current?.focus();
        }}
        altFor={altFor}
        variantName={variantName}
      />
    </div>
  );
}

/**
 * The enlarged view (`watch-detail` — enlarged image view), a native `<dialog>`
 * opened with `showModal()` (design G7). The platform provides the top layer,
 * `inert` behind, the focus trap, `Esc`, and `::backdrop`; what is written by
 * hand is the label, the arrow keys, the backdrop-click test, the scroll lock
 * iOS Safari does not apply on its own, and the focus return.
 *
 * The element is rendered unconditionally and driven by an effect: mounting and
 * unmounting it instead would call `showModal()` on a detached node, and calling
 * it twice throws.
 */
function ImageOverlay({
  open,
  images,
  index,
  onIndexChange,
  onClose,
  altFor,
  variantName,
}: {
  open: boolean;
  images: ProductImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  altFor: (position: number) => string;
  variantName?: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const count = images.length;
  const current = images[index] ?? images[0] ?? null;
  const step = (delta: number) => onIndexChange((index + delta + count) % count);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // iOS Safari scrolls the page behind an open modal dialog; every other engine
  // does not. Locking the body is the one line that covers it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="image-overlay"
      aria-label={`${altFor(index + 1)} — vergrößert`}
      // Every close path — Esc, the close control, a backdrop click — ends in the
      // dialog's own `close` event, so the state sync has exactly one owner.
      onClose={onClose}
      // "The area outside the image" is everything the dialog paints that is not
      // the image itself, a control, or the caption. Comparing against the dialog
      // element alone is not enough: its layout wrapper covers the whole surface,
      // so a click beside the image lands on the wrapper, never on the dialog.
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('button, img, [role="img"], p')) return;
        dialogRef.current?.close();
      }}
      onKeyDown={(event) => {
        if (count < 2) return;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          step(-1);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          step(1);
        }
      }}
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Schließen"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center border border-[var(--overlay-rule)] text-lg leading-none"
        >
          ×
        </button>

        <div className="flex w-full flex-1 items-center justify-center gap-3">
          {count > 1 && (
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Vorheriges Bild"
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--overlay-rule)] text-xl leading-none"
            >
              ‹
            </button>
          )}
          {/* The image is centred in the free space rather than stretched into
              it, so the placeholder that replaces a failed one keeps its own
              size instead of becoming a full-width strip. */}
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <ModelImage
              src={current}
              alt={altFor(index + 1)}
              className="max-h-[78dvh] min-h-32 min-w-48 max-w-full object-contain"
            />
          </div>
          {count > 1 && (
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Nächstes Bild"
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--overlay-rule)] text-xl leading-none"
            >
              ›
            </button>
          )}
        </div>

        <p className="flex flex-wrap items-baseline justify-center gap-x-3 text-xs">
          {variantName && <span>{variantName}</span>}
          <span className="num">
            {frame(index + 1)}/{frame(count)}
          </span>
        </p>
      </div>
    </dialog>
  );
}
