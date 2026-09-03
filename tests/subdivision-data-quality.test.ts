import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SubdivisionSchema, Subdivision } from '../src/types/subdivision.js';
import { Country, LANGUAGES } from '../src/types/country.js';

// These checks run against the generated build artifacts, which only exist after the
// scraper has run (locally: `npm run scrape:subdivisions`; in CI: the publish workflow).
const subdivisionsPath = path.join(process.cwd(), 'data/subdivisions.min.json');
const countriesPath = path.join(process.cwd(), 'data/sovereign-states.min.json');

const loadSubdivisions = (): Subdivision[] =>
  JSON.parse(fs.readFileSync(subdivisionsPath, 'utf8')).data as Subdivision[];
const loadCountries = (): Country[] =>
  JSON.parse(fs.readFileSync(countriesPath, 'utf8')).data as Country[];

describe('Subdivision data quality', () => {
  it.skipIf(fs.existsSync(subdivisionsPath))('skipped: data/subdivisions.min.json not generated yet', () => {});

  it.runIf(fs.existsSync(subdivisionsPath))('has a non-trivial number of subdivisions', () => {
    expect(loadSubdivisions().length).toBeGreaterThan(500);
  });

  it.runIf(fs.existsSync(subdivisionsPath))('every row satisfies SubdivisionSchema', () => {
    const bad = loadSubdivisions().filter(s => !SubdivisionSchema.safeParse(s).success).map(s => s.code);
    expect(bad).toEqual([]);
  });

  it.runIf(fs.existsSync(subdivisionsPath))('every code is a well-formed ISO 3166-2 code whose prefix matches countryIsoCode', () => {
    const bad = loadSubdivisions()
      .filter(s => !/^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(s.code) || !s.code.startsWith(`${s.countryIsoCode}-`))
      .map(s => s.code);
    expect(bad).toEqual([]);
  });

  it.runIf(fs.existsSync(subdivisionsPath))('codes are unique', () => {
    const seen = new Set<string>();
    const dupes = loadSubdivisions().filter(s => seen.size === seen.add(s.code).size).map(s => s.code);
    expect(dupes).toEqual([]);
  });

  it.runIf(fs.existsSync(subdivisionsPath))('name and description are populated in every supported language', () => {
    const gaps: string[] = [];
    for (const s of loadSubdivisions()) {
      for (const lang of LANGUAGES) {
        if (!s.name[lang]) gaps.push(`${s.code} name.${lang}`);
        if (!s.description[lang]) gaps.push(`${s.code} description.${lang}`);
        // type is optional, but when present it must cover every language
        if (s.typeEn && !s.type[lang]) gaps.push(`${s.code} type.${lang}`);
      }
    }
    expect(gaps).toEqual([]);
  });

  it.runIf(fs.existsSync(subdivisionsPath))('contains no <ref> tags or unresolved wikilinks in text fields', () => {
    // `]]` legitimately appears in the JSON structure, so only look for markup openers.
    const hasMarkup = (v: unknown): boolean => typeof v === 'string' && /<ref[\s>/]|\[\[/.test(v);
    const dirty = loadSubdivisions()
      .filter(s => [
        ...Object.values(s.name), ...Object.values(s.type), ...Object.values(s.description),
        ...(s.capital || []).flatMap(c => Object.values(c.name)),
      ].some(hasMarkup))
      .map(s => s.code);
    expect(dirty).toEqual([]);
  });

  it.runIf(fs.existsSync(subdivisionsPath))('population, area and density are non-negative when present', () => {
    const bad = loadSubdivisions()
      .filter(s => (s.population ?? 0) < 0 || (s.areaKm2 ?? 0) < 0 || (s.densityKm2 ?? 0) < 0)
      .map(s => s.code);
    expect(bad).toEqual([]);
  });

  it.runIf(fs.existsSync(subdivisionsPath))('includes both administrative levels', () => {
    const byLevel = new Map<number, number>();
    for (const s of loadSubdivisions()) byLevel.set(s.level, (byLevel.get(s.level) ?? 0) + 1);
    expect(byLevel.get(1) ?? 0).toBeGreaterThan(500);
    expect(byLevel.get(2) ?? 0).toBeGreaterThan(100);
  });

  it.runIf(fs.existsSync(subdivisionsPath))('level-1 rows carry no parentCode; level-2 parentCode resolves to a level-1 row', () => {
    const subs = loadSubdivisions();
    const level1 = new Set(subs.filter(s => s.level === 1).map(s => s.code));
    const bad: string[] = [];
    for (const s of subs) {
      if (s.level === 1 && s.parentCode) bad.push(`${s.code}: level-1 with parentCode ${s.parentCode}`);
      if (s.level === 2 && s.parentCode && !level1.has(s.parentCode)) {
        bad.push(`${s.code}: parentCode ${s.parentCode} is not a published level-1 subdivision`);
      }
    }
    expect(bad).toEqual([]);
  });
});

const haveBoth = fs.existsSync(subdivisionsPath) && fs.existsSync(countriesPath);

describe('Country / subdivision cross-reference', () => {
  it.skipIf(haveBoth)('skipped: both build artifacts not present yet', () => {});

  it.runIf(haveBoth)('every code in a country.subdivisionCodes resolves to a published subdivision', () => {
    const published = new Set(loadSubdivisions().map(s => s.code));
    const dangling: string[] = [];
    for (const c of loadCountries()) {
      for (const code of c.subdivisionCodes || []) {
        if (!published.has(code)) dangling.push(`${c.isoCode} -> ${code}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it.runIf(haveBoth)('every published first-level subdivision whose country is in the dataset is listed on that country', () => {
    const byCountry = new Map(loadCountries().map(c => [c.isoCode, new Set(c.subdivisionCodes || [])]));
    const orphans = loadSubdivisions()
      .filter(s => s.level === 1 && byCountry.has(s.countryIsoCode) && !byCountry.get(s.countryIsoCode)!.has(s.code))
      .map(s => s.code);
    expect(orphans).toEqual([]);
  });

  it.runIf(haveBoth)('country.subdivisionCodes never references a second-level subdivision', () => {
    const level2 = new Set(loadSubdivisions().filter(s => s.level === 2).map(s => s.code));
    const leaked: string[] = [];
    for (const c of loadCountries()) {
      for (const code of c.subdivisionCodes || []) {
        if (level2.has(code)) leaked.push(`${c.isoCode} -> ${code}`);
      }
    }
    expect(leaked).toEqual([]);
  });
});
