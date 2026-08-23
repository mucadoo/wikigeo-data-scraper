
import * as fs from 'fs';
import * as path from 'path';
import { Country, LANGUAGES } from '../src/types/country.js';

const DATA_PATH = path.join(process.cwd(), 'data/sovereign-states.json');
const LOCALIZED_FIELDS = [
  'name',
  'description',
  'capital',
  'largestCity',
  'officialLanguage',
  'currency',
  'government',
  'demonym',
  'timeZone'
];

interface CountryIssue {
  country: string | null | undefined;
  missing_translations: Record<string, string[]>;
}

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`File not found: ${DATA_PATH}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const data = (Array.isArray(rawData) ? rawData : rawData.data) as Country[];
  const issues: CountryIssue[] = [];
  const fieldIssuesCount: Record<string, number> = {};

  for (const country of data) {
    const countryIssues: CountryIssue = {
      country: country.name.en,
      missing_translations: {}
    };

    let hasIssue = false;

    for (const field of LOCALIZED_FIELDS) {
      const fieldData = (country as unknown as Record<string, unknown>)[field];
      if (!fieldData) continue;

      const missingLangs = LANGUAGES.filter(lang => {
        if (Array.isArray(fieldData)) {
          // New structure: array of objects with name: LocalizedField
          if (fieldData.length === 0) return true;
          return fieldData.some(item => !item.name[lang] || item.name[lang].trim() === '');
        } else {
          // Old/Localized structure: record of lang to value
          const langData = (fieldData as Record<string, unknown>)[lang];
          if (langData === undefined) return true;
          if (typeof langData === 'string' && langData.trim() === '') return true;
          return false;
        }
      });

      if (missingLangs.length > 0 && missingLangs.length < LANGUAGES.length) {
        countryIssues.missing_translations[field] = missingLangs;
        hasIssue = true;
        fieldIssuesCount[field] = (fieldIssuesCount[field] || 0) + 1;
      }
    }

    if (hasIssue) {
      issues.push(countryIssues);
    }
  }

  console.log("Summary of missing translations by field:");
  console.log(JSON.stringify(fieldIssuesCount, null, 2));
  console.log("\nSample countries with issues:");
  console.log(JSON.stringify(issues.slice(0, 5), null, 2));
  console.log(`\nTotal countries with localization issues: ${issues.length} / ${data.length}`);
}

main().catch(console.error);
