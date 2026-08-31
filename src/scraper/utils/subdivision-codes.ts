import type { Database } from 'better-sqlite3';
import { Subdivision } from '../../types/subdivision.js';
import { subdivisionCodesByCountry } from './subdivision-output.js';

/**
 * Reads the `subdivisions` table (if the subdivision scraper has populated it) and returns
 * publishable ISO 3166-2 codes grouped by parent country ISO 3166-1 alpha-2 code, so the
 * country pipeline can stamp `subdivisionCodes` onto each country without re-crawling.
 * Returns an empty map when the table does not exist yet.
 */
export function readSubdivisionCodesByCountry(db: Database): Record<string, string[]> {
  let rows: { data: string }[];
  try {
    rows = db.prepare('SELECT data FROM subdivisions').all() as { data: string }[];
  } catch {
    return {};
  }
  const subdivisions = rows
    .map(r => { try { return JSON.parse(r.data) as Subdivision; } catch { return null; } })
    .filter((s): s is Subdivision => s !== null);
  return subdivisionCodesByCountry(subdivisions);
}
