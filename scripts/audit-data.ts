import * as fs from 'fs';
import * as path from 'path';
import { Country } from '../src/types/country.js';
import { CONTINENTS_WITHOUT_COUNTRIES } from '../src/scraper/utils/continents.js';

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

// --- Subdivisions ---
const SUBDIVISION_PATH = path.join(process.cwd(), 'data/subdivisions.json');
if (fs.existsSync(SUBDIVISION_PATH)) {
  const rawSub = JSON.parse(fs.readFileSync(SUBDIVISION_PATH, 'utf-8'));
  const subs = (Array.isArray(rawSub) ? rawSub : rawSub.data) as Record<string, unknown>[];
  const subIssues: Issue[] = [];

  const scanBrackets = (name: string | undefined, obj: unknown, pathStr: string) => {
    if (typeof obj === 'string') {
      if (obj.includes('[[') || obj.includes(']]') || obj.includes('<ref')) {
        subIssues.push({ name, field: pathStr, error: 'Contains markup', value: obj });
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, i) => scanBrackets(name, item, `${pathStr}[${i}]`));
    } else if (obj && typeof obj === 'object') {
      Object.entries(obj as Record<string, unknown>).forEach(([k, v]) => scanBrackets(name, v, `${pathStr}.${k}`));
    }
  };

  for (const sub of subs) {
    const name = (sub.name as { en?: string } | undefined)?.en;
    for (const field of ['name', 'type', 'description', 'capital']) scanBrackets(name, sub[field], field);
    for (const field of ['population', 'areaKm2', 'densityKm2']) {
      const value = sub[field];
      if (typeof value === 'number' && (isNaN(value) || value < 0)) {
        subIssues.push({ name, field, error: 'NaN or negative', value });
      }
    }
  }

  console.log(`\n--- Subdivisions (${subs.length}) ---`);
  console.log(subIssues.length > 0 ? JSON.stringify(subIssues, null, 2) : 'No subdivision data issues found.');
}

// --- Continents ---
const CONTINENT_PATH = path.join(process.cwd(), 'data/continents.json');
if (fs.existsSync(CONTINENT_PATH)) {
  const rawCont = JSON.parse(fs.readFileSync(CONTINENT_PATH, 'utf-8'));
  const continents = (Array.isArray(rawCont) ? rawCont : rawCont.data) as Record<string, unknown>[];
  const contIssues: Issue[] = [];

  const scanMarkup = (name: string | undefined, obj: unknown, pathStr: string) => {
    if (typeof obj === 'string') {
      if (obj.includes('[[') || obj.includes(']]') || obj.includes('<ref')) {
        contIssues.push({ name, field: pathStr, error: 'Contains markup', value: obj });
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, i) => scanMarkup(name, item, `${pathStr}[${i}]`));
    } else if (obj && typeof obj === 'object') {
      Object.entries(obj as Record<string, unknown>).forEach(([k, v]) => scanMarkup(name, v, `${pathStr}.${k}`));
    }
  };

  for (const continent of continents) {
    const name = (continent.name as { en?: string } | undefined)?.en;
    for (const field of ['name', 'description']) scanMarkup(name, continent[field], field);
    for (const field of ['population', 'areaKm2', 'densityKm2']) {
      const value = continent[field];
      if (typeof value === 'number' && (isNaN(value) || value < 0)) {
        contIssues.push({ name, field, error: 'NaN or negative', value });
      }
    }
    const codes = continent.countryIsoCodes;
    if (!Array.isArray(codes) || (codes.length === 0 && !CONTINENTS_WITHOUT_COUNTRIES.has(continent.code as string))) {
      contIssues.push({ name, field: 'countryIsoCodes', error: 'Empty', value: codes });
    }
  }

  console.log(`\n--- Continents (${continents.length}) ---`);
  console.log(contIssues.length > 0 ? JSON.stringify(contIssues, null, 2) : 'No continent data issues found.');
}
