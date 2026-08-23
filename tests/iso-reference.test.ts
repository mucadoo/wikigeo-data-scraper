import { describe, it, expect } from 'vitest';
import { isValidIso2, getIsoReference, getBorderingIsoCodes, getCommonName } from '../src/scraper/utils/iso-reference.js';

describe('isValidIso2', () => {
  it('accepts a real ISO 3166-1 alpha-2 code', () => {
    expect(isValidIso2('US')).toBe(true);
  });

  it('rejects a code that is not assigned', () => {
    expect(isValidIso2('ZZ')).toBe(false);
  });

  it('rejects null and undefined without throwing', () => {
    expect(isValidIso2(null)).toBe(false);
    expect(isValidIso2(undefined)).toBe(false);
  });
});

describe('getIsoReference', () => {
  it('resolves alpha-3, numeric, and continent for a known code', () => {
    expect(getIsoReference('US')).toEqual({
      isoCode3: 'USA',
      isoNumeric: '840',
      continent: 'North America',
    });
  });

  it('returns nulls for a code with no continent mapping', () => {
    // Valid per the ISO library (unassigned/exceptionally-reserved region) but absent from
    // this project's own CONTINENT_BY_ISO2 curation.
    const ref = getIsoReference('AQ');
    expect(ref.continent).toBeNull();
  });
});

describe('getBorderingIsoCodes', () => {
  it('returns the single land neighbor for a country with one border', () => {
    expect(getBorderingIsoCodes('PT')).toEqual(['ES']);
  });

  it('returns an empty array for an island nation with no land borders', () => {
    expect(getBorderingIsoCodes('IS')).toEqual([]);
  });

  it('returns an empty array for an unknown code', () => {
    expect(getBorderingIsoCodes('ZZ')).toEqual([]);
  });
});

describe('getCommonName', () => {
  it('resolves the English common name for a known code', () => {
    expect(getCommonName('US')).toBe('United States');
  });

  it('returns null for an unknown code', () => {
    expect(getCommonName('ZZ')).toBeNull();
  });
});
