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

describe('CountrySchema.continentCode', () => {
  it('defaults to null when omitted (back-compat with older payloads)', () => {
    const empty = getEmptyCountry();
    const { continentCode, ...withoutCode } = empty;
    void continentCode;
    const parsed = CountrySchema.parse(withoutCode);
    expect(parsed.continentCode).toBeNull();
  });

  it('round-trips a populated code', () => {
    const parsed = CountrySchema.parse({ ...getEmptyCountry(), continentCode: 'EU' });
    expect(parsed.continentCode).toBe('EU');
  });
});
