import { Link } from 'react-router-dom';
import { useCatalog } from '../app/CatalogProvider';
import { formatSnapshot } from '../app/Layout';
import { SectionHeading } from '../components/ui';

/**
 * The full disclaimer the footer links to (`site-publication` — attribution and
 * warranty disclaimer). The footer carries the short form on every route; this is
 * the page that has to be complete, including the two third-party hosts the
 * visitor's browser contacts directly once the site is published.
 */
export function LegalRoute() {
  const { catalog } = useCatalog();
  const currency = catalog?.models.find((model) => model.price)?.price?.currency ?? 'EUR';

  return (
    <div className="mx-auto max-w-[70ch] px-4 py-8 sm:px-6">
      <Link to="/" className="text-xs text-accent underline underline-offset-2">
        ← Katalog
      </Link>

      <h1 className="display mt-3 text-2xl leading-tight">Rechtliche Hinweise</h1>

      <div className="mt-8 space-y-8 text-sm leading-relaxed">
        <section className="space-y-2">
          <SectionHeading>Keine Verbindung zu Garmin</SectionHeading>
          <p>
            Diese Seite ist ein inoffizielles, privates Vergleichsprojekt. Sie steht in keiner
            Verbindung zu Garmin Ltd. oder einem seiner Tochterunternehmen, wird von Garmin weder
            betrieben noch autorisiert, unterstützt oder geprüft.
          </p>
        </section>

        <section className="space-y-2">
          <SectionHeading>Marken und Inhalte</SectionHeading>
          <p>
            <span className="num">Garmin</span> sowie alle Produktnamen, Modellbezeichnungen und
            Produktbilder sind Eigentum von Garmin Ltd. beziehungsweise der jeweiligen
            Rechteinhaber. Sämtliche Spezifikationen, Texte und Bilder stammen von{' '}
            <span className="num">garmin.com</span> und werden hier ausschließlich zum Zweck des
            Produktvergleichs wiedergegeben.
          </p>
        </section>

        <section className="space-y-2">
          <SectionHeading>Keine Gewähr</SectionHeading>
          <p>
            Für Richtigkeit, Vollständigkeit und Aktualität der dargestellten Preise und
            Spezifikationen wird keine Gewähr übernommen. Die Angaben können von dem abweichen, was
            Garmin tatsächlich anbietet.
          </p>
          <p>
            Alle Preise sind eine Momentaufnahme des Stores{' '}
            <span className="num">{catalog?.meta.storeCode ?? 'DE'}</span> (Deutschland) in der
            Locale <span className="num">{catalog?.meta.locale ?? 'de-DE'}</span>, Währung{' '}
            <span className="num">{currency}</span>, erfasst am{' '}
            <span className="num">
              {catalog ? formatSnapshot(catalog.meta.generatedAt) : '—'}
            </span>
            . Sie werden nicht live abgefragt.
          </p>
          <p className="border-l-2 border-accent pl-3">
            Prüfe jeden Preis und jede Spezifikation auf{' '}
            <a
              href="https://www.garmin.com/de-DE/"
              className="num text-accent underline underline-offset-2"
              rel="noreferrer noopener"
              target="_blank"
            >
              garmin.com
            </a>
            , bevor du eine Kaufentscheidung triffst. Jedes Modell auf dieser Seite verlinkt direkt
            auf seine offizielle Produktseite.
          </p>
        </section>

        <section className="space-y-2">
          <SectionHeading>Externe Hosts</SectionHeading>
          <p>
            Der Katalog selbst — Modelle, Spezifikationen, Preise — wird vollständig von dieser
            Seite ausgeliefert. Zwei Ressourcen lädt der Browser jedoch direkt von Dritten, wodurch
            deren Betreiber die IP-Adresse und den User-Agent des Besuchers sehen:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <span className="num">res.garmin.com</span> — die Produktbilder, die nicht kopiert,
              sondern von Garmins eigenem CDN referenziert werden.
            </li>
            <li>
              <span className="num">cdn.jsdelivr.net</span> — die Schriftarten (Archivo, IBM Plex
              Sans, IBM Plex Mono).
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <SectionHeading>Zweck</SectionHeading>
          <p>
            Nichtkommerzielles privates Vergleichsprojekt ohne Werbung, ohne Affiliate-Links und
            ohne Tracking. Die Seite ist für Suchmaschinen auf <span className="num">noindex</span>{' '}
            gesetzt.
          </p>
        </section>
      </div>
    </div>
  );
}
