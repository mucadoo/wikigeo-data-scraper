import axios from 'axios';

const USER_AGENT = 'WikiGeoDataScraper/1.0 (mucadoo@personal.dev)';
const YEAR_RANGE = '2015:2027';

// GDP figures come back in raw USD; the rest of this dataset stores GDP totals in millions USD.
export const WORLD_BANK_INDICATORS = {
  gdp: { code: 'NY.GDP.MKTP.CD', scale: 1 / 1_000_000 },
  gdpPerCapita: { code: 'NY.GDP.PCAP.CD', scale: 1 },
  gdpPpp: { code: 'NY.GDP.MKTP.PP.CD', scale: 1 / 1_000_000 },
  gdpPerCapitaPpp: { code: 'NY.GDP.PCAP.PP.CD', scale: 1 },
  lifeExpectancy: { code: 'SP.DYN.LE00.IN', scale: 1 },
  internetUsagePercent: { code: 'IT.NET.USER.ZS', scale: 1 },
  unemploymentRate: { code: 'SL.UEM.TOTL.ZS', scale: 1 },
} as const;

export type WorldBankMetric = keyof typeof WORLD_BANK_INDICATORS;

interface WorldBankPoint {
  value: number;
  year: number;
}

interface WorldBankRow {
  country: { id: string };
  date: string;
  value: number | null;
}

/**
 * Fetches every country's value for one indicator in a single request (`country/all`,
 * one page comfortably covers ~265 entities x 13 years), then keeps only the requested
 * ISO codes client-side.
 *
 * Deliberately avoids building a `country/XX;YY;ZZ` path with our own list of codes: the
 * API's edge/WAF rejects some (but not all - it's content-sensitive, not a simple length
 * limit) semicolon-joined country lists with a 403 for reasons that didn't reduce to a
 * clean rule under testing. `country/all` sidesteps that entirely.
 */
async function fetchIndicator(wantedIsoCodes: Set<string>, indicatorCode: string): Promise<Record<string, WorldBankPoint>> {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${indicatorCode}`;
  const { data } = await axios.get(url, {
    params: { format: 'json', per_page: 20000, date: YEAR_RANGE },
    headers: { 'User-Agent': USER_AGENT },
    timeout: 30000,
  });

  const rows = (data?.[1] || []) as WorldBankRow[];
  const latest: Record<string, WorldBankPoint> = {};

  for (const row of rows) {
    if (row.value === null) continue;
    const isoCode = row.country?.id;
    const year = parseInt(row.date, 10);
    if (!isoCode || !wantedIsoCodes.has(isoCode) || isNaN(year)) continue;
    if (!latest[isoCode] || latest[isoCode].year < year) {
      latest[isoCode] = { value: row.value, year };
    }
  }

  return latest;
}

/**
 * Fetches the latest available value for each World Bank indicator (one HTTP call per
 * indicator, covering every country at once). Authoritative, versioned economic/social
 * data - used in place of parsing GDP figures out of wikitext prose, which is fragile
 * (e.g. source typos like "$113,494 billion").
 */
export async function fetchWorldBankIndicators(isoCodes: string[]): Promise<Record<string, Partial<Record<WorldBankMetric, WorldBankPoint>>>> {
  const result: Record<string, Partial<Record<WorldBankMetric, WorldBankPoint>>> = {};
  const wanted = new Set(isoCodes);

  for (const [metric, { code, scale }] of Object.entries(WORLD_BANK_INDICATORS) as [WorldBankMetric, typeof WORLD_BANK_INDICATORS[WorldBankMetric]][]) {
    try {
      const byCountry = await fetchIndicator(wanted, code);
      Object.entries(byCountry).forEach(([isoCode, point]) => {
        result[isoCode] = result[isoCode] || {};
        result[isoCode][metric] = { value: point.value * scale, year: point.year };
      });
    } catch (e) {
      console.error(`World Bank indicator ${code} fetch failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}
