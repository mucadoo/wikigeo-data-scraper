import { vi, describe, beforeEach, it, expect } from 'vitest';
import axios from 'axios';
import { enumerateSubdivisions } from '../src/scraper/utils/wikidata-sparql.js';

vi.mock('axios');
const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn>; isAxiosError: typeof axios.isAxiosError };
mockedAxios.isAxiosError = ((): boolean => false) as unknown as typeof axios.isAxiosError;

const binding = (qid: string, code: string, countryCode: string) => ({
  item: { value: `http://www.wikidata.org/entity/${qid}` },
  code: { value: code },
  cc: { value: countryCode },
});

describe('enumerateSubdivisions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps only wanted countries, well-formed codes, and de-duplicates', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        results: {
          bindings: [
            binding('Q99', 'US-CA', 'US'),
            binding('Q1384', 'US-NY', 'US'),
            binding('Q99', 'US-CA', 'US'), // duplicate
            binding('Q1490', 'JP-13', 'JP'), // country not wanted
            binding('Q1', 'US-CALIFORNIA', 'US'), // malformed code
            binding('Q2', 'US-XX', 'CA'), // code/country mismatch
          ],
        },
      },
    });

    const result = await enumerateSubdivisions(['US']);
    expect(result).toEqual([
      { wikidataId: 'Q99', code: 'US-CA', countryIsoCode: 'US' },
      { wikidataId: 'Q1384', code: 'US-NY', countryIsoCode: 'US' },
    ]);
  });

  it('returns results sorted by ISO 3166-2 code', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { results: { bindings: [binding('Q3', 'FR-NOR', 'FR'), binding('Q4', 'FR-ARA', 'FR')] } },
    });
    const result = await enumerateSubdivisions(['fr']);
    expect(result.map(r => r.code)).toEqual(['FR-ARA', 'FR-NOR']);
  });
});
