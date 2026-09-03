import { describe, it, expect } from 'vitest';
import { isPublishable, subdivisionCodesByCountry } from '../src/scraper/utils/subdivision-output.js';
import { getEmptySubdivision, Subdivision } from '../src/types/subdivision.js';

const base = (over: Partial<Subdivision>): Subdivision => ({
  ...getEmptySubdivision(),
  code: 'US-CA',
  countryIsoCode: 'US',
  name: { ...getEmptySubdivision().name, en: 'California' },
  description: { ...getEmptySubdivision().description, en: 'A US state.' },
  population: 39000000,
  ...over,
});

describe('isPublishable', () => {
  it('accepts a subdivision with code, country, name.en, description.en and population', () => {
    expect(isPublishable(base({}))).toBe(true);
  });

  it('accepts area in place of population', () => {
    expect(isPublishable(base({ population: null, areaKm2: 423967 }))).toBe(true);
  });

  it('rejects malformed ISO 3166-2 codes', () => {
    expect(isPublishable(base({ code: 'US-CALIF' }))).toBe(false);
  });

  it('rejects a code whose country prefix disagrees with countryIsoCode', () => {
    expect(isPublishable(base({ code: 'CA-CA' }))).toBe(false);
  });

  it('rejects when both population and area are missing', () => {
    expect(isPublishable(base({ population: null, areaKm2: null }))).toBe(false);
  });

  it('rejects a missing English description', () => {
    expect(isPublishable(base({ description: getEmptySubdivision().description }))).toBe(false);
  });
});

describe('subdivisionCodesByCountry', () => {
  it('groups publishable codes by parent country, sorted', () => {
    const map = subdivisionCodesByCountry([
      base({ code: 'US-NY' }),
      base({ code: 'US-CA' }),
      base({ code: 'FR-ARA', countryIsoCode: 'FR' }),
      base({ code: 'US-BAD-CODE', population: null, areaKm2: null }),
    ]);
    expect(map).toEqual({ US: ['US-CA', 'US-NY'], FR: ['FR-ARA'] });
  });

  it('excludes level-2 subdivisions - Country.subdivisionCodes is first-level only', () => {
    const map = subdivisionCodesByCountry([
      base({ code: 'IT-25', countryIsoCode: 'IT' }),
      base({ code: 'IT-MI', countryIsoCode: 'IT', level: 2, parentCode: 'IT-25' }),
      base({ code: 'IT-BG', countryIsoCode: 'IT', level: 2, parentCode: 'IT-25' }),
    ]);
    expect(map).toEqual({ IT: ['IT-25'] });
  });
});
