import { describe, it, expect } from 'vitest';
import { SubdivisionSchema, getEmptySubdivision } from '../src/types/subdivision.js';
import { CountrySchema, getEmptyCountry, LANGUAGES } from '../src/types/country.js';

describe('SubdivisionSchema', () => {
  it('getEmptySubdivision satisfies the schema', () => {
    expect(() => SubdivisionSchema.parse(getEmptySubdivision())).not.toThrow();
  });

  it('has a localized name and type covering every supported language', () => {
    const empty = getEmptySubdivision();
    for (const lang of LANGUAGES) {
      expect(empty.name).toHaveProperty(lang);
      expect(empty.type).toHaveProperty(lang);
      expect(empty.description).toHaveProperty(lang);
    }
  });

  it('defaults level to 1 and parentCode to null for older payloads', () => {
    const { level, parentCode, ...legacy } = getEmptySubdivision();
    void level; void parentCode;
    const parsed = SubdivisionSchema.parse({ ...legacy, code: 'US-CA', countryIsoCode: 'US' });
    expect(parsed.level).toBe(1);
    expect(parsed.parentCode).toBeNull();
  });

  it('accepts a level-2 subdivision with a parentCode', () => {
    const parsed = SubdivisionSchema.parse({
      ...getEmptySubdivision(), code: 'IT-MI', countryIsoCode: 'IT', level: 2, parentCode: 'IT-25',
    });
    expect(parsed.level).toBe(2);
    expect(parsed.parentCode).toBe('IT-25');
  });

  it('accepts a fully populated subdivision', () => {
    const parsed = SubdivisionSchema.parse({
      ...getEmptySubdivision(),
      code: 'US-CA',
      wikidataId: 'Q99',
      countryIsoCode: 'US',
      name: { ...getEmptySubdivision().name, en: 'California' },
      typeEn: 'state',
      population: 39000000,
      populationYear: 2020,
      areaKm2: 423967,
      densityKm2: 92,
      coordinates: { lat: 37, lng: -120 },
    });
    expect(parsed.code).toBe('US-CA');
  });
});

describe('CountrySchema.subdivisionCodes', () => {
  it('defaults to an empty array when omitted (back-compat with older payloads)', () => {
    const empty = getEmptyCountry();
    const { subdivisionCodes, ...withoutCodes } = empty;
    void subdivisionCodes;
    const parsed = CountrySchema.parse(withoutCodes);
    expect(parsed.subdivisionCodes).toEqual([]);
  });

  it('round-trips a populated list', () => {
    const parsed = CountrySchema.parse({ ...getEmptyCountry(), subdivisionCodes: ['US-CA', 'US-NY'] });
    expect(parsed.subdivisionCodes).toEqual(['US-CA', 'US-NY']);
  });
});
