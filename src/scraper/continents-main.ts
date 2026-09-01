import Database from 'better-sqlite3';
import { Continent, getEmptyContinent } from '../types/continent.js';
import { Country, LANGUAGES, getEmptyLocalizedField } from '../types/country.js';
import { isValidIso2 } from './utils/iso-reference.js';
import { CONTINENTS, continentCodesForIso2 } from './utils/continents.js';
import { fetchContinentFacts } from './utils/continent-enrich.js';
import { mergeContinentData } from './utils/continent-merger.js';
import { WikipediaAPI } from './utils/wikipedia-api.js';
import { parseDescriptionFromWikitext } from './parsers/wikitext-description.js';
import { writeContinentOutputs, patchCountryContinentCodes } from './utils/continent-output.js';

const db = new Database('scraper.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS continents (
    code TEXT PRIMARY KEY,
    data TEXT
  )
`);

const upsert = db.prepare('INSERT OR REPLACE INTO continents (code, data) VALUES (?, ?)');
const getRow = db.prepare('SELECT data FROM continents WHERE code = ?');

const TRANSLATION_LANGS = LANGUAGES.filter(l => l !== 'en');

/** Fills an English fallback then copies it into any language the source pass left empty. */
function localizedWithFallback(src: Partial<Record<string, string | null>>, enFallback?: string | null): ReturnType<typeof getEmptyLocalizedField> {
  const field = getEmptyLocalizedField();
  for (const lang of LANGUAGES) field[lang] = src[lang] || null;
  field.en = field.en || enFallback || null;
  for (const lang of TRANSLATION_LANGS) field[lang] = field[lang] || field.en;
  return field;
}

/**
 * TextExtracts strips inline IPA/pronunciation spans but leaves the punctuation that wrapped
 * them, so a lead like "Antarctica (/…/) is…" comes back as "Antarctica ( ) is…". Drop the
 * now-empty parenthetical (and any stray space before terminal punctuation it leaves behind).
 */
function tidyExtract(text: string): string {
  return text
    .replace(/\s*\(\s*[;,]?\s*\)/g, '')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

interface CountryAggregate {
  isoCodes: string[];
  population: number;
  areaKm2: number;
}

/**
 * Groups this dataset's published countries by continent code, summing population + area.
 * A contiguous transcontinental country (RU, TR, KZ, AZ, GE, EG) is counted under every
 * continent it belongs to — the sums are only a fallback for continents Wikidata has no
 * figure for, so the modest double-counting at the margins is acceptable.
 */
function aggregateByContinent(): Record<string, CountryAggregate> {
  const map: Record<string, CountryAggregate> = {};
  let rows: { data: string }[];
  try {
    rows = db.prepare('SELECT data FROM countries').all() as { data: string }[];
  } catch {
    console.error('No `countries` table found - run the country scraper first.');
    return map;
  }
  for (const row of rows) {
    let country: Country;
    try {
      country = JSON.parse(row.data) as Country;
    } catch {
      continue;
    }
    if (!isValidIso2(country.isoCode)) continue;
    for (const code of continentCodesForIso2(country.isoCode)) {
      const agg = (map[code] ||= { isoCodes: [], population: 0, areaKm2: 0 });
      agg.isoCodes.push(country.isoCode);
      if (country.population) agg.population += country.population;
      if (country.areaKm2) agg.areaKm2 += country.areaKm2;
    }
  }
  return map;
}

async function run() {
  const continentArg = process.argv.find(a => a.startsWith('--continent='));
  const only = continentArg
    ? new Set(continentArg.split('=')[1].split(',').map(c => c.trim().toUpperCase()))
    : undefined;

  const registry = CONTINENTS.filter(c => !only || only.has(c.code));
  if (registry.length === 0) {
    console.error('No continents selected. Aborting.');
    process.exit(1);
  }

  // 1. STRUCTURED FACTS (Wikidata)
  const facts = await fetchContinentFacts(registry.map(c => c.wikidataId));

  // 2. DESCRIPTIONS (Wikipedia article intros, per language). Continent leads carry heavy
  // pronunciation / footnote templates, so take the clean TextExtracts intro first and only
  // fall back to wikitext parsing when the extract is missing.
  const descriptionsByLang: Record<string, Record<string, string>> = {};
  for (const lang of LANGUAGES) {
    const titles = Array.from(new Set(
      registry.map(c => facts[c.wikidataId]?.sitelinks?.[lang]).filter((t): t is string => !!t),
    ));
    if (titles.length === 0) continue;
    descriptionsByLang[lang] = {};

    const extractByTitle = await WikipediaAPI.fetchExtractsBatch(titles, lang);
    for (const [title, extract] of Object.entries(extractByTitle)) {
      if (extract) descriptionsByLang[lang][title] = tidyExtract(extract);
    }

    const missing = titles.filter(t => !descriptionsByLang[lang][t]);
    if (missing.length > 0) {
      const wikitextByTitle = await WikipediaAPI.fetchWikitextBatch(missing, lang);
      for (const [title, wikitext] of Object.entries(wikitextByTitle)) {
        if (descriptionsByLang[lang][title]) continue;
        try {
          const parsed = parseDescriptionFromWikitext(wikitext);
          if (parsed) descriptionsByLang[lang][title] = parsed;
        } catch { /* leave undefined */ }
      }
    }
  }

  // 3. ASSEMBLE + PERSIST
  const aggregates = aggregateByContinent();

  for (const entry of registry) {
    const f = facts[entry.wikidataId];
    const agg = aggregates[entry.code];
    const continent: Continent = { ...getEmptyContinent(), code: entry.code, wikidataId: entry.wikidataId };

    continent.name = localizedWithFallback(f?.name || {}, f?.sitelinks?.en || entry.name);

    const description = getEmptyLocalizedField();
    for (const lang of LANGUAGES) {
      const title = f?.sitelinks?.[lang];
      const text = title ? descriptionsByLang[lang]?.[title] : undefined;
      if (text) description[lang] = text;
    }
    for (const lang of TRANSLATION_LANGS) description[lang] = description[lang] || description.en;
    continent.description = description;

    continent.coordinates = f?.coordinates || null;

    // Population / area: Wikidata first, aggregate of member countries as a fallback.
    if (f?.population) {
      continent.population = f.population;
      continent.populationYear = f.populationYear;
      continent.populationSource = 'wikidata';
    } else if (agg && agg.population > 0) {
      continent.population = agg.population;
      continent.populationYear = null;
      continent.populationSource = 'aggregate';
    }

    if (f?.areaKm2) {
      continent.areaKm2 = f.areaKm2;
      continent.areaSource = 'wikidata';
    } else if (agg && agg.areaKm2 > 0) {
      continent.areaKm2 = parseFloat(agg.areaKm2.toFixed(2));
      continent.areaSource = 'aggregate';
    }

    if (continent.population && continent.areaKm2 && continent.areaKm2 > 0) {
      // Antarctica's ~5k population over ~14M km² rounds to 0.00; only keep a real density.
      const density = parseFloat((continent.population / continent.areaKm2).toFixed(2));
      continent.densityKm2 = density > 0 ? density : null;
    }

    continent.countryIsoCodes = (agg?.isoCodes || []).slice().sort();
    continent.countryCount = continent.countryIsoCodes.length;

    const existing = getRow.get(entry.code) as { data: string } | undefined;
    const merged = mergeContinentData(existing?.data || null, continent);
    upsert.run(entry.code, JSON.stringify(merged));
  }

  // 4. WRITE OUTPUT FILES
  const all = (db.prepare('SELECT data FROM continents').all() as { data: string }[])
    .map(r => JSON.parse(r.data) as Continent);
  writeContinentOutputs(all);
  patchCountryContinentCodes(all);
}

run().catch(err => {
  console.error('Continent scraper failed completely:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
