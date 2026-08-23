import { describe, it, expect } from 'vitest';
import { parseCountryFromWikitext } from '../src/scraper/parsers/wikitext-country-parser.js';
import { mergeCountryData } from '../src/scraper/utils/merger.js';
import { getEmptyCountry } from '../src/types/country.js';

// Verifies that per-language parses of the same country compose into one localized record,
// which is the core behavior the scraper pipeline (src/scraper/main.ts) relies on. Uses small
// inline wikitext fixtures rather than live Wikipedia snapshots, so it runs fully offline.
describe('multi-language merge pipeline', () => {
  const enWikitext = `
{{Infobox country
| iso3166code = FR
| population_estimate = 68,000,000
| area_km2 = 551,695
}}
'''France''' is a country primarily located in Western Europe.
`;

  const frWikitext = `
{{Infobox Pays
| population_estimate = 68 000 000
}}
La '''France''' est un pays d'Europe de l'Ouest.
`;

  it('merges the English and French passes into one localized country record', () => {
    const enData = parseCountryFromWikitext(enWikitext, 'en');
    const frData = parseCountryFromWikitext(frWikitext, 'fr');

    let country = mergeCountryData(null, { ...enData, name: { ...getEmptyCountry().name, en: 'France' } });
    country = mergeCountryData(JSON.stringify(country), { ...frData, name: { ...getEmptyCountry().name, fr: 'France' } });

    expect(country.isoCode).toBe('FR');
    expect(country.name.en).toBe('France');
    expect(country.name.fr).toBe('France');
    expect(country.description.en).toContain('Western Europe');
    expect(country.description.fr).toContain("d'Europe de l'Ouest");
    // The French pass must not clobber fields it didn't provide.
    expect(country.areaKm2).toBe(551695);
  });
});
