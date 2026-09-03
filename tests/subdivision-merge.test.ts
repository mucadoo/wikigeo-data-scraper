import { describe, it, expect } from 'vitest';
import { mergeSubdivisionData } from '../src/scraper/utils/subdivision-merger.js';
import { getEmptySubdivision } from '../src/types/subdivision.js';

describe('mergeSubdivisionData', () => {
  it('never lets a partial-language pass erase locales an earlier pass supplied', () => {
    const first = mergeSubdivisionData(null, {
      ...getEmptySubdivision(),
      code: 'US-CA',
      countryIsoCode: 'US',
      name: { ...getEmptySubdivision().name, en: 'California', pt: 'Califórnia' },
      description: { ...getEmptySubdivision().description, en: 'A US state.' },
    });

    const second = mergeSubdivisionData(JSON.stringify(first), {
      ...getEmptySubdivision(),
      code: 'US-CA',
      countryIsoCode: 'US',
      name: { ...getEmptySubdivision().name, fr: 'Californie' },
    });

    expect(second.name.en).toBe('California');
    expect(second.name.pt).toBe('Califórnia');
    expect(second.name.fr).toBe('Californie');
    expect(second.description.en).toBe('A US state.');
  });

  it('merges capital entries by articleId and overlays new locales', () => {
    const first = mergeSubdivisionData(null, {
      ...getEmptySubdivision(),
      code: 'US-CA',
      countryIsoCode: 'US',
      capital: [{ articleId: 'Q34647', name: { ...getEmptySubdivision().name, en: 'Sacramento' } }],
    });
    const merged = mergeSubdivisionData(JSON.stringify(first), {
      ...getEmptySubdivision(),
      code: 'US-CA',
      countryIsoCode: 'US',
      capital: [{ articleId: 'Q34647', name: { ...getEmptySubdivision().name, ja: 'サクラメント' } }],
    });
    expect(merged.capital).toHaveLength(1);
    expect(merged.capital?.[0].name.en).toBe('Sacramento');
    expect(merged.capital?.[0].name.ja).toBe('サクラメント');
  });

  it('merges officialLanguage and borders arrays by articleId', () => {
    const first = mergeSubdivisionData(null, {
      ...getEmptySubdivision(),
      code: 'US-CA', countryIsoCode: 'US',
      officialLanguage: [{ articleId: 'Q1860', name: { ...getEmptySubdivision().name, en: 'English' } }],
      borders: [{ articleId: 'Q1522', code: 'US-OR', name: { ...getEmptySubdivision().name, en: 'Oregon' } }],
    });
    const merged = mergeSubdivisionData(JSON.stringify(first), {
      ...getEmptySubdivision(),
      code: 'US-CA', countryIsoCode: 'US',
      officialLanguage: [{ articleId: 'Q1860', name: { ...getEmptySubdivision().name, fr: 'anglais' } }],
      borders: [{ articleId: 'Q1509', code: 'US-NV', name: { ...getEmptySubdivision().name, en: 'Nevada' } }],
    });
    expect(merged.officialLanguage).toHaveLength(1);
    expect(merged.officialLanguage[0].name.en).toBe('English');
    expect(merged.officialLanguage[0].name.fr).toBe('anglais');
    expect(merged.borders.map(b => b.code).sort()).toEqual(['US-NV', 'US-OR']);
  });

  it('carries level and parentCode, clearing parentCode when a pass marks the row level 1', () => {
    const l2 = mergeSubdivisionData(null, {
      ...getEmptySubdivision(), code: 'IT-MI', countryIsoCode: 'IT', level: 2, parentCode: 'IT-25',
    });
    expect(l2.level).toBe(2);
    expect(l2.parentCode).toBe('IT-25');

    // A later pass that only fills a locale must not disturb level / parentCode.
    const kept = mergeSubdivisionData(JSON.stringify(l2), {
      ...getEmptySubdivision(), code: 'IT-MI', countryIsoCode: 'IT', level: 2,
      name: { ...getEmptySubdivision().name, it: 'Milano' },
    });
    expect(kept.level).toBe(2);
    expect(kept.parentCode).toBe('IT-25');

    // Re-classifying the row as level 1 drops the stale parentCode.
    const promoted = mergeSubdivisionData(JSON.stringify(l2), {
      ...getEmptySubdivision(), code: 'IT-MI', countryIsoCode: 'IT', level: 1,
    });
    expect(promoted.level).toBe(1);
    expect(promoted.parentCode).toBeNull();
  });

  it('overwrites scalar fields only when the incoming pass carries a value', () => {
    const first = mergeSubdivisionData(null, { ...getEmptySubdivision(), code: 'US-CA', countryIsoCode: 'US', population: 39000000, areaKm2: 423967 });
    const merged = mergeSubdivisionData(JSON.stringify(first), { ...getEmptySubdivision(), code: 'US-CA', countryIsoCode: 'US', populationYear: 2020 });
    expect(merged.population).toBe(39000000);
    expect(merged.areaKm2).toBe(423967);
    expect(merged.populationYear).toBe(2020);
  });
});
