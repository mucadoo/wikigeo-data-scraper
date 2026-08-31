import { describe, it, expect } from 'vitest';
import { mergeContinentData } from '../src/scraper/utils/continent-merger.js';
import { getEmptyContinent } from '../src/types/continent.js';

describe('mergeContinentData', () => {
  it('never lets a partial-language pass erase locales an earlier pass supplied', () => {
    const first = mergeContinentData(null, {
      ...getEmptyContinent(),
      code: 'EU',
      name: { ...getEmptyContinent().name, en: 'Europe', pt: 'Europa' },
      description: { ...getEmptyContinent().description, en: 'A continent.' },
    });

    const second = mergeContinentData(JSON.stringify(first), {
      ...getEmptyContinent(),
      code: 'EU',
      name: { ...getEmptyContinent().name, fr: 'Europe' },
    });

    expect(second.name.en).toBe('Europe');
    expect(second.name.pt).toBe('Europa');
    expect(second.name.fr).toBe('Europe');
    expect(second.description.en).toBe('A continent.');
  });

  it('overwrites scalar fields only when the incoming pass carries a value', () => {
    const first = mergeContinentData(null, {
      ...getEmptyContinent(), code: 'EU', population: 745000000, populationSource: 'wikidata', areaKm2: 10180000,
    });
    const merged = mergeContinentData(JSON.stringify(first), {
      ...getEmptyContinent(), code: 'EU', populationYear: 2023, countryCount: 44, countryIsoCodes: ['FR', 'DE'],
    });
    expect(merged.population).toBe(745000000);
    expect(merged.populationSource).toBe('wikidata');
    expect(merged.areaKm2).toBe(10180000);
    expect(merged.populationYear).toBe(2023);
    expect(merged.countryIsoCodes).toEqual(['FR', 'DE']);
  });

  it('keeps a zero population figure from the incoming pass out (falsy) but respects explicit values', () => {
    const first = mergeContinentData(null, { ...getEmptyContinent(), code: 'OC', population: 42000000 });
    const merged = mergeContinentData(JSON.stringify(first), { ...getEmptyContinent(), code: 'OC' });
    expect(merged.population).toBe(42000000);
  });
});
