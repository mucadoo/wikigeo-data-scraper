import axios from 'axios';
import fs from 'fs';

const USER_AGENT = 'WikiGeoDataScraper/1.0 (mucadoo@personal.dev)';
const SPARQL_URL = 'https://query.wikidata.org/sparql';
const MIN_DELAY = 1000;

let lastRequestTime = 0;

export interface SubdivisionRef {
  wikidataId: string;
  code: string;
  countryIsoCode: string;
}

let snapshot: SubdivisionRef[] | null = null;
let snapshotMode = false;

/** Enables offline mode: `enumerateSubdivisions` returns the fixture instead of hitting WDQS. */
export function useSubdivisionSnapshot(filePath = 'tests/snapshots/wikidata/subdivisions/enumeration.json'): void {
  snapshotMode = true;
  if (fs.existsSync(filePath)) {
    snapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SubdivisionRef[];
  }
}

async function sparql(query: string): Promise<{ results: { bindings: Record<string, { value: string }>[] } }> {
  const wait = MIN_DELAY - (Date.now() - lastRequestTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));

  let retries = 4;
  while (retries > 0) {
    try {
      lastRequestTime = Date.now();
      const { data } = await axios.get(SPARQL_URL, {
        params: { query, format: 'json' },
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' },
        timeout: 120000,
      });
      return data;
    } catch (error: unknown) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const retryable = status === undefined || [429, 500, 502, 503, 504].includes(status);
      if (retryable && retries > 1) {
        await new Promise(r => setTimeout(r, (5 + (4 - retries) * 5) * 1000));
        retries--;
        continue;
      }
      throw error;
    }
  }
  throw new Error('SPARQL request failed after retries');
}

const qid = (uri: string): string => uri.replace(/^.*\/entity\//, '');

/**
 * Enumerates the first-level administrative subdivisions (state / province / region / …) of
 * each wanted country: the units a country "contains" via Wikidata P150 that also carry an
 * ISO 3166-2 code (P300), keyed to the parent country's ISO 3166-1 alpha-2 code (P297).
 * The ISO 3166-2 code's own country prefix is re-checked against P297 client-side.
 */
const COUNTRIES_PER_QUERY = 20;

export async function enumerateSubdivisions(wantedCountryIsoCodes: string[]): Promise<SubdivisionRef[]> {
  const wanted = Array.from(new Set(wantedCountryIsoCodes.map(c => c.toUpperCase())));
  const wantedSet = new Set(wanted);

  if (snapshotMode) {
    return (snapshot || []).filter(s => wantedSet.has(s.countryIsoCode));
  }

  const seen = new Set<string>();
  const refs: SubdivisionRef[] = [];

  // A P31/P279* property-path filter over every P300 item is too slow on WDQS, so use the
  // direct "country contains administrative territorial entity" edge (P150) instead, keyed
  // to the country by its ISO 3166-1 code (P297) and restricted to units that themselves
  // carry an ISO 3166-2 code (P300). Batched over ISO codes to keep each query cheap.
  for (let i = 0; i < wanted.length; i += COUNTRIES_PER_QUERY) {
    const batch = wanted.slice(i, i + COUNTRIES_PER_QUERY);
    const values = batch.map(c => `"${c}"`).join(' ');
    const query = `
      SELECT ?item ?code ?cc WHERE {
        VALUES ?cc { ${values} }
        ?country wdt:P297 ?cc .
        ?country wdt:P150 ?item .
        ?item wdt:P300 ?code .
      }`;

    let data;
    try {
      data = await sparql(query);
      console.log(`  enumerated subdivisions for ${batch.length} countries (batch ${i / COUNTRIES_PER_QUERY + 1})`);
    } catch (e) {
      console.error(`Subdivision enumeration failed for [${batch.join(', ')}]: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    for (const row of data.results.bindings) {
      const code = row.code?.value?.toUpperCase();
      const countryIsoCode = row.cc?.value?.toUpperCase();
      const wikidataId = row.item?.value ? qid(row.item.value) : null;
      if (!code || !countryIsoCode || !wikidataId) continue;
      if (!wantedSet.has(countryIsoCode)) continue;
      // ISO 3166-2 code must be "<cc>-<1..3 alnum>" with a country part matching P17.
      if (!new RegExp(`^${countryIsoCode}-[A-Z0-9]{1,3}$`).test(code)) continue;
      if (seen.has(code)) continue;
      seen.add(code);
      refs.push({ wikidataId, code, countryIsoCode });
    }
  }

  return refs.sort((a, b) => a.code.localeCompare(b.code));
}
