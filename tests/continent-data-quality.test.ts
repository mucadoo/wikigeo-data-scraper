import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ContinentSchema, Continent } from '../src/types/continent.js';
import { Country, LANGUAGES } from '../src/types/country.js';
import { CONTINENT_BY_CODE } from '../src/scraper/utils/continents.js';

// These checks run against the generated build artifacts, which only exist after the
// scraper has run (locally: `npm run scrape:continents`; in CI: the publish workflow).
const continentsPath = path.join(process.cwd(), 'data/continents.min.json');
const countriesPath = path.join(process.cwd(), 'data/sovereign-states.min.json');

const loadContinents = (): Continent[] =>
  JSON.parse(fs.readFileSync(continentsPath, 'utf8')).data as Continent[];
const loadCountries = (): Country[] =>
  JSON.parse(fs.readFileSync(countriesPath, 'utf8')).data as Country[];

describe('Continent data quality', () => {
  it.skipIf(fs.existsSync(continentsPath))('skipped: data/continents.min.json not generated yet', () => {});

  it.runIf(fs.existsSync(continentsPath))('publishes all six continents', () => {
    expect(loadContinents().map(c => c.code).sort()).toEqual(['AF', 'AS', 'EU', 'NA', 'OC', 'SA']);
  });

  it.runIf(fs.existsSync(continentsPath))('every row satisfies ContinentSchema with a known code', () => {
    const bad = loadContinents().filter(c => !ContinentSchema.safeParse(c).success || !CONTINENT_BY_CODE[c.code]).map(c => c.code);
    expect(bad).toEqual([]);
  });

  it.runIf(fs.existsSync(continentsPath))('name and description are populated in every supported language', () => {
    const gaps: string[] = [];
    for (const c of loadContinents()) {
      for (const lang of LANGUAGES) {
        if (!c.name[lang]) gaps.push(`${c.code} name.${lang}`);
        if (!c.description[lang]) gaps.push(`${c.code} description.${lang}`);
      }
    }
    expect(gaps).toEqual([]);
  });

  it.runIf(fs.existsSync(continentsPath))('contains no <ref> tags or unresolved wikilinks in text fields', () => {
    const hasMarkup = (v: unknown): boolean => typeof v === 'string' && /<ref[\s>/]|\[\[/.test(v);
    const dirty = loadContinents()
      .filter(c => [...Object.values(c.name), ...Object.values(c.description)].some(hasMarkup))
      .map(c => c.code);
    expect(dirty).toEqual([]);
  });

  it.runIf(fs.existsSync(continentsPath))('population, area and density are positive when present', () => {
    const bad = loadContinents()
      .filter(c => (c.population ?? 1) <= 0 || (c.areaKm2 ?? 1) <= 0 || (c.densityKm2 ?? 1) <= 0)
      .map(c => c.code);
    expect(bad).toEqual([]);
  });

  it.runIf(fs.existsSync(continentsPath))('countryCount matches countryIsoCodes length and every code is non-empty', () => {
    const bad = loadContinents()
      .filter(c => c.countryCount !== c.countryIsoCodes.length || c.countryIsoCodes.length === 0)
      .map(c => c.code);
    expect(bad).toEqual([]);
  });
});

const haveBoth = fs.existsSync(continentsPath) && fs.existsSync(countriesPath);

describe('Country / continent cross-reference', () => {
  it.skipIf(haveBoth)('skipped: both build artifacts not present yet', () => {});

  it.runIf(haveBoth)('every country continentCode resolves to a published continent', () => {
    const published = new Set(loadContinents().map(c => c.code));
    const dangling = loadCountries()
      .flatMap(c => (c.continentCodes || []).map(code => ({ iso: c.isoCode, code })))
      .filter(x => !published.has(x.code))
      .map(x => `${x.iso} -> ${x.code}`);
    expect(dangling).toEqual([]);
  });

  it.runIf(haveBoth)('every country on a continent has continent and a non-empty continentCodes', () => {
    const memberIsos = new Set(loadContinents().flatMap(c => c.countryIsoCodes));
    const gaps = loadCountries()
      .filter(c => memberIsos.has(c.isoCode as string) && (!c.continent || !(c.continentCodes || []).length))
      .map(c => c.isoCode);
    expect(gaps).toEqual([]);
  });

  it.runIf(haveBoth)('country.continent is the name of the primary (first) continentCodes entry', () => {
    const nameByCode = new Map(loadContinents().map(c => [c.code, c.name.en]));
    const bad = loadCountries()
      .filter(c => (c.continentCodes || []).length > 0 && c.continent !== nameByCode.get(c.continentCodes[0]))
      .map(c => `${c.isoCode}: ${c.continent} vs ${c.continentCodes[0]}`);
    expect(bad).toEqual([]);
  });

  it.runIf(haveBoth)('continent.countryIsoCodes and country.continentCodes agree both ways', () => {
    const countries = loadCountries();
    const codesByIso = new Map(countries.map(c => [c.isoCode, new Set(c.continentCodes || [])]));
    const mismatches: string[] = [];
    for (const continent of loadContinents()) {
      for (const iso of continent.countryIsoCodes) {
        if (!codesByIso.get(iso)?.has(continent.code)) mismatches.push(`${continent.code} lists ${iso}`);
      }
    }
    const isoInContinent = new Map(loadContinents().map(c => [c.code, new Set(c.countryIsoCodes)]));
    for (const country of countries) {
      for (const code of country.continentCodes || []) {
        if (!isoInContinent.get(code)?.has(country.isoCode as string)) {
          mismatches.push(`${country.isoCode} claims ${code}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it.runIf(haveBoth)('the six contiguous transcontinental states are on two continents', () => {
    const byIso = new Map(loadCountries().map(c => [c.isoCode, c.continentCodes || []]));
    for (const [iso, expected] of [
      ['RU', ['EU', 'AS']], ['TR', ['AS', 'EU']], ['KZ', ['AS', 'EU']],
      ['AZ', ['AS', 'EU']], ['GE', ['AS', 'EU']], ['EG', ['AF', 'AS']],
    ] as const) {
      expect(byIso.get(iso)).toEqual(expected);
    }
  });
});
