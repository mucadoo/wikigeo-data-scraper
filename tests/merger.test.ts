import { describe, it, expect } from 'vitest';
import { mergeCountryData } from '../src/scraper/utils/merger.js';
import { getEmptyLocalizedField, Country } from '../src/types/country.js';

describe('mergeCountryData', () => {
  it('starts from an empty country when there is no existing record', () => {
    const merged = mergeCountryData(null, { isoCode: 'FR' });
    expect(merged.isoCode).toBe('FR');
    expect(merged.name).toEqual(getEmptyLocalizedField());
  });

  it('falls back to an empty country when the existing JSON is corrupt', () => {
    const merged = mergeCountryData('{not valid json', { isoCode: 'FR' });
    expect(merged.isoCode).toBe('FR');
  });

  describe('localized string fields (name, description)', () => {
    it('adds a new locale without touching locales already set', () => {
      const pass1 = mergeCountryData(null, { name: { ...getEmptyLocalizedField(), en: 'France' } });
      const pass2 = mergeCountryData(JSON.stringify(pass1), { name: { ...getEmptyLocalizedField(), fr: 'France' } });

      expect(pass2.name.en).toBe('France');
      expect(pass2.name.fr).toBe('France');
    });

    it('does not clobber an existing locale with a null value from a later pass', () => {
      const pass1 = mergeCountryData(null, { name: { ...getEmptyLocalizedField(), en: 'France' } });
      // Simulates a later pass that never touched `en` (still null in its own localized field).
      const pass2 = mergeCountryData(JSON.stringify(pass1), { name: { ...getEmptyLocalizedField(), fr: 'France' } });

      expect(pass2.name.en).toBe('France');
    });

    it('overwrites a locale when the new pass provides a non-null value for it', () => {
      const pass1 = mergeCountryData(null, { name: { ...getEmptyLocalizedField(), en: 'Old Name' } });
      const pass2 = mergeCountryData(JSON.stringify(pass1), { name: { ...getEmptyLocalizedField(), en: 'New Name' } });

      expect(pass2.name.en).toBe('New Name');
    });
  });

  describe('localized array fields (capital, currency, etc.)', () => {
    it('merges a new locale into an existing entry keyed by articleId', () => {
      const pass1 = mergeCountryData(null, {
        capital: [{ articleId: 'Paris', name: { ...getEmptyLocalizedField(), en: 'Paris' } }],
      });
      const pass2 = mergeCountryData(JSON.stringify(pass1), {
        capital: [{ articleId: 'Paris', name: { ...getEmptyLocalizedField(), fr: 'Paris' } }],
      });

      expect(pass2.capital).toHaveLength(1);
      expect(pass2.capital?.[0]).toMatchObject({
        articleId: 'Paris',
        name: expect.objectContaining({ en: 'Paris', fr: 'Paris' }),
      });
    });

    it('falls back to matching on name.en when neither entry has an articleId', () => {
      const pass1 = mergeCountryData(null, {
        government: [{ articleId: null, name: { ...getEmptyLocalizedField(), en: 'Republic' } }],
      });
      // The `text:` fallback key is derived from name.en, so a later pass must repeat the same
      // en value to land on the same key - it isn't matched by position or by any other locale.
      const pass2 = mergeCountryData(JSON.stringify(pass1), {
        government: [{ articleId: null, name: { ...getEmptyLocalizedField(), en: 'Republic', fr: 'République' } }],
      });

      expect(pass2.government).toHaveLength(1);
      expect(pass2.government?.[0].name.fr).toBe('République');
    });

    it('treats a differing name.en as a distinct entry when there is no articleId to key on', () => {
      const pass1 = mergeCountryData(null, {
        government: [{ articleId: null, name: { ...getEmptyLocalizedField(), en: 'Republic' } }],
      });
      const pass2 = mergeCountryData(JSON.stringify(pass1), {
        government: [{ articleId: null, name: { ...getEmptyLocalizedField(), fr: 'République' } }],
      });

      expect(pass2.government).toHaveLength(2);
    });

    it('keeps entries with different keys as separate items', () => {
      const pass1 = mergeCountryData(null, {
        currency: [{ articleId: 'Euro', name: { ...getEmptyLocalizedField(), en: 'Euro' }, isoCode: 'EUR' }],
      });
      const pass2 = mergeCountryData(JSON.stringify(pass1), {
        currency: [{ articleId: 'US Dollar', name: { ...getEmptyLocalizedField(), en: 'US Dollar' }, isoCode: 'USD' }],
      });

      expect(pass2.currency).toHaveLength(2);
    });

    it('updates isoCode on an array item only when the new pass provides one', () => {
      const pass1 = mergeCountryData(null, {
        currency: [{ articleId: 'Euro', name: { ...getEmptyLocalizedField(), en: 'Euro' }, isoCode: 'EUR' }],
      });
      const pass2 = mergeCountryData(JSON.stringify(pass1), {
        currency: [{ articleId: 'Euro', name: { ...getEmptyLocalizedField(), fr: 'Euro' } }] as Country['currency'],
      });

      // isoCode is `undefined` (not present) on the new item, so the existing value survives.
      expect(pass2.currency?.[0].isoCode).toBe('EUR');
    });
  });

  describe('root scalar/array fields', () => {
    it('overwrites root fields when the new pass has a truthy value', () => {
      const pass1 = mergeCountryData(null, { population: 100, areaKm2: 50 });
      const pass2 = mergeCountryData(JSON.stringify(pass1), { population: 200 });

      expect(pass2.population).toBe(200);
      expect(pass2.areaKm2).toBe(50);
    });

    it('does not clobber an existing root field with a falsy value from a later pass', () => {
      const pass1 = mergeCountryData(null, { population: 100, drivingSide: 'right' as const });
      const pass2 = mergeCountryData(JSON.stringify(pass1), { population: undefined, drivingSide: null });

      expect(pass2.population).toBe(100);
      expect(pass2.drivingSide).toBe('right');
    });

    it('only replaces callingCode/internetTld when the new array is non-empty', () => {
      const pass1 = mergeCountryData(null, { callingCode: ['+33'] });
      const pass2 = mergeCountryData(JSON.stringify(pass1), { callingCode: [] });

      expect(pass2.callingCode).toEqual(['+33']);
    });
  });
});
