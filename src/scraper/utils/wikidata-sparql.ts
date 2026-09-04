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
  /** Set on level-2 refs: QID of the containing first-level subdivision. */
  parentWikidataId?: string;
}

let snapshot: SubdivisionRef[] | null = null;
let level2Snapshot: SubdivisionRef[] | null = null;
let snapshotMode = false;

/** Enables offline mode: the enumerators return fixtures instead of hitting WDQS. */
export function useSubdivisionSnapshot(
  filePath = 'tests/snapshots/wikidata/subdivisions/enumeration.json',
  level2FilePath = 'tests/snapshots/wikidata/subdivisions/enumeration-level2.json',
): void {
  snapshotMode = true;
  if (fs.existsSync(filePath)) {
    snapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SubdivisionRef[];
  }
  if (fs.existsSync(level2FilePath)) {
    level2Snapshot = JSON.parse(fs.readFileSync(level2FilePath, 'utf-8')) as SubdivisionRef[];
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
      // WDQS occasionally answers an over-budget query with 200 + an empty body; treat
      // a response without the results envelope as retryable rather than crashing callers.
      if (!data || typeof data !== 'object' || !data.results?.bindings) {
        throw new Error('WDQS returned no results envelope (query likely too expensive)');
      }
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
      const ref = parseSubdivisionRow(row, wantedSet, seen);
      if (ref) refs.push(ref);
    }
  }

  return refs.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Turns one WDQS result row into a {@link SubdivisionRef}, or null when the row is malformed,
 * out of scope, or a code already seen. Shared by the first- and second-level enumerators.
 */
function parseSubdivisionRow(
  row: Record<string, { value: string }>,
  wantedSet: Set<string>,
  seen: Set<string>,
): SubdivisionRef | null {
  const code = row.code?.value?.toUpperCase();
  const countryIsoCode = row.cc?.value?.toUpperCase();
  const wikidataId = row.item?.value ? qid(row.item.value) : null;
  if (!code || !countryIsoCode || !wikidataId) return null;
  if (!wantedSet.has(countryIsoCode)) return null;
  // ISO 3166-2 code must be "<cc>-<1..3 alnum>" with a country part matching P17.
  if (!new RegExp(`^${countryIsoCode}-[A-Z0-9]{1,3}$`).test(code)) return null;
  if (seen.has(code)) return null;
  seen.add(code);
  const ref: SubdivisionRef = { wikidataId, code, countryIsoCode };
  if (row.parent?.value) ref.parentWikidataId = qid(row.parent.value);
  return ref;
}

/**
 * Enumerates the second-level administrative subdivisions of each wanted country: the units
 * that a first-level subdivision in turn "contains" via Wikidata P150 and that themselves
 * carry an ISO 3166-2 code (P300) — Italian provinces, French départements, Scottish council
 * areas, and so on. `parentWikidataId` links each back to its first-level container. Codes
 * already claimed by a first-level unit are dropped (some countries, e.g. NL, model the same
 * item at both depths), so pass the first-level codes in `level1Codes`.
 *
 * P150 ("contains") is deliberately the only edge walked. The reverse P131 ("located in the
 * administrative territorial entity") edge was measured and rejected: it is 10-40x slower and
 * times out on WDQS, adds almost nothing for large countries, and drags in ISO codes that ISO
 * has since withdrawn (the pre-2011 Greek prefectures return ~45 stale codes that no
 * P576 / former-entity filter reliably removes).
 */
export async function enumerateSecondLevelSubdivisions(
  wantedCountryIsoCodes: string[],
  level1Codes: Iterable<string> = [],
): Promise<SubdivisionRef[]> {
  const wanted = Array.from(new Set(wantedCountryIsoCodes.map(c => c.toUpperCase())));
  const wantedSet = new Set(wanted);

  if (snapshotMode) {
    return (level2Snapshot || []).filter(s => wantedSet.has(s.countryIsoCode));
  }

  // Seed `seen` with the first-level codes so a unit modelled at both depths stays level 1.
  const seen = new Set<string>(Array.from(level1Codes, c => c.toUpperCase()));
  const refs: SubdivisionRef[] = [];

  for (let i = 0; i < wanted.length; i += COUNTRIES_PER_QUERY) {
    const batch = wanted.slice(i, i + COUNTRIES_PER_QUERY);
    const values = batch.map(c => `"${c}"`).join(' ');
    const query = `
      SELECT ?item ?code ?cc ?parent WHERE {
        VALUES ?cc { ${values} }
        ?country wdt:P297 ?cc .
        ?country wdt:P150 ?parent .
        ?parent wdt:P150 ?item .
        ?item wdt:P300 ?code .
      }`;

    let data;
    try {
      data = await sparql(query);
      console.log(`  enumerated second-level subdivisions for ${batch.length} countries (batch ${i / COUNTRIES_PER_QUERY + 1})`);
    } catch (e) {
      console.error(`Second-level enumeration failed for [${batch.join(', ')}]: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    for (const row of data.results.bindings) {
      const ref = parseSubdivisionRow(row, wantedSet, seen);
      if (ref) refs.push(ref);
    }
  }

  return refs.sort((a, b) => a.code.localeCompare(b.code));
}
