import fs from 'fs';
import { Continent, ContinentSchema, getEmptyContinent } from '../../types/continent.js';
import { LANGUAGES } from '../../types/country.js';
import { CONTINENT_BY_CODE, continentCodesForIso2 } from './continents.js';

const DATA_DIR = 'data';
const API_DIR = 'data/api/v1';
const CONTINENT_API_DIR = `${API_DIR}/continents`;
const COUNTRY_API_DIR = `${API_DIR}/countries`;

/**
 * A continent ships only if it has a known two-letter code, a name + English description,
 * and at least one of population / area. Missing "nice to have" fields (coordinates,
 * density) never drop a row.
 */
export function isPublishable(continent: Continent): boolean {
  const parse = ContinentSchema.safeParse(continent);
  if (!parse.success) return false;
  const c = parse.data;
  if (!CONTINENT_BY_CODE[c.code]) return false;
  if (!c.name.en) return false;
  if (!c.description.en) return false;
  if (!c.population && !c.areaKm2) return false;
  return true;
}

type LocalizedRecord = Record<(typeof LANGUAGES)[number], string | null>;

const fillLocalized = (loc: LocalizedRecord): LocalizedRecord => {
  const out = { ...loc };
  for (const lang of LANGUAGES) out[lang] = out[lang] || out.en || null;
  return out;
};

function normalize(continent: Continent): Continent {
  const c: Continent = { ...getEmptyContinent(), ...continent };
  for (const field of ['name', 'description'] as const) {
    c[field] = fillLocalized(c[field]);
  }
  c.countryIsoCodes = [...c.countryIsoCodes].sort();
  c.countryCount = c.countryIsoCodes.length;
  if (c.population && c.areaKm2 && c.areaKm2 > 0) {
    c.densityKm2 = parseFloat((c.population / c.areaKm2).toFixed(2));
  }
  return c;
}

export function writeContinentOutputs(raw: Continent[]): void {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  const continents = raw
    .map(normalize)
    .filter(c => {
      if (isPublishable(c)) return true;
      console.error(`Dropping continent ${c.code || '(no code)'} (${c.name?.en || 'Unknown'}): failed publish gate`);
      return false;
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  console.log(`Publishing ${continents.length} continents.`);

  const output = {
    metadata: {
      generatedAt: new Date().toISOString(),
      version: pkg.version,
      license: pkg.license,
      source: 'Wikidata + Wikipedia',
      count: continents.length,
    },
    data: continents,
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(`${DATA_DIR}/continents.json`, JSON.stringify(output, null, 2));
  fs.writeFileSync(`${DATA_DIR}/continents.min.json`, JSON.stringify(output));

  fs.mkdirSync(CONTINENT_API_DIR, { recursive: true });
  const index = continents.map(({ code, name, countryCount }) => ({ code, name, countryCount }));
  fs.writeFileSync(`${CONTINENT_API_DIR}/index.json`, JSON.stringify(index, null, 2));
  fs.writeFileSync(`${CONTINENT_API_DIR}/all.json`, JSON.stringify(continents, null, 2));
  for (const continent of continents) {
    fs.writeFileSync(`${CONTINENT_API_DIR}/${continent.code}.json`, JSON.stringify(continent, null, 2));
  }

  // Per-country pointer: api/v1/countries/{ISO}/continents.json — an array, since contiguous
  // transcontinental states (RU, TR, KZ, AZ, GE, EG) belong to two continents.
  const byCode = new Map(continents.map(c => [c.code, c]));
  const isos = new Set(continents.flatMap(c => c.countryIsoCodes));
  for (const iso of isos) {
    const list = publishedContinentCodes(iso, continents)
      .map(code => byCode.get(code))
      .filter((c): c is Continent => !!c);
    if (list.length === 0) continue;
    fs.mkdirSync(`${COUNTRY_API_DIR}/${iso}`, { recursive: true });
    fs.writeFileSync(`${COUNTRY_API_DIR}/${iso}/continents.json`, JSON.stringify(list, null, 2));
  }
}

/**
 * The static continent codes for a country (primary first), keeping only those whose
 * continent was actually published in this run.
 */
function publishedContinentCodes(iso: string, published: Continent[]): string[] {
  const publishedSet = new Set(published.map(c => c.code));
  return continentCodesForIso2(iso).filter(code => publishedSet.has(code));
}

/** Two-letter continent codes (primary first) keyed by member-country ISO 3166-1 alpha-2 code. */
export function continentCodesByCountry(raw: Continent[]): Record<string, string[]> {
  const published = raw.map(normalize).filter(isPublishable);
  const isos = new Set(published.flatMap(c => c.countryIsoCodes));
  const map: Record<string, string[]> = {};
  for (const iso of isos) {
    const codes = publishedContinentCodes(iso, published);
    if (codes.length > 0) map[iso] = codes;
  }
  return map;
}

interface CountryRecord { isoCode: string | null; continent?: string | null; continentCode?: unknown; continentCodes?: string[]; [k: string]: unknown }

/**
 * Stamps `continent` (primary name) and `continentCodes` onto the already-generated country
 * output files, in place. The country scraper already derives both from the same static
 * mapping, so this is a belt-and-suspenders pass that also covers country files produced by
 * the standalone `post-process` script (which skips ISO-reference enrichment and would
 * otherwise leave the continent fields empty).
 */
export function patchCountryContinentCodes(raw: Continent[]): void {
  const codesByCountry = continentCodesByCountry(raw);
  const mainFile = `${DATA_DIR}/sovereign-states.json`;
  if (!fs.existsSync(mainFile)) {
    console.warn(`${mainFile} not found - skipping country continent patch.`);
    return;
  }

  const bundle = JSON.parse(fs.readFileSync(mainFile, 'utf8')) as { metadata?: unknown; data: CountryRecord[] };
  let patched = 0;
  for (const country of bundle.data) {
    const codes = (country.isoCode && codesByCountry[country.isoCode]) || [];
    country.continentCodes = codes;
    delete country.continentCode; // drop the old singular field if a stale file carries it
    if (codes.length > 0) {
      // Primary code's canonical name (the same value `getIsoReference` derives), so the
      // country's `continent` string always agrees with the country pipeline.
      country.continent = CONTINENT_BY_CODE[codes[0]]?.name || country.continent || null;
      patched++;
    }
  }

  fs.writeFileSync(mainFile, JSON.stringify(bundle, null, 2));
  fs.writeFileSync(`${DATA_DIR}/sovereign-states.min.json`, JSON.stringify(bundle));
  fs.writeFileSync(`${API_DIR}/all.json`, JSON.stringify(bundle.data, null, 2));
  for (const country of bundle.data) {
    if (country.isoCode) {
      fs.writeFileSync(`${COUNTRY_API_DIR}/${country.isoCode}.json`, JSON.stringify(country, null, 2));
    }
  }
  console.log(`Patched continent + continentCodes onto ${patched} countries.`);
}
