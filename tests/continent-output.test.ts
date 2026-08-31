import { describe, it, expect } from 'vitest';
import { isPublishable, continentCodeByCountry } from '../src/scraper/utils/continent-output.js';
import { getEmptyContinent, Continent } from '../src/types/continent.js';

const base = (over: Partial<Continent>): Continent => ({
  ...getEmptyContinent(),
  code: 'EU',
  name: { ...getEmptyContinent().name, en: 'Europe' },
  description: { ...getEmptyContinent().description, en: 'A continent.' },
  population: 745000000,
  countryIsoCodes: ['FR', 'DE'],
  countryCount: 2,
  ...over,
});

describe('isPublishable', () => {
  it('accepts a continent with a known code, name.en, description.en and population', () => {
    expect(isPublishable(base({}))).toBe(true);
  });

  it('accepts area in place of population', () => {
    expect(isPublishable(base({ population: null, areaKm2: 10180000 }))).toBe(true);
  });

  it('rejects an unknown continent code', () => {
    expect(isPublishable(base({ code: 'ZZ' }))).toBe(false);
  });

  it('rejects when both population and area are missing', () => {
    expect(isPublishable(base({ population: null, areaKm2: null }))).toBe(false);
  });

  it('rejects a missing English description', () => {
    expect(isPublishable(base({ description: getEmptyContinent().description }))).toBe(false);
  });
});

describe('continentCodeByCountry', () => {
  it('maps each member country to its continent code', () => {
    const map = continentCodeByCountry([
      base({ code: 'EU', countryIsoCodes: ['FR', 'DE'] }),
      base({ code: 'AS', name: { ...getEmptyContinent().name, en: 'Asia' }, countryIsoCodes: ['JP'] }),
      base({ code: 'ZZ', countryIsoCodes: ['XX'] }), // unpublishable, skipped
    ]);
    expect(map).toEqual({ FR: 'EU', DE: 'EU', JP: 'AS' });
  });
});
