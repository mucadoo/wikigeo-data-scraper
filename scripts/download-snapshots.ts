import fs from 'fs';
import path from 'path';
import { WikipediaAPI } from '../src/scraper/utils/wikipedia-api.js';
import { parseCountryFromWikitext } from '../src/scraper/parsers/wikitext-country-parser.js';
import { LANGUAGES } from '../src/types/country.js';

const OUTPUT_BASE = 'tests/snapshots';
const WIKITEXT_BASE = path.join(OUTPUT_BASE, 'wikitext');
const LANGS: readonly string[] = LANGUAGES;
const TRANSLATION_LANGS = LANGUAGES.filter(l => l !== 'en');

function sanitize(name: string): string {
  try {
    name = decodeURIComponent(name);
  } catch {
    // Ignore decode errors
  }
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function run() {
  console.log('Starting Wikitext Snapshot Downloader...');
  
  // 1. DISCOVERY
  const discoveryUrl = `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:Member_states_of_the_United_Nations&cmlimit=500&format=json`;
  const response = await fetch(discoveryUrl);
  const data = await response.json();
  const titles = (data as { query: { categorymembers: { title: string }[] } }).query.categorymembers.map(m => m.title);

  // 2. LANGLINK PREFETCH
  const allLangLinks = await WikipediaAPI.fetchTranslations(titles, TRANSLATION_LANGS);
  
  // Initialize structure
  if (!fs.existsSync(WIKITEXT_BASE)) fs.mkdirSync(WIKITEXT_BASE, { recursive: true });
  for (const lang of LANGS) {
    const dir = path.join(WIKITEXT_BASE, lang);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // 3. WIKITEXT SNAPSHOTS
  const semaphore = new Semaphore(2);
  const allArticleIds = new Set<string>();

  await Promise.all(titles.map(async (title: string) => {
    const langLinks = allLangLinks[title] || {};
    
    for (const lang of LANGS) {
      const articleTitle = lang === 'en' ? title : langLinks[lang];
      if (!articleTitle) continue;

      await semaphore.acquire();
      try {
        const wikitext = await WikipediaAPI.fetchWikitext(articleTitle, lang);
        fs.writeFileSync(path.join(WIKITEXT_BASE, lang, `${sanitize(title)}.txt`), wikitext);
        
        // Collect articleIds for later
        if (lang === 'en') {
          const parsed = parseCountryFromWikitext(wikitext, 'en');
          [
            ...(parsed.capital?.map(i => i.articleId) || []),
            ...(parsed.largestCity?.map(i => i.articleId) || []),
            ...(parsed.officialLanguage?.map(i => i.articleId) || []),
            ...(parsed.currency?.map(i => i.articleId) || []),
            ...(parsed.demonym?.map(i => i.articleId) || []),
            ...(parsed.government?.map(i => i.articleId) || []),
            ...(parsed.timeZone?.map(i => i.articleId) || [])
          ].forEach(id => id && allArticleIds.add(id.replace(/_/g, ' ')));
        }
      } finally {
        semaphore.release();
      }
    }
  }));

  // 4. ARTICLE ID TRANSLATIONS
  console.log(`Fetching translations for ${allArticleIds.size} unique articles...`);
  const translations = await WikipediaAPI.fetchTranslations(Array.from(allArticleIds), TRANSLATION_LANGS);
  fs.writeFileSync(path.join(OUTPUT_BASE, 'translations.json'), JSON.stringify(translations, null, 2));

  console.log('Finished snapshots and translations.');
}

class Semaphore {
  private count: number;
  private queue: (() => void)[] = [];
  constructor(count: number) { this.count = count; }
  async acquire() {
    if (this.count > 0) { this.count--; return; }
    await new Promise(resolve => this.queue.push(resolve as () => void));
  }
  release() {
    if (this.queue.length > 0) { const resolve = this.queue.shift(); resolve!(); }
    else this.count++;
  }
}

run().catch(err => { console.error('Downloader failed', err); process.exit(1); });
