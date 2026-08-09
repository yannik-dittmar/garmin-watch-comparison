import { classifyProduct, cleanName, fold } from '../lib/families.js';
import type { ModelLineage } from '../../src/data/contract.js';

/**
 * Model identity and lineage (task 5.5).
 *
 * Family, generation, and the size/edition qualifier are three separate
 * attributes, derived from the only thing Garmin publishes about lineage: the
 * product name. Nothing is inferred beyond what the name states — a model whose
 * generation cannot be read stays `null` and is shown unordered rather than
 * placed at a guessed position (`spec-visualization` — ungradeable models).
 *
 * The identifier is Garmin's own product id, so it survives re-runs unchanged
 * and URLs referring to a model stay valid.
 */

/** Separators Garmin uses between a model and its size/edition qualifier. */
const QUALIFIER_SPLIT = /\s*(?:[–—|]|(?<=\s)-(?=\s)|,)\s*/;

/**
 * Generation designations seen in the catalog: plain numbers (`970`, `8`),
 * numbers with a size letter (`7X`, `265S`), single letters (`E`), dive `Mk`
 * numbering, `Mach 2`, and the named MARQ editions.
 */
const GENERATION_TOKEN = new RegExp(
  '^(' +
    'Mk\\d+\\w*' +
    '|Mach\\s*\\d+' +
    '|Crossover' +
    '|Air\\s*X\\d+' +
    '|\\d+[A-Za-z]*' +
    '|[A-Z]\\d+' +
    '|[A-Z](?![a-z])' +
    '|Athlete|Aviator|Captain|Commander|Golfer|Adventurer|Expedition' +
    '|Trend|Sport|Style|Luxe|Classic' +
    ')',
);

/** Suffixes that belong to the generation rather than to the qualifier. */
const GENERATION_SUFFIX = /^\s*(Pro|Plus|\(Gen\s*\d+\))/i;

export function deriveLineage(name: string): ModelLineage {
  const clean = cleanName(name);
  const family = classifyProduct(clean).family;

  if (!family) {
    return { family: 'Sonstige', generation: null, generationRank: null, qualifier: null };
  }

  // Remove the family prefix without assuming its exact spelling (fēnix/fenix).
  const foldedFamily = fold(family);
  const words = clean.split(' ');
  let consumed = 0;
  for (let i = 1; i <= words.length; i++) {
    if (fold(words.slice(0, i).join(' ')) === foldedFamily) {
      consumed = i;
      break;
    }
  }
  const rest = words.slice(consumed || 1).join(' ').trim();

  const [head = '', ...tailParts] = rest.split(QUALIFIER_SPLIT);
  const tail = tailParts.filter(Boolean).join(', ');

  const token = GENERATION_TOKEN.exec(head.trim());
  if (!token) {
    const qualifier = [head, tail].filter(Boolean).join(', ').trim() || null;
    return { family, generation: null, generationRank: null, qualifier };
  }

  let generation = token[0].trim();
  let remainder = head.trim().slice(token[0].length);
  let suffix = GENERATION_SUFFIX.exec(remainder);
  while (suffix) {
    generation = `${generation} ${suffix[1]}`.replace(/\s+/g, ' ');
    remainder = remainder.slice(suffix[0].length);
    suffix = GENERATION_SUFFIX.exec(remainder);
  }

  const qualifier = [remainder.trim(), tail].filter(Boolean).join(', ').trim() || null;

  return {
    family,
    generation,
    generationRank: generationRank(generation),
    qualifier,
  };
}

/**
 * Rank used to order a family's ladder. It is the numeric part of the generation
 * designation — Garmin publishes no release dates, so designation order is the
 * only ordering its own data supports (design D7). A designation with no number
 * yields `null`, and those models are shown as unordered.
 */
export function generationRank(generation: string | null): number | null {
  if (!generation) return null;

  // Only two designations actually carry an order: a leading number (`970`,
  // `8 Pro`, `3S`) and the dive series' `Mk` numbering. Anything else — `X1`,
  // `E`, `Air X15`, `Mach 2` — states a variant, not a position in a sequence,
  // and guessing one from the digits it happens to contain would put Venu X1
  // ahead of Venu 3 on no evidence at all.
  const leading = generation.match(/^(\d+)/);
  const mk = generation.match(/^Mk(\d+)/i);
  const number = leading?.[1] ?? mk?.[1];
  if (!number) return null;

  let rank = Number(number);
  // A `Pro` sits above the plain generation it derives from, below the next one.
  if (/\bPro\b/i.test(generation)) rank += 0.5;
  return rank;
}
