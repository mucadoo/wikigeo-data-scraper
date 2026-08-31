import fs from 'fs';
import { Country, LANGUAGES } from '../src/types/country.js';
import { Subdivision } from '../src/types/subdivision.js';

const INPUT_FILE = 'data/sovereign-states.json';
const OUTPUT_FILE = 'data/sovereign-states.csv';
const SUBDIVISION_INPUT_FILE = 'data/subdivisions.json';
const SUBDIVISION_OUTPUT_FILE = 'data/subdivisions.csv';

const csvRow = (values: (string | number | null | undefined)[]): string =>
  values.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');

function flattenData() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('Input file not found');
    return;
  }

  const json = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  const countries = json.data as Country[];

  const headers = [
    'isoCode', 'isoCode3', 'isoNumeric', 'continent',
    ...LANGUAGES.map(lang => `name_${lang}`),
    'flagUrl', ...LANGUAGES.map(lang => `description_${lang}`),
    'capital', 'capitalLat', 'capitalLng', 'largestCity', 'population', 'populationYear', 'areaKm2', 'densityKm2',
    'government', 'governmentLeaders', 'officialLanguage', 'demonym',
    'gdp', 'gdpPerCapita', 'gdpPpp', 'gdpPerCapitaPpp', 'gdpYear', 'hdi',
    'lifeExpectancy', 'internetUsagePercent', 'unemploymentRate', 'currency',
    'timeZone', 'callingCode', 'internetTld', 'drivingSide', 'motto', 'anthem', 'borders', 'subdivisionCodes'
  ];

  const rows = countries.map(c => csvRow([
    c.isoCode, c.isoCode3, c.isoNumeric, c.continent,
    ...LANGUAGES.map(lang => c.name[lang] || ''),
    c.flagUrl,
    ...LANGUAGES.map(lang => c.description[lang] || ''),
    c.capital?.map(i => i.name.en).join('|') || '',
    c.capitalCoordinates?.lat?.toString() || '',
    c.capitalCoordinates?.lng?.toString() || '',
    c.largestCity?.map(i => i.name.en).join('|') || '',
    c.population?.toString() || '',
    c.populationYear?.toString() || '',
    c.areaKm2?.toString() || '',
    c.densityKm2?.toString() || '',
    c.government?.map(i => i.name.en).join('|') || '',
    c.governmentLeaders?.map(l => `${l.title}: ${l.name}`).join('|') || '',
    c.officialLanguage?.map(i => i.name.en).join('|') || '',
    c.demonym?.map(i => i.name.en).join('|') || '',
    c.gdp?.toString() || '',
    c.gdpPerCapita?.toString() || '',
    c.gdpPpp?.toString() || '',
    c.gdpPerCapitaPpp?.toString() || '',
    c.gdpYear?.toString() || '',
    c.hdi?.toString() || '',
    c.lifeExpectancy?.toString() || '',
    c.internetUsagePercent?.toString() || '',
    c.unemploymentRate?.toString() || '',
    c.currency?.map(i => i.isoCode || i.name.en).join('|') || '',
    c.timeZone?.map(i => i.name.en).join('|') || '',
    c.callingCode?.join('|') || '',
    c.internetTld?.join('|') || '',
    c.drivingSide || '',
    c.motto || '',
    c.anthem || '',
    c.borders?.map(b => b.isoCode || b.name.en).join('|') || '',
    c.subdivisionCodes?.join('|') || ''
  ]));

  fs.writeFileSync(OUTPUT_FILE, [headers.join(','), ...rows].join('\n'));
  console.log(`Successfully generated ${OUTPUT_FILE}`);
}

function flattenSubdivisions() {
  if (!fs.existsSync(SUBDIVISION_INPUT_FILE)) {
    console.warn(`${SUBDIVISION_INPUT_FILE} not found - skipping subdivision CSV.`);
    return;
  }

  const json = JSON.parse(fs.readFileSync(SUBDIVISION_INPUT_FILE, 'utf8'));
  const subdivisions = json.data as Subdivision[];

  const headers = [
    'code', 'wikidataId', 'countryIsoCode', 'typeEn',
    ...LANGUAGES.map(lang => `name_${lang}`),
    ...LANGUAGES.map(lang => `type_${lang}`),
    'flagUrl', ...LANGUAGES.map(lang => `description_${lang}`),
    'capital', 'capitalLat', 'capitalLng', 'lat', 'lng',
    'population', 'populationYear', 'areaKm2', 'densityKm2'
  ];

  const rows = subdivisions.map(s => csvRow([
    s.code, s.wikidataId, s.countryIsoCode, s.typeEn,
    ...LANGUAGES.map(lang => s.name[lang] || ''),
    ...LANGUAGES.map(lang => s.type[lang] || ''),
    s.flagUrl,
    ...LANGUAGES.map(lang => s.description[lang] || ''),
    s.capital?.map(i => i.name.en).join('|') || '',
    s.capitalCoordinates?.lat?.toString() || '',
    s.capitalCoordinates?.lng?.toString() || '',
    s.coordinates?.lat?.toString() || '',
    s.coordinates?.lng?.toString() || '',
    s.population?.toString() || '',
    s.populationYear?.toString() || '',
    s.areaKm2?.toString() || '',
    s.densityKm2?.toString() || ''
  ]));

  fs.writeFileSync(SUBDIVISION_OUTPUT_FILE, [headers.join(','), ...rows].join('\n'));
  console.log(`Successfully generated ${SUBDIVISION_OUTPUT_FILE}`);
}

flattenData();
flattenSubdivisions();
