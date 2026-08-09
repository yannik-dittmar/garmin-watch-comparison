import { describe, expect, it } from 'vitest';
import { FIELD_BY_ID, formatDuration, formatValue } from '../src/data/schema.js';
import type { NormalizedValue } from '../src/data/contract.js';

/**
 * Durations are stored in hours because that is what sorts and charts, but
 * "240 h" is not a figure anyone can feel. Every view reads them through
 * `formatDuration`, so the rules live here once.
 */

describe('formatDuration', () => {
  it('leaves anything under a day in hours', () => {
    expect(formatDuration(8.5)).toBe('8,5 h');
    expect(formatDuration(23)).toBe('23 h');
  });

  it('writes whole days as days', () => {
    expect(formatDuration(24)).toBe('1 Tag');
    expect(formatDuration(240)).toBe('10 Tage');
    expect(formatDuration(1680)).toBe('70 Tage');
  });

  it('keeps the remainder that fills no further day in hours', () => {
    expect(formatDuration(42)).toBe('1 Tag 18 h');
    expect(formatDuration(250)).toBe('10 Tage 10 h');
    expect(formatDuration(36.5)).toBe('1 Tag 12,5 h');
  });

  /** The remainder is rounded before it is written, never up to a full day. */
  it('never presents a remainder as 24 h', () => {
    expect(formatDuration(47.98)).toBe('2 Tage');
  });
});

describe('formatValue for hour-valued fields', () => {
  const smartwatch = FIELD_BY_ID.get('batterySmartwatchHours')!;
  const gps = FIELD_BY_ID.get('batteryGpsHours')!;

  const hours = (value: number, extra: Partial<Extract<NormalizedValue, { kind: 'number' }>> = {}) =>
    ({ kind: 'number', value, unit: 'h', bound: 'exact', source: '', ...extra }) as NormalizedValue;

  it('reads the stored hours as days, with no stray unit', () => {
    expect(formatValue(smartwatch, hours(240))).toBe('10 Tage');
    expect(formatValue(gps, hours(42))).toBe('1 Tag 18 h');
  });

  it('keeps the published bound in front of the readable figure', () => {
    expect(formatValue(smartwatch, hours(336, { bound: 'up-to' }))).toBe('bis zu 14 Tage');
  });

  it('renders both ends of a range', () => {
    expect(formatValue(smartwatch, hours(240, { bound: 'range', max: 480 }))).toBe(
      '10 Tage–20 Tage',
    );
  });

  it('leaves other units alone', () => {
    expect(formatValue(FIELD_BY_ID.get('weight')!, hours(53, { unit: 'g' }))).toBe('53 g');
    expect(formatValue(FIELD_BY_ID.get('caseSize')!, hours(47, { unit: 'mm' }))).toBe('47 mm');
  });

  it('summarises the battery block in the same phrasing', () => {
    const battery: NormalizedValue = {
      kind: 'battery',
      source: '',
      modes: [
        {
          id: 'smartwatch',
          label: 'Smartwatch',
          role: 'smartwatch',
          hours: 250,
          bound: 'up-to',
          solar: false,
          sourceText: 'Bis zu 10 Tage 10 Stunden',
        },
      ],
    };
    expect(formatValue(FIELD_BY_ID.get('battery')!, battery)).toBe('10 Tage 10 h (Smartwatch)');
  });
});
