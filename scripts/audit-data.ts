import * as fs from 'fs';
import * as path from 'path';
import { Country } from '../src/types/country.js';

const DATA_PATH = path.join(process.cwd(), 'data/sovereign-states.json');

if (!fs.existsSync(DATA_PATH)) {
  console.error(`File not found: ${DATA_PATH}`);
  process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
const data: Country[] = Array.isArray(rawData) ? rawData : rawData.data;

interface Issue {
  name: string | null | undefined;
  field: string;
  error: string;
  value: unknown;
}

const issues: Issue[] = [];

data.forEach(country => {
  const name = country.name.en;
  
  // Check for NaN or null in critical numeric fields
  const numericFields: (keyof Country)[] = ['population', 'areaKm2'];
  numericFields.forEach(field => {
    const value = country[field];
    if (value === null || value === undefined || (typeof value === 'number' && isNaN(value as number))) {
        issues.push({ name, field, error: 'Missing or NaN', value });
    }
  });

  // Check for bracketed citations in strings
  const checkBrackets = (obj: unknown, pathStr = '') => {
    if (typeof obj === 'string') {
      if (obj.includes('[') || obj.includes(']')) {
        issues.push({ name, field: pathStr, error: 'Contains brackets', value: obj });
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, i) => checkBrackets(item, `${pathStr}[${i}]`));
    } else if (obj && typeof obj === 'object') {
      Object.entries(obj as Record<string, unknown>).forEach(([key, val]) => checkBrackets(val, pathStr ? `${pathStr}.${key}` : key));
    }
  };

  // We only check these fields for brackets
  const bracketCheckFields: (keyof Country)[] = ['name', 'capital', 'largestCity', 'officialLanguage', 'government', 'demonym', 'currency', 'timeZone'];
  bracketCheckFields.forEach(field => {
    checkBrackets(country[field], field as string);
  });

  // Check for suspicious populations (e.g. 0 or 1 for a country)
  if (country.population === 0 && name !== 'Vatican City') {
      issues.push({ name, field: 'population', error: 'Suspiciously zero', value: country.population });
  }

  // Check for brackets in callingCode or internetTld
  ['callingCode', 'internetTld'].forEach(field => {
    const value = country[field as keyof Country];
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (typeof item === 'string' && (item.includes('[[') || item.includes(']]'))) {
          issues.push({ name, field, error: 'Contains brackets', value: item });
        }
      });
    }
  });
});

if (issues.length > 0) {
  console.log(JSON.stringify(issues, null, 2));
} else {
  console.log('No data issues found.');
}
