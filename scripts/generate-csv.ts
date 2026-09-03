import fs from 'fs';
import { Country, LANGUAGES } from '../src/types/country.js';
import { Subdivision } from '../src/types/subdivision.js';
import { Continent } from '../src/types/continent.js';

const INPUT_FILE = 'data/sovereign-states.json';
const OUTPUT_FILE = 'data/sovereign-states.csv';
const SUBDIVISION_INPUT_FILE = 'data/subdivisions.json';
const SUBDIVISION_OUTPUT_FILE = 'data/subdivisions.csv';
const CONTINENT_INPUT_FILE = 'data/continents.json';
const CONTINENT_OUTPUT_FILE = 'data/continents.csv';

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
    'isoCode', 'isoCode3', 'isoNumeric', 'continent', 'continentCodes',
    ...LANGUAGES.map(lang => `name_${lang}`),
    'flagUrl', ...LANGUAGES.map(lang => `description_${lang}`),
    'capital', 'capitalLat', 'capitalLng', 'largestCity', 'population', 'populationYear', 'areaKm2', 'densityKm2',
    'government', 'governmentLeaders', 'officialLanguage', 'demonym',
    'gdp', 'gdpPerCapita', 'gdpPpp', 'gdpPerCapitaPpp', 'gdpYear', 'hdi',
    'lifeExpectancy', 'internetUsagePercent', 'unemploymentRate', 'currency',
    'timeZone', 'callingCode', 'internetTld', 'drivingSide', 'motto', 'anthem', 'borders', 'subdivisionCodes'
  ];

  const rows = countries.map(c => csvRow([
    c.isoCode, c.isoCode3, c.isoNumeric, c.continent, c.continentCodes?.join('|') || '',
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
    'code', 'wikidataId', 'countryIsoCode', 'level', 'parentCode', 'typeEn',
    ...LANGUAGES.map(lang => `name_${lang}`),
    ...LANGUAGES.map(lang => `type_${lang}`),
    'flagUrl', ...LANGUAGES.map(lang => `description_${lang}`),
    'capital', 'capitalLat', 'capitalLng', 'lat', 'lng',
    'population', 'populationYear', 'areaKm2', 'densityKm2', 'officialLanguage', 'borders'
  ];

  const rows = subdivisions.map(s => csvRow([
    s.code, s.wikidataId, s.countryIsoCode, s.level.toString(), s.parentCode || '', s.typeEn,
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
    s.densityKm2?.toString() || '',
    s.officialLanguage?.map(i => i.name.en).join('|') || '',
    s.borders?.map(b => b.code || b.name.en).join('|') || ''
  ]));

  fs.writeFileSync(SUBDIVISION_OUTPUT_FILE, [headers.join(','), ...rows].join('\n'));
  console.log(`Successfully generated ${SUBDIVISION_OUTPUT_FILE}`);
}

function flattenContinents() {
  if (!fs.existsSync(CONTINENT_INPUT_FILE)) {
    console.warn(`${CONTINENT_INPUT_FILE} not found - skipping continent CSV.`);
    return;
  }

  const json = JSON.parse(fs.readFileSync(CONTINENT_INPUT_FILE, 'utf8'));
  const continents = json.data as Continent[];

  const headers = [
    'code', 'wikidataId',
    ...LANGUAGES.map(lang => `name_${lang}`),
    ...LANGUAGES.map(lang => `description_${lang}`),
    'lat', 'lng',
    'population', 'populationYear', 'populationSource',
    'areaKm2', 'areaSource', 'densityKm2',
    'countryCount', 'countryIsoCodes'
  ];

  const rows = continents.map(c => csvRow([
    c.code, c.wikidataId,
    ...LANGUAGES.map(lang => c.name[lang] || ''),
    ...LANGUAGES.map(lang => c.description[lang] || ''),
    c.coordinates?.lat?.toString() || '',
    c.coordinates?.lng?.toString() || '',
    c.population?.toString() || '',
    c.populationYear?.toString() || '',
    c.populationSource || '',
    c.areaKm2?.toString() || '',
    c.areaSource || '',
    c.densityKm2?.toString() || '',
    c.countryCount?.toString() || '',
    c.countryIsoCodes?.join('|') || ''
  ]));

  fs.writeFileSync(CONTINENT_OUTPUT_FILE, [headers.join(','), ...rows].join('\n'));
  console.log(`Successfully generated ${CONTINENT_OUTPUT_FILE}`);
}

flattenData();
flattenSubdivisions();
flattenContinents();
