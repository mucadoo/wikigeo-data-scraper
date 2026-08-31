import Database from 'better-sqlite3';
import { Subdivision, getEmptySubdivision } from '../types/subdivision.js';
import { Country, LANGUAGES, getEmptyLocalizedField } from '../types/country.js';
import { isValidIso2 } from './utils/iso-reference.js';
import { enumerateSubdivisions } from './utils/wikidata-sparql.js';
import { fetchSubdivisionFacts, resolveEntities, resolveIso3166_2 } from './utils/subdivision-enrich.js';
import { mergeSubdivisionData } from './utils/subdivision-merger.js';
import { WikipediaAPI } from './utils/wikipedia-api.js';
import { parseDescriptionFromWikitext } from './parsers/wikitext-description.js';
import { writeSubdivisionOutputs } from './utils/subdivision-output.js';

const db = new Database('scraper.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS subdivisions (
    code TEXT PRIMARY KEY,
    data TEXT
  )
`);

const upsert = db.prepare('INSERT OR REPLACE INTO subdivisions (code, data) VALUES (?, ?)');
const getRow = db.prepare('SELECT data FROM subdivisions WHERE code = ?');

const TRANSLATION_LANGS = LANGUAGES.filter(l => l !== 'en');

/** Fills an English fallback then copies it into any language the source pass left empty. */
function localizedWithFallback(src: Partial<Record<string, string | null>>, enFallback?: string | null): ReturnType<typeof getEmptyLocalizedField> {
  const field = getEmptyLocalizedField();
  for (const lang of LANGUAGES) field[lang] = src[lang] || null;
  field.en = field.en || enFallback || null;
  for (const lang of TRANSLATION_LANGS) field[lang] = field[lang] || field.en;
  return field;
}

function countryIsoCodes(): string[] {
  let rows: { data: string }[];
  try {
    rows = db.prepare('SELECT data FROM countries').all() as { data: string }[];
  } catch {
    console.error('No `countries` table found - run the country scraper first.');
    return [];
  }
  const codes = new Set<string>();
  for (const row of rows) {
    try {
      const country = JSON.parse(row.data) as Country;
      if (isValidIso2(country.isoCode)) codes.add(country.isoCode);
    } catch { /* skip unparseable row */ }
  }
  return Array.from(codes).sort();
}

async function run() {
  const limitArg = process.argv.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const countryArg = process.argv.find(a => a.startsWith('--country='));
  const onlyCountries = countryArg
    ? countryArg.split('=')[1].split(',').map(c => c.trim().toUpperCase())
    : undefined;

  // 1. DISCOVERY
  let isoCodes = countryIsoCodes();
  if (onlyCountries) isoCodes = isoCodes.filter(c => onlyCountries.includes(c));
  if (isoCodes.length === 0) {
    console.error('No countries to enumerate subdivisions for. Aborting.');
    process.exit(1);
  }
  let refs = await enumerateSubdivisions(isoCodes);
  console.log(`Discovered ${refs.length} first-level subdivisions across ${isoCodes.length} countries.`);
  if (limit) refs = refs.slice(0, limit);

  // 2. STRUCTURED FACTS (Wikidata)
  const facts = await fetchSubdivisionFacts(refs.map(r => r.wikidataId));

  const typeQids = new Set<string>();
  const capitalQids = new Set<string>();
  const languageQids = new Set<string>();
  const borderQids = new Set<string>();
  for (const f of Object.values(facts)) {
    if (f.typeQid) typeQids.add(f.typeQid);
    if (f.capitalQid) capitalQids.add(f.capitalQid);
    f.officialLanguageQids.forEach(q => languageQids.add(q));
    f.borderQids.forEach(q => borderQids.add(q));
  }
  const [resolved, borderCodeByQid] = await Promise.all([
    resolveEntities([...typeQids, ...capitalQids, ...languageQids, ...borderQids]),
    resolveIso3166_2([...borderQids]),
  ]);

  // 3. DESCRIPTIONS (Wikipedia article intros, per language)
  const descriptionsByLang: Record<string, Record<string, string>> = {};
  for (const lang of LANGUAGES) {
    const titles = Array.from(new Set(
      refs.map(r => facts[r.wikidataId]?.sitelinks?.[lang]).filter((t): t is string => !!t),
    ));
    if (titles.length === 0) continue;
    const wikitextByTitle = await WikipediaAPI.fetchWikitextBatch(titles, lang);
    descriptionsByLang[lang] = {};
    for (const [title, wikitext] of Object.entries(wikitextByTitle)) {
      try {
        descriptionsByLang[lang][title] = parseDescriptionFromWikitext(wikitext);
      } catch { /* leave undefined */ }
    }
  }

  // 4. ASSEMBLE + PERSIST
  for (const ref of refs) {
    const f = facts[ref.wikidataId];
    const sub: Subdivision = { ...getEmptySubdivision(), code: ref.code, wikidataId: ref.wikidataId, countryIsoCode: ref.countryIsoCode };

    if (f) {
      sub.name = localizedWithFallback(f.name, f.sitelinks.en || ref.code);

      // Type
      const typeEntity = f.typeQid ? resolved[f.typeQid] : undefined;
      if (typeEntity?.name.en) {
        sub.type = localizedWithFallback(typeEntity.name);
        sub.typeEn = typeEntity.name.en;
      }

      // Capital
      const capitalEntity = f.capitalQid ? resolved[f.capitalQid] : undefined;
      if (capitalEntity?.name.en) {
        sub.capital = [{ articleId: f.capitalQid, name: localizedWithFallback(capitalEntity.name) }];
        sub.capitalCoordinates = capitalEntity.coordinates;
      }

      // Official languages
      sub.officialLanguage = f.officialLanguageQids
        .map(q => ({ q, entity: resolved[q] }))
        .filter(x => x.entity?.name.en)
        .map(x => ({ articleId: x.q, name: localizedWithFallback(x.entity.name) }));

      // Borders: keep only neighbours that resolve to an ISO 3166-2 code
      sub.borders = f.borderQids
        .map(q => ({ q, code: borderCodeByQid[q] }))
        .filter(b => b.code && b.code !== ref.code)
        .map(b => ({
          articleId: b.q,
          code: b.code,
          name: localizedWithFallback(resolved[b.q]?.name || {}, b.code),
        }));

      sub.flagUrl = f.flagUrl;
      sub.coordinates = f.coordinates;
      sub.population = f.population;
      sub.populationYear = f.populationYear;
      sub.areaKm2 = f.areaKm2;
      if (sub.population && sub.areaKm2 && sub.areaKm2 > 0) {
        sub.densityKm2 = parseFloat((sub.population / sub.areaKm2).toFixed(2));
      }

      // Description
      const description = getEmptyLocalizedField();
      for (const lang of LANGUAGES) {
        const title = f.sitelinks[lang];
        const text = title ? descriptionsByLang[lang]?.[title] : undefined;
        if (text) description[lang] = text;
      }
      for (const lang of TRANSLATION_LANGS) description[lang] = description[lang] || description.en;
      sub.description = description;
    }

    const existing = getRow.get(ref.code) as { data: string } | undefined;
    const merged = mergeSubdivisionData(existing?.data || null, sub);
    upsert.run(ref.code, JSON.stringify(merged));
  }

  // 5. WRITE OUTPUT FILES
  const all = (db.prepare('SELECT data FROM subdivisions').all() as { data: string }[])
    .map(r => JSON.parse(r.data) as Subdivision);
  writeSubdivisionOutputs(all);
}

run().catch(err => {
  console.error('Subdivision scraper failed completely:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
