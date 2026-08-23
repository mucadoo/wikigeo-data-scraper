import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { WikipediaAPI } from '../src/scraper/utils/wikipedia-api.js';
import { mergeCountryData } from '../src/scraper/utils/merger.js';
import { Country, getEmptyCountry, LANGUAGES } from '../src/types/country.js';
import { parseCountryFromWikitext } from '../src/scraper/parsers/wikitext-country-parser.js';

const TRANSLATION_LANGS = LANGUAGES.filter(l => l !== 'en');

describe('Regression Tests', () => {
  const snapshotsDir = path.join(process.cwd(), 'tests/snapshots');
  const wikitextSnapshotsDir = path.join(snapshotsDir, 'wikitext');
  
  beforeAll(() => {
    WikipediaAPI.useSnapshots(path.join(snapshotsDir, 'translations.json'));
  });

  if (!fs.existsSync(wikitextSnapshotsDir)) {
    it.skip('Wikitext snapshots directory not found', () => {});
    return;
  }

  const grouped: Record<string, Record<string, string>> = {};
  LANGUAGES.forEach(lang => {
    const langDir = path.join(wikitextSnapshotsDir, lang);
    if (fs.existsSync(langDir)) {
      fs.readdirSync(langDir).filter(f => f.endsWith('.txt')).forEach(file => {
        const country = file.replace('.txt', '');
        if (!grouped[country]) grouped[country] = {};
        grouped[country][lang] = path.join(lang, file);
      });
    }
  });

  Object.entries(grouped).forEach(([countryName, langs]) => {
    it(`should process all languages for ${countryName}`, async () => {
      let countryData: Country = getEmptyCountry();

      // 1. Process EN Pass
      if (langs['en']) {
        const wikitext = fs.readFileSync(path.join(wikitextSnapshotsDir, langs['en']), 'utf-8');
        const parsed = parseCountryFromWikitext(wikitext, 'en');
        
        const articleIds = new Set([
            ...(parsed.capital?.map(i => i.articleId) || []),
            ...(parsed.largestCity?.map(i => i.articleId) || []),
            ...(parsed.officialLanguage?.map(i => i.articleId) || []),
            ...(parsed.currency?.map(i => i.articleId) || []),
            ...(parsed.demonym?.map(i => i.articleId) || []),
            ...(parsed.government?.map(i => i.articleId) || []),
            ...(parsed.timeZone?.map(i => i.articleId) || [])
        ].filter(Boolean) as string[]);
        
        const translations = await WikipediaAPI.fetchTranslations(Array.from(articleIds), TRANSLATION_LANGS);
        
        const name = { ...parsed.name!, en: countryName };
        const localizedDataEn: Partial<Country> = { ...parsed, name };
        
        ['capital', 'largestCity', 'officialLanguage', 'currency', 'demonym', 'government', 'timeZone'].forEach(field => {
          const key = field as keyof Country;
          const items = (localizedDataEn[key] as { articleId?: string | null; name: Record<string, string | null | undefined> }[]) || [];
          items.forEach((item) => {
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

        countryData = mergeCountryData(JSON.stringify(countryData), localizedDataEn as Country);
      }

      // 2. Localized Passes
      TRANSLATION_LANGS.forEach(lang => {
        if (langs[lang]) {
          const wikitext = fs.readFileSync(path.join(wikitextSnapshotsDir, langs[lang]), 'utf-8');
          const locData = parseCountryFromWikitext(wikitext, lang);
          countryData = mergeCountryData(JSON.stringify(countryData), locData as Country);
        }
      });

      // Basic assertions
      expect(countryData.name.en).toBeDefined();
      if (langs['en'] && countryName !== 'member_states_of_the_united_nations') {
        expect(countryData.capital?.[0]?.name?.en).toBeDefined();
      }
      
      TRANSLATION_LANGS.forEach(lang => {
        if (langs[lang]) {
          expect((countryData.name as Record<string, string | null | undefined>)[lang]).toBeDefined();
          expect((countryData.description as Record<string, string | null | undefined>)[lang]).toBeDefined();
        }
      });

      if (countryName === 'france' && countryData.capital && countryData.capital.length > 0) {
        // Since we are using translations, the 'fr' name should be the translated one, not necessarily 'Paris' if 'Paris' was the English base name.
        expect(countryData.capital[0].name.en).toBe('Paris');
        expect(countryData.name.es).toBeDefined();
      }
    });
  });
});
