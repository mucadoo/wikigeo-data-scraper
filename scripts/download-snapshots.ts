import fs from 'fs';
import path from 'path';
import { WikipediaAPI } from '../src/scraper/utils/wikipedia-api.js';

// Refreshes the offline fixture corpora used by the parser regression tests:
//  - tests/snapshots/wikitext/en/*        -> full English corpus (tests/parser-corpus.test.ts).
//    English is the only locale whose field-name-driven infobox parser (FIELD_MAP) runs in
//    production, so it's the only one that needs full coverage.
//  - tests/snapshots/wikitext/{de,ja,ru,zh}/* -> a small curated sample (tests/i18n-corpus.test.ts)
//    for the locales with the highest structural risk to the shared, language-agnostic
//    description extractor: non-Latin scripts (ja, ru, zh) and one Latin-but-non-English control
//    (de). These only need a handful of real articles each, not the full corpus.
const WIKITEXT_BASE = path.join('tests/snapshots', 'wikitext');
const I18N_SAMPLE_TITLES = ['France', 'Germany', 'Japan', 'Russia', 'Brazil'];
const I18N_LANGS = ['de', 'ja', 'ru', 'zh'];

function sanitize(name: string): string {
  try {
    name = decodeURIComponent(name);
  } catch {
    // Ignore decode errors
  }
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function refreshEnglishCorpus() {
  console.log('Refreshing English wikitext corpus...');

  const discoveryUrl = `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:Member_states_of_the_United_Nations&cmlimit=500&format=json`;
  const response = await fetch(discoveryUrl);
  const data = await response.json();
  const titles = (data as { query: { categorymembers: { title: string }[] } }).query.categorymembers
    .map(m => m.title)
    // The category page itself is listed as its own member on Wikipedia; it isn't a country.
    .filter(t => !t.startsWith('Category:') && t !== 'Member states of the United Nations');

  const dir = path.join(WIKITEXT_BASE, 'en');
  fs.mkdirSync(dir, { recursive: true });

  const semaphore = new Semaphore(2);
  await Promise.all(titles.map(async (title: string) => {
    await semaphore.acquire();
    try {
      const wikitext = await WikipediaAPI.fetchWikitext(title, 'en');
      fs.writeFileSync(path.join(dir, `${sanitize(title)}.txt`), wikitext);
    } finally {
      semaphore.release();
    }
  }));

  console.log(`Finished English corpus. Wrote ${titles.length} articles to ${dir}.`);
}

async function refreshI18nSample() {
  console.log('Refreshing multilingual sample corpus...');

  const langLinks = await WikipediaAPI.fetchTranslations(I18N_SAMPLE_TITLES, I18N_LANGS);

  for (const lang of I18N_LANGS) {
    const dir = path.join(WIKITEXT_BASE, lang);
    fs.mkdirSync(dir, { recursive: true });

    for (const enTitle of I18N_SAMPLE_TITLES) {
      const localTitle = langLinks[enTitle]?.[lang];
      if (!localTitle) {
        console.warn(`No ${lang} translation found for ${enTitle}, skipping`);
        continue;
      }
      const wikitext = await WikipediaAPI.fetchWikitext(localTitle, lang);
      fs.writeFileSync(path.join(dir, `${sanitize(enTitle)}.txt`), wikitext);
    }
  }

  console.log(`Finished multilingual sample for ${I18N_LANGS.join(', ')}.`);
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

async function run() {
  await refreshEnglishCorpus();
  await refreshI18nSample();
}

run().catch(err => { console.error('Downloader failed', err); process.exit(1); });
