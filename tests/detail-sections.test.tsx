// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, findByText, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CatalogProvider } from '../src/app/CatalogProvider.js';
import { DetailRoute } from '../src/routes/Detail.js';
import type { CatalogModel, ModelDetail, RawSpecRow } from '../src/data/contract.js';

/**
 * The detail view's section jump under `HashRouter` (`watch-detail` — sections
 * navigable). A bare `href="#abschnitt-…"` cannot work here: it overwrites the
 * one fragment the router reads, which routes the reader to the catalog instead
 * of the section. The target therefore travels as the route's own hash, and the
 * view scrolls to it itself.
 */

const ID = 'test-modell';

const ROWS: RawSpecRow[] = [
  { section: 'Allgemein', label: 'Gehäusematerial', value: 'Polymer', valueKind: 'text', order: 1 },
  { section: 'Uhrfunktionen', label: 'Wecker', value: '', valueKind: 'marker-yes', order: 2 },
  { section: 'Sensoren', label: 'GPS', value: '', valueKind: 'marker-yes', order: 3 },
];

const MODEL: CatalogModel = {
  id: ID,
  name: 'Instinct 3 Solar',
  lineage: { family: 'Instinct', generation: '3', generationRank: 3, qualifier: 'Solar' },
  price: null,
  image: null,
  categories: [],
  partNumbers: ['010-02934-00'],
  variantCount: 1,
  specs: {},
  sourceUrl: 'https://www.garmin.com/de-DE/p/1',
  fetchedAt: '2026-08-01T00:00:00.000Z',
};

const DETAIL: ModelDetail = {
  id: ID,
  name: MODEL.name,
  lineage: MODEL.lineage,
  price: null,
  images: [],
  variants: [],
  boxContents: [],
  rawSpecs: ROWS,
  specs: {},
  sourceUrl: MODEL.sourceUrl,
  fetchedAt: MODEL.fetchedAt,
};

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        String(url).includes('catalog.json')
          ? { meta: { generatedAt: MODEL.fetchedAt, locale: 'de-DE' }, models: [MODEL] }
          : DETAIL,
    })),
  );
}

/** `App`'s routing, without the shell: the same fallback to the catalog. */
function renderDetail() {
  window.location.hash = `#/modell/${ID}`;
  return render(
    <CatalogProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<p>Katalogansicht</p>} />
          <Route path="/modell/:id" element={<DetailRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </CatalogProvider>,
  );
}

let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
  stubFetch();
  scrollIntoView = vi.fn();
  // jsdom has no layout, so it implements no scrolling either.
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = '';
});

describe('detail view section jump', () => {
  it('stays on the model and scrolls to the section', async () => {
    renderDetail();
    fireEvent.click(await screen.findByRole('link', { name: 'Sensoren' }));

    expect(window.location.hash).toBe(`#/modell/${ID}#abschnitt-sensoren`);
    expect(screen.queryByText('Katalogansicht')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Alle veröffentlichten Daten' })).toBeTruthy();
    expect(scrollIntoView).toHaveBeenCalled();
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById('abschnitt-sensoren'));
  });

  it('opens a collapsed section it jumps to', async () => {
    renderDetail();
    const toggle = await screen.findByRole('button', { name: /Uhrfunktionen/ });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(screen.getByRole('link', { name: 'Uhrfunktionen' }));
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('lands on the section when the URL carries it from the start', async () => {
    window.location.hash = `#/modell/${ID}#abschnitt-allgemein`;
    render(
      <CatalogProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<p>Katalogansicht</p>} />
            <Route path="/modell/:id" element={<DetailRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </CatalogProvider>,
    );

    await screen.findByRole('link', { name: 'Allgemein' });
    await waitFor(() =>
      expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById('abschnitt-allgemein')),
    );
  });

  it('offers no jump to a section the spec search has hidden', async () => {
    const { container } = renderDetail();
    fireEvent.change(await screen.findByPlaceholderText('in den Daten suchen …'), {
      target: { value: 'Wecker' },
    });

    const nav = container.querySelector('nav[aria-label="Abschnitte"]')!;
    expect(await findByText(nav as HTMLElement, 'Uhrfunktionen')).toBeTruthy();
    expect(nav.textContent).not.toContain('Sensoren');
  });
});
