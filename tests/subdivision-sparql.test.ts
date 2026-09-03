import { vi, describe, beforeEach, it, expect } from 'vitest';
import axios from 'axios';
import { enumerateSubdivisions, enumerateSecondLevelSubdivisions } from '../src/scraper/utils/wikidata-sparql.js';

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

const l2binding = (qid: string, code: string, cc: string, parentQid: string) => ({
  ...binding(qid, code, cc),
  parent: { value: `http://www.wikidata.org/entity/${parentQid}` },
});

describe('enumerateSecondLevelSubdivisions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the containing subdivision QID and drops codes already claimed at level 1', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        results: {
          bindings: [
            l2binding('Q16247', 'IT-MI', 'IT', 'Q1257'), // province of Milan, parent Lombardy
            l2binding('Q16145', 'IT-BG', 'IT', 'Q1257'),
            l2binding('Q1257', 'IT-25', 'IT', 'Q38'),    // Lombardy itself - already a level-1 code
          ],
        },
      },
    });

    const result = await enumerateSecondLevelSubdivisions(['IT'], ['IT-25']);
    expect(result).toEqual([
      { wikidataId: 'Q16145', code: 'IT-BG', countryIsoCode: 'IT', parentWikidataId: 'Q1257' },
      { wikidataId: 'Q16247', code: 'IT-MI', countryIsoCode: 'IT', parentWikidataId: 'Q1257' },
    ]);
  });

  it('applies the same code/country validation as the first-level enumerator', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        results: {
          bindings: [
            l2binding('Q1', 'IT-PROVINCE', 'IT', 'Q1257'), // malformed
            l2binding('Q2', 'FR-01', 'IT', 'Q1257'),       // code/country mismatch
            l2binding('Q3', 'IT-TO', 'IT', 'Q1257'),
          ],
        },
      },
    });
    const result = await enumerateSecondLevelSubdivisions(['IT']);
    expect(result.map(r => r.code)).toEqual(['IT-TO']);
  });
});
