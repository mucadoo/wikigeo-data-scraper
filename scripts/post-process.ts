
import Database from 'better-sqlite3';
import fs from 'fs';
import { Country, getEmptyCountry } from '../src/types/country.js';
import { DataValidator } from '../src/scraper/utils/validator.js';

const db = new Database('scraper.db');
const rawCountries = (db.prepare('SELECT data FROM countries').all() as { data: string }[]).map(row => JSON.parse(row.data) as Country);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

console.log(`Processing ${rawCountries.length} countries from DB...`);

const countries = rawCountries
  .sort((a, b) => (a.isoCode || '').localeCompare(b.isoCode || ''))
  .map(country => {
    const normalized = { ...getEmptyCountry(), ...country };
    normalized.callingCode = normalized.callingCode || [];
    normalized.internetTld = normalized.internetTld || [];
    const { isoCode, ...rest } = normalized;
    try {
      return DataValidator.validate({ isoCode, ...rest });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Validation failed for ${country.name?.en || 'Unknown'}: ${message}`);
      return null;
    }
  })
  .filter(c => c !== null) as Country[];

console.log(`Successfully validated ${countries.length} countries.`);

const output = {
  metadata: {
    generatedAt: new Date().toISOString(),
    version: pkg.version,
    license: pkg.license,
    source: 'Wikipedia'
  },
  data: countries
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/sovereign-states.json', JSON.stringify(output, null, 2));
fs.writeFileSync('data/sovereign-states.min.json', JSON.stringify(output));

const API_DIR = 'data/api/v1';
const COUNTRY_DIR = `${API_DIR}/countries`;
fs.mkdirSync(COUNTRY_DIR, { recursive: true });

const index = countries.map(({ isoCode, name, flagUrl }) => ({ isoCode, name, flagUrl }));
fs.writeFileSync(`${API_DIR}/index.json`, JSON.stringify(index, null, 2));
fs.writeFileSync(`${API_DIR}/all.json`, JSON.stringify(countries, null, 2));

countries.forEach(country => {
  if (country.isoCode) {
    fs.writeFileSync(`${COUNTRY_DIR}/${country.isoCode}.json`, JSON.stringify(country, null, 2));
  }
});
