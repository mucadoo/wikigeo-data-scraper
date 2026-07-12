import { DataValidator } from './utils/validator.js';
import { Country, getEmptyCountry, getEmptyLocalizedField } from '../types/country.js';
import { WikipediaAPI } from './utils/wikipedia-api.js';
import { mergeCountryData } from './utils/merger.js';
import { parseCountryFromWikitext } from './parsers/wikitext-country-parser.js';
import { parseDescriptionFromWikitext } from './parsers/wikitext-description.js';
import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('scraper.db');

// Initialize database
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS countries (
      name TEXT PRIMARY KEY,
      data TEXT
    )
  `);
} catch (e) {
  console.error('Database initialization failed: ' + (e instanceof Error ? e.message : String(e)));
}
const insertCountry = db.prepare('INSERT OR REPLACE INTO countries (name, data) VALUES (?, ?)');
const getCountry = db.prepare('SELECT data FROM countries WHERE name = ?');

const writeLocks: Record<string, Promise<void>> = {};

async function run() {
  // 1. DISCOVERY
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  
  let titles = await WikipediaAPI.fetchCategoryMembers('Category:Member_states_of_the_United_Nations');
  titles = titles.filter(t => !t.startsWith('Category:') && t !== 'Member states of the United Nations');
  if (limit) titles = titles.slice(0, limit);

  // 2. TRANSLATION PREFETCH
  const allLangLinks = await WikipediaAPI.fetchTranslations(titles, ['pt', 'fr', 'it', 'es']);

  // 3. PER-COUNTRY PROCESSING
  const semaphore = new Semaphore(3);
  await Promise.all(titles.map(async (title: string) => {
    await semaphore.acquire();
    try {
      const countryId = title;
      
      const existingRow = getCountry.get(countryId) as { data: string } | undefined;
      if (existingRow) {
        const existingData = JSON.parse(existingRow.data) as Country;
        if (existingData.isoCode && existingData.population && existingData.areaKm2 && existingData.description?.en) {
          console.log(`Skipping ${title} (already valid in DB)`);
          return;
        }
      }

      // Fetch English data
      const enWikitext = await WikipediaAPI.fetchWikitext(title, 'en');
      if (!enWikitext) {
          console.warn(`No wikitext found for ${title}`);
          return;
      }
      const enData = parseCountryFromWikitext(enWikitext, 'en');
      
      if (!enData.isoCode && !enData.population) {
          console.warn(`Parsed data for ${title} is empty, skipping`);
          return;
      }
      
      const articleIds = new Set([
        ...(enData.capital?.map(i => i.articleId) || []),
        ...(enData.largestCity?.map(i => i.articleId) || []),
        ...(enData.officialLanguage?.map(i => i.articleId) || []),
        ...(enData.currency?.map(i => i.articleId) || []),
        ...(enData.demonym?.map(i => i.articleId) || []),
        ...(enData.government?.map(i => i.articleId) || []),
        ...(enData.timeZone?.map(i => i.articleId) || [])
      ].filter(Boolean) as string[]);
      
      const translations = await WikipediaAPI.fetchTranslations(Array.from(articleIds), ['pt', 'fr', 'it', 'es']);
      
      const nameLoc = getEmptyLocalizedField();
      nameLoc.en = title;
      let countryData: Country = {
        ...getEmptyCountry(),
        ...enData,
        name: nameLoc,
      };

      // Fill translations for En pass
      ['capital', 'largestCity', 'officialLanguage', 'currency', 'demonym', 'government', 'timeZone'].forEach(field => {
        const key = field as keyof Country;
        const items = (countryData[key] as any[] || []);
        items.forEach(item => {
          const articleId = item.articleId?.replace(/_/g, ' ');
          ['pt', 'fr', 'it', 'es'].forEach(l => {
            const translation = articleId ? translations[articleId]?.[l] : null;
            if (translation) item.name[l] = translation;
            else if (!item.name[l]) item.name[l] = item.name.en;
          });
        });
      });

      // Localized passes
      const langLinks = allLangLinks[title] || {};
      for (const lang of ['pt', 'fr', 'it', 'es'] as const) {
        const locTitle = langLinks[lang];
        if (locTitle) {
          const wikitext = await WikipediaAPI.fetchWikitext(locTitle, lang);
          const description = parseDescriptionFromWikitext(wikitext, lang);
          
          const localizedData: Partial<Country> = {
            name: { ...getEmptyLocalizedField(), [lang]: locTitle },
            description: { ...getEmptyLocalizedField(), [lang]: description }
          };
          
          countryData = mergeCountryData(JSON.stringify(countryData), localizedData);
        } else {
          // Fallback to English name and description if no translation exists
          countryData.name[lang] = countryData.name.en;
          countryData.description[lang] = countryData.description.en;
        }
      }

      // Write with lock
      if (!writeLocks[countryId]) writeLocks[countryId] = Promise.resolve();
      await writeLocks[countryId];
      writeLocks[countryId] = (async () => {
        const existing = getCountry.get(countryId) as { data: string } | undefined;
        const merged = mergeCountryData(existing?.data || null, countryData);
        insertCountry.run(countryId, JSON.stringify(merged));
      })();
      await writeLocks[countryId];
    } catch (e: any) {
      console.error(`Error processing ${title}: ${e.message}`);
    } finally {
      semaphore.release();
    }
  }));

  // 4. POST-PROCESSING (Copy verbatim from existing main.ts)
  const rawCountries = (db.prepare('SELECT data FROM countries').all() as { data: string }[]).map(row => JSON.parse(row.data) as Country);
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  const countries = rawCountries
    .sort((a, b) => (a.isoCode || '').localeCompare(b.isoCode || ''))
    .map(country => {
      const normalized = { ...getEmptyCountry(), ...country };
      normalized.callingCode = normalized.callingCode || [];
      normalized.internetTld = normalized.internetTld || [];
      const { isoCode, ...rest } = normalized;
      try {
        return DataValidator.validate({ isoCode, ...rest });
      } catch (e) {
        console.error(`Validation failed for ${country.name?.en || 'Unknown'}:`, e);
        return null;
      }
    })
    .filter(c => c !== null) as Country[];

  const output = {
    metadata: {
      generatedAt: new Date().toISOString(),
      version: pkg.version,
      license: pkg.license,
      source: 'Wikipedia'
    },
    data: countries
  };

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/sovereign-states.json', JSON.stringify(output, null, 2));
  fs.writeFileSync('data/sovereign-states.min.json', JSON.stringify(output));

  const API_DIR = 'data/api/v1';
  const COUNTRY_DIR = `${API_DIR}/countries`;
  fs.mkdirSync(COUNTRY_DIR, { recursive: true });

  const index = countries.map(({ isoCode, name, flagUrl }) => ({ isoCode, name, flagUrl }));
  fs.writeFileSync(`${API_DIR}/index.json`, JSON.stringify(index, null, 2));
  fs.writeFileSync(`${API_DIR}/all.json`, JSON.stringify(countries, null, 2));

  countries.forEach(country => {
    if (country.isoCode) {
      fs.writeFileSync(`${COUNTRY_DIR}/${country.isoCode}.json`, JSON.stringify(country, null, 2));
    }
  });
}


class Semaphore {
  private count: number;
  private queue: (() => void)[] = [];
  constructor(count: number) { this.count = count; }
  async acquire() {
    if (this.count > 0) { this.count--; return; }
    await new Promise(resolve => this.queue.push(resolve as any));
  }
  release() {
    if (this.queue.length > 0) { const resolve = this.queue.shift(); resolve!(); }
    else this.count++;
  }
}

run().catch(err => { 
  console.error('Scraper failed completely:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1); 
});
