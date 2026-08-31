import Database from 'better-sqlite3';
import { Continent } from '../src/types/continent.js';
import { writeContinentOutputs, patchCountryContinentCodes } from '../src/scraper/utils/continent-output.js';

// Rebuilds every continent output file from the `continents` table without re-crawling.
const db = new Database('scraper.db');

let rows: { data: string }[] = [];
try {
  rows = db.prepare('SELECT data FROM continents').all() as { data: string }[];
} catch {
  console.error('No `continents` table found - run `npm run scrape:continents` first.');
  process.exit(1);
}

const continents = rows.map(r => JSON.parse(r.data) as Continent);
console.log(`Processing ${continents.length} continents from DB...`);
writeContinentOutputs(continents);
patchCountryContinentCodes(continents);
