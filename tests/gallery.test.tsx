// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VariantGallery } from '../src/components/Gallery.js';
import type { ProductImage } from '../src/data/contract.js';

/**
 * 6.1 — the gallery's own rules: the index resets when the variant changes, the
 * set wraps at both ends, and a variant with a single image grows no controls.
 *
 * The enlarged view is exercised in `tests/overlay.test.ts` instead: jsdom
 * implements no `<dialog>`, so asserting on it here would test a stand-in
 * rather than the platform behaviour the design relies on (design G7).
 */

function images(count: number, part = '010-02934-00'): ProductImage[] {
  return Array.from({ length: count }, (_, i) => ({
    full: `https://res.garmin.com/de_DE/products/${part}/v/pd-${i + 1}-lg.jpg`,
    thumb: `https://res.garmin.com/de_DE/products/${part}/v/pd-${i + 1}-sm.jpg`,
  }));
}

/** Stands in for `Detail.tsx`, which owns both indices and the reset rule (G4). */
function Harness({ sets }: { sets: Array<{ name: string; images: ProductImage[] }> }) {
  const [variantIndex, setVariantIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const variant = sets[variantIndex];
  return (
    <div>
      {sets.map((set, index) => (
        <button
          key={set.name}
          type="button"
          onClick={() => {
            setVariantIndex(index);
            setImageIndex(0);
          }}
        >
          {`Variante ${set.name}`}
        </button>
      ))}
      <VariantGallery
        images={variant.images}
        index={imageIndex}
        onIndexChange={setImageIndex}
        open={open}
        onOpenChange={setOpen}
        modelName="Instinct 3"
        variantName={variant.name}
      />
    </div>
  );
}

/**
 * The hero counter and the overlay caption state the same `NN/NN` by design, so
 * the page counter is the first of the two in document order.
 */
const counter = () => screen.getAllByText(/^\d\d\/\d\d$/)[0].textContent;

afterEach(cleanup);

describe('variant gallery', () => {
  it('shows every image of the set as a numbered cell, first frame selected', () => {
    render(<Harness sets={[{ name: 'Schwarz', images: images(8) }]} />);
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(7);
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
    expect(counter()).toBe('01/08');
    expect(screen.getByText('Garmins Standardbild')).toBeTruthy();
  });

  it('cells and the hero name the model, the variant and the position', () => {
    render(<Harness sets={[{ name: 'Schwarz', images: images(8) }]} />);
    expect(screen.getByAltText('Instinct 3, Schwarz, Bild 3 von 8')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Bild 1 von 8 — Bild vergrößern/ })).toBeTruthy();
  });

  it('cycles to the adjacent frame and wraps at both ends', () => {
    render(<Harness sets={[{ name: 'Schwarz', images: images(8) }]} />);
    const next = screen.getByRole('button', { name: 'Nächstes Bild' });
    const previous = screen.getByRole('button', { name: 'Vorheriges Bild' });

    fireEvent.click(next);
    expect(counter()).toBe('02/08');
    // Only frame 01 carries Garmin's own default-image eyebrow.
    expect(screen.queryByText('Garmins Standardbild')).toBeNull();

    fireEvent.click(previous);
    fireEvent.click(previous);
    expect(counter()).toBe('08/08');
    fireEvent.click(next);
    expect(counter()).toBe('01/08');
  });

  it('the contact sheet selects a frame directly', () => {
    render(<Harness sets={[{ name: 'Schwarz', images: images(8) }]} />);
    fireEvent.click(screen.getByAltText('Instinct 3, Schwarz, Bild 5 von 8'));
    expect(counter()).toBe('05/08');
  });

  it('returns to the first frame of the newly selected variant', () => {
    render(
      <Harness
        sets={[
          { name: 'Schwarz', images: images(8) },
          { name: 'Sunburst', images: images(3, '010-02934-02') },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Nächstes Bild' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nächstes Bild' }));
    expect(counter()).toBe('03/08');

    fireEvent.click(screen.getByRole('button', { name: 'Variante Sunburst' }));
    expect(counter()).toBe('01/03');
    // The new set, not the old one: the URLs are the newly selected SKU's.
    for (const image of screen.getAllByAltText('Instinct 3, Sunburst, Bild 1 von 3')) {
      expect(image.getAttribute('src')).toContain('010-02934-02');
    }
  });

  it('a single-image variant renders no cycling controls and no sheet', () => {
    render(<Harness sets={[{ name: 'Schwarz', images: images(1) }]} />);
    expect(screen.queryByRole('button', { name: 'Nächstes Bild' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Vorheriges Bild' })).toBeNull();
    expect(screen.queryAllByRole('button', { pressed: false })).toHaveLength(0);
    expect(counter()).toBe('01/01');
    // The one image is still shown, and still openable.
    expect(screen.getByRole('button', { name: /Bild vergrößern/ })).toBeTruthy();
  });

  it('a variant without imagery shows the placeholder and nothing else', () => {
    render(<Harness sets={[{ name: 'Schwarz', images: [] }]} />);
    expect(screen.getByRole('img', { name: /kein Bild verfügbar/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Bild vergrößern/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nächstes Bild' })).toBeNull();
  });

  /**
   * A `models/<id>.json` written before `images` existed — what a container
   * serving a snapshot from a different generation than its bundle hands over —
   * used to throw during render and blank the whole page. It degrades to the
   * placeholder instead.
   */
  it('survives a snapshot that carries no images field at all', () => {
    const missing = undefined as unknown as ProductImage[];
    render(<Harness sets={[{ name: 'Schwarz', images: missing }]} />);
    expect(screen.getByRole('img', { name: /kein Bild verfügbar/ })).toBeTruthy();
  });

  it('loads the small rendition in the sheet and the full one in the hero', () => {
    render(<Harness sets={[{ name: 'Schwarz', images: images(4) }]} />);
    expect(screen.getByAltText('Instinct 3, Schwarz, Bild 2 von 4').getAttribute('src')).toContain(
      'pd-2-sm.jpg',
    );
    // Frame 01 is in both places; the hero is the one inside the enlarge button.
    const hero = screen
      .getByRole('button', { name: /Bild vergrößern/ })
      .querySelector('img') as HTMLImageElement;
    expect(hero.getAttribute('src')).toContain('pd-1-lg.jpg');
  });

  it('falls back to the full-size asset where the CDN publishes no thumbnail', () => {
    const withoutThumb: ProductImage[] = [
      { full: 'https://res.garmin.com/en/products/010-02472-10/v/cf-lg-b6111ea5.jpg', thumb: null },
      { full: 'https://res.garmin.com/en/products/010-02472-10/v/rf-lg.jpg', thumb: 'https://res.garmin.com/en/products/010-02472-10/v/rf-sm.jpg' },
    ];
    render(<Harness sets={[{ name: 'Schwarz', images: withoutThumb }]} />);
    // Hero and cell both show frame 01; the cell is the second in document order.
    const [hero, cell] = screen.getAllByAltText('Instinct 3, Schwarz, Bild 1 von 2');
    expect(hero.getAttribute('src')).toContain('cf-lg-b6111ea5.jpg');
    expect(cell.getAttribute('src')).toContain('cf-lg-b6111ea5.jpg');
  });
});
