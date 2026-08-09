import { describe, expect, it } from 'vitest';
import { assertImageHost, classifyImage, deriveThumb } from '../scripts/lib/images.js';

/* ------------------------------------------------------------------ */
/* 1.5 — thumbnail derivation, pinned to the shapes the CDN publishes  */
/* ------------------------------------------------------------------ */

const BASE = 'https://res.garmin.com/de_DE/products/010-02472-10/v';

describe('deriveThumb', () => {
  it('rewrites a plain -lg token', () => {
    expect(deriveThumb(`${BASE}/cf-lg.jpg`)).toBe(`${BASE}/cf-sm.jpg`);
  });

  it('rewrites the trailing token only, leaving numbered stems intact', () => {
    expect(deriveThumb(`${BASE}/pd-03-lg.jpg`)).toBe(`${BASE}/pd-03-sm.jpg`);
  });

  /**
   * The 88 UUID-suffixed names: their `-sm` sibling was probed and is a 404, so
   * deriving one would publish a URL guaranteed to break (design G2).
   */
  it('refuses a name whose -lg token is not trailing', () => {
    expect(deriveThumb(`${BASE}/cf-lg-b6111ea5-c9b9-496d-9dfc-571d2f63ad35.jpg`)).toBeNull();
  });

  it('refuses a name with no -lg token at all', () => {
    expect(deriveThumb(`${BASE}/cf.jpg`)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 1.6 — classification: host, extension, thumbnail                    */
/* ------------------------------------------------------------------ */

describe('classifyImage', () => {
  it('returns both renditions for a plain -lg image', () => {
    expect(classifyImage('1915560', `${BASE}/cf-lg.jpg`)).toEqual({
      full: `${BASE}/cf-lg.jpg`,
      thumb: `${BASE}/cf-sm.jpg`,
    });
  });

  it('keeps the full-size reference when no thumbnail can be named', () => {
    const url = `${BASE}/cf-lg-b6111ea5-c9b9-496d-9dfc-571d2f63ad35.jpg`;
    expect(classifyImage('1915560', url)).toEqual({ full: url, thumb: null });
  });

  /** The one non-image in the snapshot: it would render as a broken `<img>`. */
  it('drops a non-image asset', () => {
    const mp4 =
      'https://res.garmin.com/en/products/010-02778-00/g/sc-21-lg-60418_54493_Fenix7Pro_EpixPro_MM.v2-Garmin.Web.mp4';
    expect(classifyImage('010-02778-00', mp4)).toBeNull();
  });

  it('accepts png and webp alongside jpg', () => {
    expect(classifyImage('1915560', `${BASE}/cf-lg.png`)?.full).toBe(`${BASE}/cf-lg.png`);
    expect(classifyImage('1915560', `${BASE}/cf-lg.webp`)?.thumb).toBe(`${BASE}/cf-sm.webp`);
  });

  /** A foreign host stays fatal — dropping it silently would publish it. */
  it('still throws on a foreign host', () => {
    expect(() => classifyImage('1915560', 'https://cdn.example.com/v/cf-lg.jpg')).toThrow(
      /not on res\.garmin\.com/,
    );
    expect(() => assertImageHost('1915560', ['not-a-url'])).toThrow(/not absolute/);
  });
});
