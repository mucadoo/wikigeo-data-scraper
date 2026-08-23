import { describe, it, expect } from 'vitest';
import { DataValidator } from '../src/scraper/utils/validator.js';
import { getEmptyCountry } from '../src/types/country.js';

describe('DataValidator', () => {
  it('should accept a valid country with all fields', () => {
    const validCountry = getEmptyCountry();
    validCountry.isoCode = 'US';
    validCountry.name = { en: 'USA', pt: 'EUA', fr: 'USA', it: 'USA', es: 'EEUU', de: 'USA', ja: '米国', ru: 'США', zh: '美国' };
    validCountry.description = { en: 'Desc', pt: 'Desc', fr: 'Desc', it: 'Desc', es: 'Desc', de: 'Desc', ja: 'Desc', ru: 'Desc', zh: 'Desc' };
    validCountry.population = 1000000;
    validCountry.areaKm2 = 50000;
    
    expect(() => DataValidator.validate(validCountry)).not.toThrow();
  });

  it('should throw if essential fields are missing', () => {
    const invalidCountry = getEmptyCountry();
    expect(() => DataValidator.validate(invalidCountry)).toThrow(/Quality Gate Failed/);
  });
});
