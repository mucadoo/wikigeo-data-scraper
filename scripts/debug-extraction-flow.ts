import path from 'path';
import { WikipediaAPI } from '../src/scraper/utils/wikipedia-api.js';
import { mergeCountryData } from '../src/scraper/utils/merger.js';
import { getEmptyCountry, getEmptyLocalizedField, Country, LANGUAGES } from '../src/types/country.js';
import { parseCountryFromWikitext } from '../src/scraper/parsers/wikitext-country-parser.js';

const SNAPSHOT_BASE = 'tests/snapshots';
WikipediaAPI.useSnapshots(path.join(SNAPSHOT_BASE, 'translations.json'));

const TRANSLATION_LANGS = LANGUAGES.filter(l => l !== 'en');

async function debugFlow(countryName: string) {
  let mergedResult: Country = getEmptyCountry();

  console.log(`\n--- Debugging Flow for: ${countryName} ---`);

  // 1. English Pass
  const enWikitext = await WikipediaAPI.fetchWikitext(countryName, 'en');
  const enData = parseCountryFromWikitext(enWikitext, 'en');
  
  const articleIds = new Set([
      ...(enData.capital?.map(i => i.articleId) || []),
      ...(enData.largestCity?.map(i => i.articleId) || []),
      ...(enData.officialLanguage?.map(i => i.articleId) || []),
      ...(enData.currency?.map(i => i.articleId) || []),
      ...(enData.demonym?.map(i => i.articleId) || []),
      ...(enData.government?.map(i => i.articleId) || []),
      ...(enData.timeZone?.map(i => i.articleId) || [])
  ].filter(Boolean) as string[]);
  
  const translations = await WikipediaAPI.fetchTranslations(Array.from(articleIds), TRANSLATION_LANGS);
  
  const nameLoc = getEmptyLocalizedField();
  nameLoc.en = countryName;
  const countryDataEn: Country = { ...getEmptyCountry(), ...enData, name: nameLoc };
  
  // Apply translations
  ['capital', 'largestCity', 'officialLanguage', 'currency', 'demonym', 'government', 'timeZone'].forEach(field => {
    const key = field as keyof Country;
    const items = (countryDataEn[key] as { articleId: string | null; name: Record<string, string | null> }[] || []);
    items.forEach(item => {
      const articleId = item.articleId?.replace(/_/g, ' ');
      TRANSLATION_LANGS.forEach(l => {
        const translation = articleId ? translations[articleId]?.[l] : null;
        if (translation) {
          item.name[l] = translation;
        } else if (!item.name[l]) {
          item.name[l] = item.name.en;
        }
      });
    });
  });

  mergedResult = mergeCountryData(JSON.stringify(mergedResult), countryDataEn);

  // 2. Localized Passes
  for (const lang of TRANSLATION_LANGS) {
    const locWikitext = await WikipediaAPI.fetchWikitext(countryName, lang); // Simplified debug: assuming country name translates predictably or using a translation map
    const localizedData: Partial<Country> = parseCountryFromWikitext(locWikitext, lang);
    
    mergedResult = mergeCountryData(JSON.stringify(mergedResult), localizedData as Country);
  }

  console.log('\n--- Final Merged Record ---');
  console.log(JSON.stringify(mergedResult, null, 2));
}

async function run() {
    const args = process.argv.slice(2);
    if (args.length > 0) {
        for (const arg of args) {
            await debugFlow(arg);
        }
    } else {
        await debugFlow('Brazil');
        await debugFlow('France');
    }
}

run();
