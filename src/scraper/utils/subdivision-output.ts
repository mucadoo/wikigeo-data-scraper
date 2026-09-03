import fs from 'fs';
import { Subdivision, SubdivisionSchema, getEmptySubdivision } from '../../types/subdivision.js';
import { LANGUAGES } from '../../types/country.js';
import { isValidIso2 } from './iso-reference.js';

const DATA_DIR = 'data';
const API_DIR = 'data/api/v1';
const SUBDIVISION_API_DIR = `${API_DIR}/subdivisions`;
const COUNTRY_API_DIR = `${API_DIR}/countries`;

/**
 * A subdivision ships only if it has a well-formed ISO 3166-2 code, a known parent country,
 * a name + English description, and at least one of population / area. Missing "nice to have"
 * fields (capital, coordinates, flag, density) never drop a row.
 */
export function isPublishable(sub: Subdivision): boolean {
  const parse = SubdivisionSchema.safeParse(sub);
  if (!parse.success) return false;
  const s = parse.data;
  if (!/^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(s.code)) return false;
  if (!isValidIso2(s.countryIsoCode) || !s.code.startsWith(`${s.countryIsoCode}-`)) return false;
  if (!s.name.en) return false;
  if (!s.description.en) return false;
  if (!s.population && !s.areaKm2) return false;
  return true;
}

type LocalizedRecord = Record<(typeof LANGUAGES)[number], string | null>;

const fillLocalized = (loc: LocalizedRecord): LocalizedRecord => {
  const out = { ...loc };
  for (const lang of LANGUAGES) out[lang] = out[lang] || out.en || null;
  return out;
};

function normalize(sub: Subdivision): Subdivision {
  const s: Subdivision = { ...getEmptySubdivision(), ...sub };
  // Guarantee every localized field is filled in every language (English fallback).
  for (const field of ['name', 'type', 'description'] as const) {
    s[field] = fillLocalized(s[field]);
  }
  for (const link of [...(s.capital || []), ...s.officialLanguage, ...s.borders]) {
    link.name = fillLocalized(link.name);
  }
  if (s.population && s.areaKm2 && s.areaKm2 > 0 && !s.densityKm2) {
    s.densityKm2 = parseFloat((s.population / s.areaKm2).toFixed(2));
  }
  return s;
}

export function writeSubdivisionOutputs(raw: Subdivision[]): void {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  const subdivisions = raw
    .map(normalize)
    .filter(s => {
      if (isPublishable(s)) return true;
      console.error(`Dropping subdivision ${s.code || '(no code)'} (${s.name?.en || 'Unknown'}): failed publish gate`);
      return false;
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  console.log(`Publishing ${subdivisions.length} subdivisions.`);

  const output = {
    metadata: {
      generatedAt: new Date().toISOString(),
      version: pkg.version,
      license: pkg.license,
      source: 'Wikidata + Wikipedia',
      count: subdivisions.length,
    },
    data: subdivisions,
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(`${DATA_DIR}/subdivisions.json`, JSON.stringify(output, null, 2));
  fs.writeFileSync(`${DATA_DIR}/subdivisions.min.json`, JSON.stringify(output));

  fs.mkdirSync(SUBDIVISION_API_DIR, { recursive: true });
  const index = subdivisions.map(({ code, countryIsoCode, level, parentCode, name, flagUrl }) =>
    ({ code, countryIsoCode, level, parentCode, name, flagUrl }));
  fs.writeFileSync(`${SUBDIVISION_API_DIR}/index.json`, JSON.stringify(index, null, 2));
  fs.writeFileSync(`${SUBDIVISION_API_DIR}/all.json`, JSON.stringify(subdivisions, null, 2));
  for (const sub of subdivisions) {
    fs.writeFileSync(`${SUBDIVISION_API_DIR}/${sub.code}.json`, JSON.stringify(sub, null, 2));
  }

  // Per-country rollup: api/v1/countries/{ISO}/subdivisions.json
  const byCountry: Record<string, Subdivision[]> = {};
  for (const sub of subdivisions) {
    (byCountry[sub.countryIsoCode] ||= []).push(sub);
  }
  for (const [iso, subs] of Object.entries(byCountry)) {
    fs.mkdirSync(`${COUNTRY_API_DIR}/${iso}`, { recursive: true });
    fs.writeFileSync(`${COUNTRY_API_DIR}/${iso}/subdivisions.json`, JSON.stringify(subs, null, 2));
  }
}

/**
 * First-level ISO 3166-2 codes grouped by parent country ISO 3166-1 alpha-2 code. Second-level
 * units are reachable from the subdivisions dataset (filter by `countryIsoCode` + `level`) or
 * by following `parentCode`, so `Country.subdivisionCodes` stays a flat first-level list.
 */
export function subdivisionCodesByCountry(raw: Subdivision[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const sub of raw.map(normalize)) {
    if (sub.level !== 1) continue;
    if (!isPublishable(sub)) continue;
    (map[sub.countryIsoCode] ||= []).push(sub.code);
  }
  for (const iso of Object.keys(map)) map[iso].sort();
  return map;
}

interface CountryRecord { isoCode: string | null; subdivisionCodes?: string[]; [k: string]: unknown }

/**
 * Stamps `subdivisionCodes` onto the already-generated country output files, in place. Run
 * after both the country scrape (which produces the enriched files) and the subdivision
 * scrape, so the country dataset references its subdivisions without a full re-process that
 * would drop the country pipeline's Wikidata/World Bank enrichment.
 */
export function patchCountrySubdivisionCodes(raw: Subdivision[]): void {
  const codesByCountry = subdivisionCodesByCountry(raw);
  const mainFile = `${DATA_DIR}/sovereign-states.json`;
  if (!fs.existsSync(mainFile)) {
    console.warn(`${mainFile} not found - skipping country subdivisionCodes patch.`);
    return;
  }

  const bundle = JSON.parse(fs.readFileSync(mainFile, 'utf8')) as { metadata?: unknown; data: CountryRecord[] };
  let patched = 0;
  for (const country of bundle.data) {
    const codes = (country.isoCode && codesByCountry[country.isoCode]) || [];
    country.subdivisionCodes = codes;
    if (codes.length) patched++;
  }

  fs.writeFileSync(mainFile, JSON.stringify(bundle, null, 2));
  fs.writeFileSync(`${DATA_DIR}/sovereign-states.min.json`, JSON.stringify(bundle));
  fs.writeFileSync(`${API_DIR}/all.json`, JSON.stringify(bundle.data, null, 2));
  for (const country of bundle.data) {
    if (country.isoCode) {
      fs.writeFileSync(`${COUNTRY_API_DIR}/${country.isoCode}.json`, JSON.stringify(country, null, 2));
    }
  }
  console.log(`Patched subdivisionCodes onto ${patched} countries.`);
}
