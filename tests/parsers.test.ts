import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractBootstrap, selectSkusForProduct, specSku, productIdsOnPage } from '../scripts/ingest/bootstrap.js';
import { parseBoxContents, parseSpecTable } from '../scripts/ingest/specs.js';
import { buildRawProduct } from '../scripts/ingest/product.js';
import { normalizeRows } from '../scripts/normalize/normalize.js';
import { deriveLineage, generationRank } from '../scripts/normalize/lineage.js';
import {
  parseBatteryModes,
  parseDimensions,
  parseGermanNumber,
  parseMass,
  parseMillimetres,
  parseResolution,
  parseStorageGb,
  parseWaterRating,
} from '../scripts/normalize/parsers.js';
import { triState } from '../src/data/contract.js';
import { FIELD_IDS } from '../src/data/schema.js';
import { FIXTURES } from '../scripts/lib/paths.js';

const fixture = (name: string) => readFileSync(path.join(FIXTURES, name), 'utf8');

/* ------------------------------------------------------------------ */
/* 6.2 — block selection on a multi-model page                         */
/* ------------------------------------------------------------------ */

describe('bootstrap block selection', () => {
  const html = fixture('multi-model-bootstrap.html');
  const bootstrap = extractBootstrap(html);

  const FR170 = '1915560';
  const FR170_MUSIC = '2014513';
  const FR70 = '1941179';

  it('one page carries several models', () => {
    expect(productIdsOnPage(bootstrap).sort()).toEqual([FR170_MUSIC, FR70, FR170].sort());
  });

  it('selects only the requested model, never a sibling', () => {
    for (const id of [FR170, FR170_MUSIC, FR70]) {
      const skus = selectSkusForProduct(bootstrap, id);
      expect(skus.length).toBeGreaterThan(0);
      expect(skus.every((sku) => sku.productId === id)).toBe(true);
    }
  });

  it('refuses a product id the page does not carry', () => {
    expect(() => selectSkusForProduct(bootstrap, '999999')).toThrow(/no SKU for productId/);
  });

  /**
   * The hazard this whole test exists for: the Music model's spec table must
   * come from the Music block, never from the base 170 that sits beside it.
   */
  it('Forerunner 170 Music yields music-specific specs, the base 170 does not', () => {
    const music = normalizeRows(
      parseSpecTable(specSku(selectSkusForProduct(bootstrap, FR170_MUSIC))!.tabs!.specsTab!.content),
    ).specs;
    const base = normalizeRows(
      parseSpecTable(specSku(selectSkusForProduct(bootstrap, FR170))!.tabs!.specsTab!.content),
    ).specs;

    expect(triState(music.musicPlayback)).toBe('supported');
    expect(triState(music.musicStorage)).toBe('supported');

    // Garmin publishes neither row for the base model — which is "not published",
    // and must not be reported as "not supported".
    expect(triState(base.musicPlayback)).toBe('not-published');
    expect(triState(base.musicStorage)).toBe('not-published');
  });

  it('builds a complete raw product for a model whose own page 404s', () => {
    // Forerunner 70's own /p/ URL is currently a 404; it is only reachable
    // through the sibling page, which is exactly what this recovers.
    const product = buildRawProduct(FR70, 'Forerunner 70', bootstrap, {
      sourceUrl: 'https://www.garmin.com/de-DE/p/1915560/',
    });
    expect(product.id).toBe(FR70);
    expect(product.name).toContain('Forerunner');
    expect(product.specs.length).toBeGreaterThan(100);
    expect(product.variants.length).toBeGreaterThan(1);
    expect(product.variants.every((v) => /^\d{3}-\d{5}-\d{2}$/.test(v.partNumber))).toBe(true);
  });

  it('captures price with currency and box contents', () => {
    const skus = selectSkusForProduct(bootstrap, FR170);
    const product = buildRawProduct(FR170, 'Forerunner 170', bootstrap, { sourceUrl: 'https://x' });
    expect(product.price?.currency).toBe('EUR');
    expect(product.price?.amount).toBeGreaterThan(0);
    expect(parseBoxContents(specSku(skus)!.tabs!.inTheBoxTab!.content).length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* 6.3 — tri-state fidelity                                            */
/* ------------------------------------------------------------------ */

describe('tri-state', () => {
  const rows = parseSpecTable(fixture('qualified-and-negative-rows.html'));
  const specs = normalizeRows(rows).specs;

  it('reads a class="yes" marker as supported', () => {
    expect(triState(specs.garminPay)).toBe('supported');
  });

  it('reads a class="no" marker as unsupported, distinctly from absent', () => {
    expect(triState(specs.musicStorage)).toBe('unsupported');
  });

  it('reads a textual "Nein" as unsupported and keeps its qualifier', () => {
    expect(triState(specs.colorDisplay)).toBe('unsupported');
    expect(specs.colorDisplay).toMatchObject({ kind: 'flag', qualifier: '16 Graustufen' });
  });

  it('treats a row that never appears as not-published, never as unsupported', () => {
    // The fixture has no touchscreen and no LED flashlight row at all.
    expect(triState(specs.touchscreen)).toBe('not-published');
    expect(triState(specs.ledFlashlight)).toBe('not-published');
  });

  it('keeps the qualifier of an affirmative answer', () => {
    const row = rows.find((r) => r.label.startsWith('Herzfrequenz'))!;
    expect(row.valueKind).toBe('text');
    expect(row.value).toBe('Ja (über ANT+ oder BLE)');
  });

  it('gives every schema field an entry on every model', () => {
    for (const id of FIELD_IDS) expect(specs[id]).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/* 6.4 — battery modes                                                 */
/* ------------------------------------------------------------------ */

describe('battery mode parsing', () => {
  const rows = parseSpecTable(fixture('german-values.html'));
  const battery = normalizeRows(rows).specs.battery;

  it('splits every published mode', () => {
    expect(battery.kind).toBe('battery');
    if (battery.kind !== 'battery') return;
    expect(battery.modes.map((m) => m.label)).toEqual([
      'Smartwatch-Modus',
      'Energiespar-Modus',
      'GNSS-Modus nur mit GPS',
      'GPS-Modus ohne Musik',
      'Alle Satellitensysteme + Musik',
      'Expeditions-Modus',
    ]);
  });

  it('identifies the smartwatch mode and the GPS-only mode', () => {
    if (battery.kind !== 'battery') throw new Error('expected battery value');
    const byRole = (role: string) => battery.modes.filter((m) => m.role === role);

    expect(byRole('smartwatch').map((m) => m.hours)).toEqual([10 * 24]);
    expect(byRole('gps-only').map((m) => m.hours)).toEqual([20, 42]);
    expect(byRole('battery-saver').map((m) => m.hours)).toEqual([19 * 24]);
    expect(byRole('gps-music').map((m) => m.hours)).toEqual([8.5]);
    expect(byRole('expedition').map((m) => m.hours)).toEqual([31 * 24]);
  });

  it('keeps the upper-bound semantics rather than flattening them', () => {
    if (battery.kind !== 'battery') throw new Error('expected battery value');
    expect(battery.modes.every((m) => m.bound === 'up-to')).toBe(true);
  });

  it('drops the footnote line but keeps each mode source text', () => {
    if (battery.kind !== 'battery') throw new Error('expected battery value');
    expect(battery.modes.some((m) => m.sourceText.startsWith('*'))).toBe(false);
    expect(battery.modes[0].sourceText).toContain('Bis zu 10 Tage');
  });

  it('promotes the longest smartwatch and GPS figures to sortable fields', () => {
    const specs = normalizeRows(rows).specs;
    expect(specs.batterySmartwatchHours).toMatchObject({ value: 240, unit: 'h', bound: 'up-to' });
    expect(specs.batteryGpsHours).toMatchObject({ value: 42, unit: 'h' });
  });
});

/* ------------------------------------------------------------------ */
/* 6.5 — German number formats round-trip                              */
/* ------------------------------------------------------------------ */

describe('German number formats', () => {
  it('reads a decimal comma', () => {
    expect(parseGermanNumber('42,6')).toBe(42.6);
    expect(parseGermanNumber('8,5')).toBe(8.5);
    expect(parseGermanNumber('1.234,5')).toBe(1234.5);
  });

  it('reads a non-breaking space between number and unit', () => {
    expect(parseMass('41 g')).toMatchObject({ value: 41 });
    expect(parseMillimetres('30,4 mm (1,2-Zoll) Durchmesser')).toMatchObject({ value: 30.4 });
  });

  it('parses the dimension triple in every published spelling', () => {
    expect(parseDimensions('42,6 x 42,6 x 11,9 mm')).toEqual({
      widthMm: 42.6,
      heightMm: 42.6,
      thicknessMm: 11.9,
    });
    expect(parseDimensions('47 x 47 x 12,9 (mm)')).toEqual({
      widthMm: 47,
      heightMm: 47,
      thicknessMm: 12.9,
    });
    expect(parseDimensions('51mm x 51mm x 14,7 mm')).toEqual({
      widthMm: 51,
      heightMm: 51,
      thicknessMm: 14.7,
    });
    expect(parseDimensions('Durchmesser x Dicke: 46 x 15 mm')).toEqual({
      widthMm: 46,
      heightMm: 46,
      thicknessMm: 15,
    });
  });

  it('parses resolutions with and without spaces', () => {
    expect(parseResolution('390 x 390 Pixel')).toEqual({ width: 390, height: 390 });
    expect(parseResolution('454x454 Pixel')).toEqual({ width: 454, height: 454 });
  });

  it('parses water ratings', () => {
    expect(parseWaterRating('Schwimmen, 5 ATM')).toMatchObject({ standard: 'ATM', value: 5 });
    expect(parseWaterRating('10 ATM')).toMatchObject({ standard: 'ATM', value: 10 });
    expect(parseWaterRating('EN 13319')).toMatchObject({ standard: 'EN13319', value: null });
  });

  it('parses storage in GB and MB', () => {
    expect(parseStorageGb('4 GB')).toMatchObject({ value: 4 });
    expect(parseStorageGb('32 GB')).toMatchObject({ value: 32 });
    expect(parseStorageGb('16 MB')?.value).toBeCloseTo(16 / 1024, 5);
  });

  it('reads durations in German and in the untranslated English Garmin also ships', () => {
    expect(parseBatteryModes('Smartwatch-Modus: Bis zu 15 Tage')[0]).toMatchObject({
      hours: 360,
      bound: 'up-to',
    });
    expect(parseBatteryModes('Smartwatch: Up to 14 days (7 days always-on)')[0]).toMatchObject({
      hours: 336,
      role: 'smartwatch',
      bound: 'up-to',
    });
    expect(parseBatteryModes('Uhrmodus: Bis zu 10 Wochen')[0]).toMatchObject({
      hours: 1680,
      role: 'smartwatch',
    });
  });

  it('records a range as a range rather than as a single number', () => {
    const rows = parseSpecTable(fixture('german-values.html'));
    const wrist = normalizeRows(rows).specs.wristRange;
    expect(wrist).toMatchObject({ kind: 'text' });
    if (wrist.kind === 'text') expect(wrist.text).toContain('126-203 mm');
  });
});

/* ------------------------------------------------------------------ */
/* 6.1 — a model missing a whole spec section                          */
/* ------------------------------------------------------------------ */

describe('missing sections', () => {
  it('leaves fields of an absent section not-published', () => {
    const specs = normalizeRows(parseSpecTable(fixture('german-values.html'))).specs;
    // The fixture publishes no dive, music or payment section at all.
    expect(triState(specs.musicStorage)).toBe('not-published');
    expect(triState(specs.garminPay)).toBe('not-published');
    expect(triState(specs.lte)).toBe('not-published');
  });

  it('preserves section grouping and source order of the rows it does have', () => {
    const rows = parseSpecTable(fixture('german-values.html'));
    expect(rows[0].section).toBe('Allgemein');
    expect(rows[rows.length - 1].section).toBe('Sensoren');
    expect(rows.map((r) => r.order)).toEqual(rows.map((_, i) => i));
  });
});

/* ------------------------------------------------------------------ */
/* 5.5 — model identity and lineage                                    */
/* ------------------------------------------------------------------ */

describe('lineage', () => {
  it('splits family, generation and qualifier', () => {
    expect(deriveLineage('Forerunner 970')).toMatchObject({
      family: 'Forerunner',
      generation: '970',
      qualifier: null,
    });
    expect(deriveLineage('Forerunner 165 Music')).toMatchObject({
      family: 'Forerunner',
      generation: '165',
      qualifier: 'Music',
    });
    expect(deriveLineage('fēnix 8 Pro – 51 mm, MicroLED')).toMatchObject({
      family: 'fēnix',
      generation: '8 Pro',
      qualifier: '51 mm, MicroLED',
    });
    expect(deriveLineage('Descent Mk3i – 43 mm')).toMatchObject({
      family: 'Descent',
      generation: 'Mk3i',
      qualifier: '43 mm',
    });
  });

  it('ranks only designations that state a position, leaving the rest unordered', () => {
    expect(generationRank('970')).toBe(970);
    expect(generationRank('3S')).toBe(3);
    expect(generationRank('8 Pro')).toBe(8.5);
    expect(generationRank('Mk3i')).toBe(3);
    // A variant letter is not a sequence position.
    expect(generationRank('X1')).toBeNull();
    expect(generationRank('E')).toBeNull();
    expect(generationRank('Air X15')).toBeNull();
  });
});
