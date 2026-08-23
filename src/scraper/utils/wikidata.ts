import axios from 'axios';

const USER_AGENT = 'WikiGeoDataScraper/1.0 (mucadoo@personal.dev)';
const API_URL = 'https://www.wikidata.org/w/api.php';
const CHUNK_SIZE = 50;
const MIN_DELAY = 300;

let lastRequestTime = 0;

async function request(params: Record<string, string>): Promise<unknown> {
  const now = Date.now();
  const wait = MIN_DELAY - (now - lastRequestTime);
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  lastRequestTime = Date.now();

  const { data } = await axios.get(API_URL, {
    params: { action: 'wbgetentities', format: 'json', ...params },
    headers: { 'User-Agent': USER_AGENT },
    timeout: 30000,
  });
  return data;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface WikidataSnak {
  datavalue?: { value: unknown };
}
interface WikidataClaim {
  mainsnak: WikidataSnak;
  rank: 'preferred' | 'normal' | 'deprecated';
  qualifiers?: Record<string, WikidataSnak[]>;
}
interface WikidataEntity {
  claims?: Record<string, WikidataClaim[]>;
  sitelinks?: { enwiki?: { title: string } };
}

function bestClaim(claims: WikidataClaim[] | undefined): WikidataClaim | undefined {
  if (!claims || claims.length === 0) return undefined;
  return claims.find(c => c.rank === 'preferred') || claims.find(c => c.rank !== 'deprecated');
}

function entityIdValue(snak: WikidataSnak | undefined): string | null {
  const value = snak?.datavalue?.value as { id?: string } | undefined;
  return value?.id || null;
}

export interface WikidataCountryFacts {
  populationYear: number | null;
  drivingSideQid: string | null;
  borderQids: string[];
}

/**
 * Fetches country-level facts from Wikidata (Wikipedia's structured-data sibling project),
 * keyed by the English Wikipedia article title, for fields where the infobox's free-text
 * wikitext is unreliable or simply doesn't carry the data:
 *  - P1082 (population), whose "preferred" rank claim carries a P585 (point in time)
 *    qualifier - a clean source for `populationYear`.
 *  - P1622 (drives on the left/right) - returns an item id that still needs a label lookup.
 *  - P47 (shares border with) - returns item ids that still need resolving to ISO codes.
 */
export async function fetchWikidataFacts(titles: string[]): Promise<Record<string, WikidataCountryFacts>> {
  const result: Record<string, WikidataCountryFacts> = {};

  for (const batch of chunk(titles, CHUNK_SIZE)) {
    try {
      const data = await request({
        sites: 'enwiki',
        titles: batch.join('|'),
        props: 'claims|sitelinks',
        sitefilter: 'enwiki',
      }) as { entities?: Record<string, WikidataEntity> };

      Object.values(data.entities || {}).forEach(entity => {
        const title = entity.sitelinks?.enwiki?.title;
        if (!title) return;

        const claims = entity.claims || {};
        const popClaim = bestClaim(claims['P1082']);
        const yearRaw = popClaim?.qualifiers?.['P585']?.[0]?.datavalue?.value as { time?: string } | undefined;
        const yearMatch = yearRaw?.time?.match(/\+(\d{4})/);

        const drivingClaim = bestClaim(claims['P1622']);
        const borderQids = (claims['P47'] || [])
          .filter(c => c.rank !== 'deprecated')
          .map(c => entityIdValue(c.mainsnak))
          .filter((v): v is string => !!v);

        result[title] = {
          populationYear: yearMatch ? parseInt(yearMatch[1], 10) : null,
          drivingSideQid: entityIdValue(drivingClaim?.mainsnak),
          borderQids,
        };
      });
    } catch (e) {
      console.error(`Wikidata facts lookup failed for a batch: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}

/** Resolves Wikidata item ids to their English label (used for the P1622 driving-side item). */
export async function resolveLabels(qids: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const unique = Array.from(new Set(qids));

  for (const batch of chunk(unique, CHUNK_SIZE)) {
    try {
      const data = await request({
        ids: batch.join('|'),
        props: 'labels',
        languages: 'en',
      }) as { entities?: Record<string, { labels?: { en?: { value: string } } }> };

      Object.entries(data.entities || {}).forEach(([qid, entity]) => {
        const label = entity.labels?.en?.value;
        if (label) result[qid] = label;
      });
    } catch (e) {
      console.error(`Wikidata label lookup failed for a batch: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}

/** Resolves Wikidata item ids to their ISO 3166-1 alpha-2 code (P297), used to turn P47
 *  "shares border with" relations into the same isoCode values the rest of the dataset uses. */
export async function resolveIsoCodes(qids: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const unique = Array.from(new Set(qids));

  for (const batch of chunk(unique, CHUNK_SIZE)) {
    try {
      const data = await request({
        ids: batch.join('|'),
        props: 'claims',
      }) as { entities?: Record<string, WikidataEntity> };

      Object.entries(data.entities || {}).forEach(([qid, entity]) => {
        const isoClaim = bestClaim(entity.claims?.['P297']);
        const value = isoClaim?.mainsnak?.datavalue?.value;
        if (typeof value === 'string') result[qid] = value.toUpperCase();
      });
    } catch (e) {
      console.error(`Wikidata ISO code lookup failed for a batch: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}
