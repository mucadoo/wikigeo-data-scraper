import { describe, it, expect } from 'vitest';
import { ContinentSchema, getEmptyContinent } from '../src/types/continent.js';
import { CountrySchema, getEmptyCountry, LANGUAGES } from '../src/types/country.js';

describe('ContinentSchema', () => {
  it('getEmptyContinent satisfies the schema', () => {
    expect(() => ContinentSchema.parse(getEmptyContinent())).not.toThrow();
  });

  it('has a localized name and description covering every supported language', () => {
    const empty = getEmptyContinent();
    for (const lang of LANGUAGES) {
      expect(empty.name).toHaveProperty(lang);
      expect(empty.description).toHaveProperty(lang);
    }
  });

  it('accepts a fully populated continent', () => {
    const parsed = ContinentSchema.parse({
      ...getEmptyContinent(),
      code: 'EU',
      wikidataId: 'Q46',
      name: { ...getEmptyContinent().name, en: 'Europe' },
      description: { ...getEmptyContinent().description, en: 'A continent.' },
      population: 745000000,
      populationYear: 2023,
      populationSource: 'wikidata',
      areaKm2: 10180000,
      areaSource: 'wikidata',
      densityKm2: 73,
      countryCount: 2,
      countryIsoCodes: ['FR', 'DE'],
    });
    expect(parsed.code).toBe('EU');
  });

  it('rejects an unknown populationSource', () => {
    expect(ContinentSchema.safeParse({ ...getEmptyContinent(), populationSource: 'guess' }).success).toBe(false);
  });
});

describe('CountrySchema.continentCodes', () => {
  it('defaults to an empty array when omitted (back-compat with older payloads)', () => {
    const empty = getEmptyCountry();
    const { continentCodes, ...withoutCodes } = empty;
    void continentCodes;
    const parsed = CountrySchema.parse(withoutCodes);
    expect(parsed.continentCodes).toEqual([]);
  });

  it('round-trips a populated list (primary first)', () => {
    const parsed = CountrySchema.parse({ ...getEmptyCountry(), continentCodes: ['EU', 'AS'] });
    expect(parsed.continentCodes).toEqual(['EU', 'AS']);
  });
});
