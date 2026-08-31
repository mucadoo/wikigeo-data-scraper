import Database from 'better-sqlite3';
import { Subdivision } from '../src/types/subdivision.js';
import { writeSubdivisionOutputs, patchCountrySubdivisionCodes } from '../src/scraper/utils/subdivision-output.js';

// Rebuilds every subdivision output file from the `subdivisions` table without re-crawling.
const db = new Database('scraper.db');

let rows: { data: string }[] = [];
try {
  rows = db.prepare('SELECT data FROM subdivisions').all() as { data: string }[];
} catch {
  console.error('No `subdivisions` table found - run `npm run scrape:subdivisions` first.');
  process.exit(1);
}

const subdivisions = rows.map(r => JSON.parse(r.data) as Subdivision);
console.log(`Processing ${subdivisions.length} subdivisions from DB...`);
writeSubdivisionOutputs(subdivisions);
patchCountrySubdivisionCodes(subdivisions);
