import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCatalog } from './CatalogProvider';
import { useCatalogState } from './state';
import { useTheme } from './theme';
import { SelectionBar } from '../components/SelectionBar';

/**
 * The shell every view sits in: navigation that carries the current filter state
 * across routes, the theme control, the persistent comparison selection bar, and
 * the snapshot/provenance footer that has to appear on every view
 * (`catalog-browse` — snapshot date shown; design risk note on staleness).
 */

const THEME_LABEL = {
  system: 'System',
  light: 'Hell',
  dark: 'Dunkel',
} as const;

/** Zero-padded, so the header's date and the footer's timestamp agree on shape. */
export function formatSnapshot(iso: string, withTime = true): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function SnapshotDate() {
  const { catalog } = useCatalog();
  if (!catalog) return null;
  return (
    <span className="num text-xs text-ink-muted">
      Stand {formatSnapshot(catalog.meta.generatedAt, false)}
    </span>
  );
}

/**
 * Every price on the site is one store's price at one moment, and the footer is
 * on every route, so this is where that scope is stated (`site-publication` —
 * data is dated and scoped). The currency is read from the snapshot rather than
 * assumed, so a store change cannot leave the label lying.
 */
function PriceProvenance() {
  const { catalog } = useCatalog();
  const currency = catalog?.models.find((model) => model.price)?.price?.currency ?? 'EUR';
  return (
    <p>
      Alle Preise: Store{' '}
      <span className="num">{catalog?.meta.storeCode ?? 'DE'}</span> (Deutschland), Locale{' '}
      <span className="num">{catalog?.meta.locale ?? 'de-DE'}</span>, Währung{' '}
      <span className="num">{currency}</span> — Momentaufnahme vom{' '}
      <span className="num">{catalog ? formatSnapshot(catalog.meta.generatedAt) : '—'}</span>
      . Preise sind zu diesem Zeitpunkt eingefroren und werden nicht live abgefragt.
    </p>
  );
}

export function Layout() {
  const { search } = useCatalogState();
  const { choice, cycle } = useTheme();
  const { status } = useCatalog();
  const location = useLocation();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    [
      'px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
      isActive
        ? 'border-accent text-ink font-medium'
        : 'border-transparent text-ink-muted hover:text-ink',
    ].join(' ');

  return (
    <div className="min-h-screen flex flex-col bg-page text-ink">
      <a className="skip-link" href="#inhalt">
        Zum Inhalt springen
      </a>

      <header className="border-b border-rule bg-panel">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
            <NavLink to={{ pathname: '/', search }} className="display text-lg leading-none">
              GARMIN SMARTWATCH VERGLEICH
            </NavLink>
            <nav aria-label="Hauptnavigation" className="flex items-end gap-1 border-b border-transparent">
              <NavLink to={{ pathname: '/', search }} end className={navClass}>
                Katalog
              </NavLink>
              <NavLink to={{ pathname: '/vergleich', search }} className={navClass}>
                Vergleich
              </NavLink>
              <NavLink to={{ pathname: '/diagramme', search }} className={navClass}>
                Diagramme
              </NavLink>
            </nav>
            <div className="ml-auto flex items-center gap-4">
              <SnapshotDate />
              <button
                type="button"
                onClick={cycle}
                className="border border-rule px-2 py-1 text-xs text-ink-muted hover:text-ink hover:border-rule-strong"
                aria-label={`Farbschema: ${THEME_LABEL[choice]}. Umschalten.`}
              >
                {THEME_LABEL[choice]}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main id="inhalt" className="flex-1">
        {/* The disclaimer has to be reachable even when the snapshot is not:
            it is the one view that says nothing about the catalog. */}
        {status !== 'ready' && location.pathname === '/legal' && <Outlet />}
        {status === 'loading' && location.pathname !== '/legal' && (
          <p className="mx-auto max-w-[1600px] px-4 py-16 text-ink-muted sm:px-6">
            Katalog wird geladen …
          </p>
        )}
        {status === 'error' && location.pathname !== '/legal' && (
          <div className="mx-auto max-w-[1600px] px-4 py-16 sm:px-6">
            <h1 className="display text-xl">Der Katalog konnte nicht geladen werden</h1>
            <p className="mt-2 max-w-prose text-ink-muted">
              Die Momentaufnahme unter <code>data/catalog.json</code> fehlt oder ist unlesbar. Erzeuge
              sie mit <code>npm run ingest &amp;&amp; npm run normalize</code>.
            </p>
          </div>
        )}
        {status === 'ready' && <Outlet key={location.pathname} />}
      </main>

      <SelectionBar />

      <footer className="border-t border-rule bg-panel">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-1 px-4 py-4 text-xs text-ink-muted sm:px-6">
          <p>
            Daten, Texte und Bilder stammen ausschließlich von{' '}
            <span className="num">www.garmin.com</span> und{' '}
            <span className="num">res.garmin.com</span>.
          </p>
          <PriceProvenance />
          <p>
            <strong className="font-medium text-ink">Inoffiziell.</strong> Diese Seite steht in
            keiner Verbindung zu Garmin und wird von Garmin weder betrieben noch unterstützt.
            Produktnamen, Spezifikationen und Bilder sind Eigentum von Garmin. Preise und
            Angaben ohne Gewähr — vor einem Kauf auf{' '}
            <span className="num">garmin.com</span> prüfen.{' '}
            <Link to={{ pathname: '/legal' }} className="text-accent underline underline-offset-2">
              Vollständiger Hinweis
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
