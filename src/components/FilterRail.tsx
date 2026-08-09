import { useId } from 'react';
import type { CatalogModel } from '../data/contract';
import { FACET_FIELDS, FIELD_BY_ID } from '../data/schema';
import { useCatalogState, type RangeFilter } from '../app/state';
import {
  facetOptions,
  facetValue,
  flagFacetCount,
  numericValue,
  type MatchContext,
} from '../lib/catalog';

/**
 * The filter rail (task 8.2).
 *
 * Facets come from the normalized schema — `facet: true` in `src/data/schema.ts`
 * — so a new filterable field appears here by declaring it, not by editing this
 * component. Every option carries the count of models it would match given the
 * *other* active filters (`catalog-browse` — filter option counts).
 */

const RANGE_FACETS: Array<{ field: string; label: string; unit: string; step?: number }> = [
  { field: 'price', label: 'Preis', unit: '€', step: 10 },
  { field: 'caseSize', label: 'Gehäusedurchmesser', unit: 'mm' },
  { field: 'weight', label: 'Gewicht', unit: 'g' },
  { field: 'batterySmartwatchHours', label: 'Akku (Smartwatch)', unit: 'h' },
];

const TEXT_FACETS = ['displayType', 'waterRating', 'lensMaterial'] as const;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-rule py-3">
      <h3 className="display mb-2 text-xs uppercase tracking-[0.12em] text-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

function CheckOption({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-baseline gap-2 py-0.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-[var(--accent)]"
        disabled={count === 0 && !checked}
      />
      <span className={count === 0 && !checked ? 'text-ink-muted' : ''}>{label}</span>
      <span className="num ml-auto text-xs text-ink-muted">{count}</span>
    </label>
  );
}

function RangeInputs({
  label,
  unit,
  step,
  bounds,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  step?: number;
  bounds: { min: number; max: number } | null;
  value: RangeFilter | undefined;
  onChange: (next: RangeFilter | null) => void;
}) {
  const id = useId();
  if (!bounds) return null;

  const commit = (patch: RangeFilter) => {
    const next = { ...value, ...patch };
    if (next.min === undefined && next.max === undefined) onChange(null);
    else onChange(next);
  };

  return (
    <div className="py-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm">{label}</span>
        <span className="num text-[11px] text-ink-muted">
          {bounds.min.toLocaleString('de-DE')}–{bounds.max.toLocaleString('de-DE')} {unit}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={`${id}-min`}
          type="number"
          inputMode="numeric"
          step={step}
          placeholder="min"
          aria-label={`${label} Minimum in ${unit}`}
          value={value?.min ?? ''}
          onChange={(event) =>
            commit({ min: event.target.value === '' ? undefined : Number(event.target.value) })
          }
          className="num w-full border border-rule bg-panel px-2 py-1 text-sm"
        />
        <span aria-hidden="true" className="text-ink-muted">
          –
        </span>
        <input
          id={`${id}-max`}
          type="number"
          inputMode="numeric"
          step={step}
          placeholder="max"
          aria-label={`${label} Maximum in ${unit}`}
          value={value?.max ?? ''}
          onChange={(event) =>
            commit({ max: event.target.value === '' ? undefined : Number(event.target.value) })
          }
          className="num w-full border border-rule bg-panel px-2 py-1 text-sm"
        />
      </div>
    </div>
  );
}

export function FilterRail({
  models,
  families,
  context,
}: {
  models: CatalogModel[];
  families: string[];
  context: MatchContext;
}) {
  const { state, toggleFamily, toggleFlag, toggleText, setRange, update, clearFilters } =
    useCatalogState();

  const familyOptions = facetOptions(models, state, context, 'family', (m) => m.lineage.family, 'family');
  const knownFamilies = new Set(familyOptions.map((option) => option.value));
  for (const family of families) if (!knownFamilies.has(family)) familyOptions.push({ value: family, count: 0, active: false });

  const bounds = (field: string) => {
    const values = models
      .map((model) => numericValue(model, field))
      .filter((value): value is number => value !== null);
    if (values.length === 0) return null;
    return { min: Math.floor(Math.min(...values)), max: Math.ceil(Math.max(...values)) };
  };

  const flagFields = FACET_FIELDS.filter((field) => field.kind === 'flag');

  return (
    <div className="text-ink">
      <div className="flex items-center justify-between border-b border-rule pb-2">
        <h2 className="display text-sm">Filter</h2>
        <button
          type="button"
          onClick={clearFilters}
          className="border border-rule px-2 py-1 text-xs text-ink-muted hover:text-ink"
        >
          Alle zurücksetzen
        </button>
      </div>

      <Group title="Favoriten">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.favouritesOnly}
            onChange={() => update({ favouritesOnly: !state.favouritesOnly })}
            className="accent-[var(--accent)]"
          />
          Nur Favoriten anzeigen
          <span className="num ml-auto text-xs text-ink-muted">{context.favourites.length}</span>
        </label>
      </Group>

      <Group title="Familie">
        <div className="max-h-64 overflow-y-auto pr-1">
          {familyOptions.map((option) => (
            <CheckOption
              key={option.value}
              label={option.value}
              count={option.count}
              checked={state.families.includes(option.value)}
              onChange={() => toggleFamily(option.value)}
            />
          ))}
        </div>
      </Group>

      <Group title="Werte">
        {RANGE_FACETS.map((facet) => (
          <RangeInputs
            key={facet.field}
            label={facet.label}
            unit={facet.unit}
            step={facet.step}
            bounds={bounds(facet.field)}
            value={state.ranges[facet.field]}
            onChange={(next) => setRange(facet.field, next)}
          />
        ))}
      </Group>

      {TEXT_FACETS.map((field) => {
        const options = facetOptions(
          models,
          state,
          context,
          field,
          (model) => facetValue(model, field),
          `text:${field}`,
        );
        if (options.length === 0) return null;
        return (
          <Group key={field} title={FIELD_BY_ID.get(field)?.label ?? field}>
            <div className="max-h-56 overflow-y-auto pr-1">
              {options.map((option) => (
                <CheckOption
                  key={option.value}
                  label={option.value}
                  count={option.count}
                  checked={(state.texts[field] ?? []).includes(option.value)}
                  onChange={() => toggleText(field, option.value)}
                />
              ))}
            </div>
          </Group>
        );
      })}

      <Group title="Funktionen">
        {flagFields.map((field) => (
          <CheckOption
            key={field.id}
            label={field.label}
            count={flagFacetCount(models, state, context, field.id)}
            checked={state.flags.includes(field.id)}
            onChange={() => toggleFlag(field.id)}
          />
        ))}
      </Group>
    </div>
  );
}
