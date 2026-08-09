import { Link } from 'react-router-dom';
import type { CatalogModel } from '../data/contract';
import { FIELD_BY_ID } from '../data/schema';
import { MAX_COMPARE, useCatalogState } from '../app/state';
import { ModelImage, Price, SpecValueView, formatHours } from './ui';
import { numericValue } from '../lib/catalog';

/**
 * One model in the browse grid: image, name, family, price and the headline
 * specs (`catalog-browse` — complete catalog overview), plus the two per-model
 * actions — compare selection and favourite.
 */
export function ModelCard({
  model,
  isFavourite,
  onToggleFavourite,
  onRefused,
}: {
  model: CatalogModel;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  onRefused: (message: string) => void;
}) {
  const { state, toggleSelection, search } = useCatalogState();
  const selected = state.selection.includes(model.id);

  const battery = numericValue(model, 'batterySmartwatchHours');
  const caseSize = numericValue(model, 'caseSize');
  const weight = numericValue(model, 'weight');

  return (
    <article className="panel flex flex-col">
      <Link
        to={{ pathname: `/modell/${model.id}`, search }}
        className="group flex flex-col gap-3 p-3"
      >
        <ModelImage
          src={model.image}
          alt={model.name}
          className="mx-auto h-40 w-full max-w-[220px] object-contain"
        />
        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">
            {model.lineage.family}
            {model.lineage.generation ? ` · ${model.lineage.generation}` : ''}
          </p>
          <h3 className="display text-base leading-tight group-hover:text-accent">{model.name}</h3>
        </div>
      </Link>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-rule px-3 py-2 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-ink-muted">Gehäuse</dt>
          <dd className="num">{caseSize !== null ? `${caseSize.toLocaleString('de-DE')} mm` : '–'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-muted">Gewicht</dt>
          <dd className="num">{weight !== null ? `${weight.toLocaleString('de-DE')} g` : '–'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-muted">Akku</dt>
          <dd className="num">{battery !== null ? formatHours(battery) : '–'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-muted">Display</dt>
          <dd className="truncate text-right">
            <SpecValueView field={FIELD_BY_ID.get('displayType')!} value={model.specs.displayType} />
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2 border-t border-rule px-3 py-2">
        <Price price={model.price} prefix={model.variantCount > 1 ? 'ab' : undefined} />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleFavourite}
            aria-pressed={isFavourite}
            aria-label={`${model.name} ${isFavourite ? 'aus Favoriten entfernen' : 'zu Favoriten hinzufügen'}`}
            className={`border px-2 py-1 text-xs ${
              isFavourite ? 'border-mark text-mark' : 'border-rule text-ink-muted hover:text-ink'
            }`}
          >
            {isFavourite ? '★' : '☆'}
          </button>
          <button
            type="button"
            aria-pressed={selected}
            onClick={() => {
              const result = toggleSelection(model.id);
              if (result === 'refused') {
                onRefused(
                  `Es lassen sich höchstens ${MAX_COMPARE} Modelle vergleichen. Entferne zuerst eines aus der Auswahl.`,
                );
              }
            }}
            className={`border px-2 py-1 text-xs ${
              selected
                ? 'border-accent bg-accent text-[var(--accent-ink)]'
                : 'border-rule text-ink-muted hover:text-ink'
            }`}
          >
            {selected ? 'Im Vergleich' : 'Vergleichen'}
          </button>
        </div>
      </div>
    </article>
  );
}
