import axios from 'axios';
import { LANGUAGES, getEmptyLocalizedField } from '../../types/country.js';
import type { Coord } from '../../types/country.js';

const USER_AGENT = 'WikiGeoDataScraper/1.0 (mucadoo@personal.dev)';
const API_URL = 'https://www.wikidata.org/w/api.php';
const CHUNK_SIZE = 50;
const MIN_DELAY = 300;

const WIKI_BY_LANG: Record<string, string> = Object.fromEntries(LANGUAGES.map(l => [`${l}wiki`, l]));
const SITE_FILTER = LANGUAGES.map(l => `${l}wiki`).join('|');
const LANG_FILTER = LANGUAGES.join('|');

let lastRequestTime = 0;

async function request(params: Record<string, string>): Promise<unknown> {
  const wait = MIN_DELAY - (Date.now() - lastRequestTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
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
  labels?: Record<string, { value: string }>;
  sitelinks?: Record<string, { title: string }>;
  claims?: Record<string, WikidataClaim[]>;
}

function bestClaim(claims: WikidataClaim[] | undefined): WikidataClaim | undefined {
  if (!claims || claims.length === 0) return undefined;
  return claims.find(c => c.rank === 'preferred') || claims.find(c => c.rank !== 'deprecated');
}

function entityId(snak: WikidataSnak | undefined): string | null {
  const value = snak?.datavalue?.value as { id?: string } | undefined;
  return value?.id || null;
}

function quantityAmount(snak: WikidataSnak | undefined): number | null {
  const value = snak?.datavalue?.value as { amount?: string } | undefined;
  if (!value?.amount) return null;
  const n = parseFloat(value.amount);
  return Number.isFinite(n) ? n : null;
}

// Wikidata area (P2046) is a quantity with a unit URI; normalize the common ones to km².
const AREA_UNIT_TO_KM2: Record<string, number> = {
  Q712226: 1, // square kilometre
  Q232291: 2.58999, // square mile
  Q25343: 1e-6, // square metre
  Q35852: 0.01, // hectare
};

function areaKm2(snak: WikidataSnak | undefined): number | null {
  const raw = quantityAmount(snak);
  if (raw === null) return null;
  const value = snak?.datavalue?.value as { unit?: string } | undefined;
  const unitQid = value?.unit ? value.unit.replace(/^.*\/entity\//, '') : 'Q712226';
  const factor = AREA_UNIT_TO_KM2[unitQid] ?? 1;
  return parseFloat((raw * factor).toFixed(2));
}

function coordinate(snak: WikidataSnak | undefined): Coord | null {
  const value = snak?.datavalue?.value as { latitude?: number; longitude?: number } | undefined;
  if (typeof value?.latitude !== 'number' || typeof value?.longitude !== 'number') return null;
  return { lat: parseFloat(value.latitude.toFixed(4)), lng: parseFloat(value.longitude.toFixed(4)) };
}

function localizedLabels(entity: WikidataEntity): ReturnType<typeof getEmptyLocalizedField> {
  const field = getEmptyLocalizedField();
  for (const lang of LANGUAGES) {
    const v = entity.labels?.[lang]?.value;
    if (v) field[lang] = v;
  }
  return field;
}

function flagUrl(entity: WikidataEntity): string | null {
  const file = (bestClaim(entity.claims?.['P41'])?.mainsnak?.datavalue?.value as string | undefined) || null;
  if (!file || typeof file !== 'string') return null;
  return `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/\s/g, '_'))}?width=250`;
}

export interface SubdivisionFacts {
  name: ReturnType<typeof getEmptyLocalizedField>;
  sitelinks: Record<string, string>; // lang -> wiki article title
  typeQid: string | null;
  capitalQid: string | null;
  flagUrl: string | null;
  coordinates: Coord | null;
  population: number | null;
  populationYear: number | null;
  areaKm2: number | null;
}

/**
 * Fetches, for each subdivision QID: localized labels (name), per-language Wikipedia
 * article titles (sitelinks), the P31 "instance of" QID (subdivision type), the P36
 * capital QID, plus population (P1082, with the P585 point-in-time qualifier as the
 * reference year), area (P2046), coordinates (P625) and the flag image (P41).
 */
export async function fetchSubdivisionFacts(qids: string[]): Promise<Record<string, SubdivisionFacts>> {
  const result: Record<string, SubdivisionFacts> = {};

  for (const batch of chunk(Array.from(new Set(qids)), CHUNK_SIZE)) {
    try {
      const data = await request({
        ids: batch.join('|'),
        props: 'labels|sitelinks|claims',
        languages: LANG_FILTER,
        sitefilter: SITE_FILTER,
      }) as { entities?: Record<string, WikidataEntity> };

      for (const [id, entity] of Object.entries(data.entities || {})) {
        const claims = entity.claims || {};

        const sitelinks: Record<string, string> = {};
        for (const [wiki, link] of Object.entries(entity.sitelinks || {})) {
          const lang = WIKI_BY_LANG[wiki];
          if (lang && link?.title) sitelinks[lang] = link.title;
        }

        const popClaim = bestClaim(claims['P1082']);
        const yearRaw = popClaim?.qualifiers?.['P585']?.[0]?.datavalue?.value as { time?: string } | undefined;
        const yearMatch = yearRaw?.time?.match(/\+(\d{4})/);
        const population = quantityAmount(popClaim?.mainsnak);

        result[id] = {
          name: localizedLabels(entity),
          sitelinks,
          typeQid: entityId(bestClaim(claims['P31'])?.mainsnak),
          capitalQid: entityId(bestClaim(claims['P36'])?.mainsnak),
          flagUrl: flagUrl(entity),
          coordinates: coordinate(bestClaim(claims['P625'])?.mainsnak),
          population: population !== null ? Math.round(population) : null,
          populationYear: yearMatch ? parseInt(yearMatch[1], 10) : null,
          areaKm2: areaKm2(bestClaim(claims['P2046'])?.mainsnak),
        };
      }
    } catch (e) {
      console.error(`Subdivision facts lookup failed for a batch: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}

export interface ResolvedEntity {
  name: ReturnType<typeof getEmptyLocalizedField>;
  coordinates: Coord | null;
}

/** Resolves secondary QIDs (subdivision types, capital cities) to localized labels + coordinates. */
export async function resolveEntities(qids: string[]): Promise<Record<string, ResolvedEntity>> {
  const result: Record<string, ResolvedEntity> = {};
  const unique = Array.from(new Set(qids.filter(Boolean)));

  for (const batch of chunk(unique, CHUNK_SIZE)) {
    try {
      const data = await request({
        ids: batch.join('|'),
        props: 'labels|claims',
        languages: LANG_FILTER,
      }) as { entities?: Record<string, WikidataEntity> };

      for (const [id, entity] of Object.entries(data.entities || {})) {
        result[id] = {
          name: localizedLabels(entity),
          coordinates: coordinate(bestClaim(entity.claims?.['P625'])?.mainsnak),
        };
      }
    } catch (e) {
      console.error(`Entity resolution failed for a batch: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}
