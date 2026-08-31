
import * as fs from 'fs';
import * as path from 'path';
import { LANGUAGES } from '../src/types/country.js';

const DATA_PATH = path.join(process.cwd(), 'data/sovereign-states.json');
const SUBDIVISION_PATH = path.join(process.cwd(), 'data/subdivisions.json');
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
const SUBDIVISION_LOCALIZED_FIELDS = ['name', 'type', 'description', 'capital'];

interface CountryIssue {
  country: string | null | undefined;
  missing_translations: Record<string, string[]>;
}

function checkFile(label: string, filePath: string, fields: string[], required: boolean): void {
  if (!fs.existsSync(filePath)) {
    if (required) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    console.log(`\n[${label}] ${filePath} not found - skipping.`);
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const data = (Array.isArray(rawData) ? rawData : rawData.data) as Record<string, unknown>[];
  const issues: CountryIssue[] = [];
  const fieldIssuesCount: Record<string, number> = {};

  for (const entity of data) {
    const name = (entity.name as { en?: string } | undefined)?.en;
    const entityIssues: CountryIssue = { country: name, missing_translations: {} };
    let hasIssue = false;

    for (const field of fields) {
      const fieldData = entity[field];
      if (!fieldData) continue;

      const missingLangs = LANGUAGES.filter(lang => {
        if (Array.isArray(fieldData)) {
          if (fieldData.length === 0) return true;
          return fieldData.some(item => !item.name[lang] || item.name[lang].trim() === '');
        }
        const langData = (fieldData as Record<string, unknown>)[lang];
        if (langData === undefined) return true;
        if (typeof langData === 'string' && langData.trim() === '') return true;
        return false;
      });

      if (missingLangs.length > 0 && missingLangs.length < LANGUAGES.length) {
        entityIssues.missing_translations[field] = missingLangs;
        hasIssue = true;
        fieldIssuesCount[field] = (fieldIssuesCount[field] || 0) + 1;
      }
    }

    if (hasIssue) issues.push(entityIssues);
  }

  console.log(`\n=== ${label} ===`);
  console.log("Summary of missing translations by field:");
  console.log(JSON.stringify(fieldIssuesCount, null, 2));
  console.log("Sample entries with issues:");
  console.log(JSON.stringify(issues.slice(0, 5), null, 2));
  console.log(`Total entries with localization issues: ${issues.length} / ${data.length}`);
}

async function main() {
  checkFile('Countries', DATA_PATH, LOCALIZED_FIELDS, true);
  checkFile('Subdivisions', SUBDIVISION_PATH, SUBDIVISION_LOCALIZED_FIELDS, false);
}

main().catch(console.error);
