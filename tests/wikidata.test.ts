import { vi, describe, beforeEach, it, expect } from 'vitest';
import axios from 'axios';
import { fetchWikidataFacts, resolveLabels, resolveIsoCodes } from '../src/scraper/utils/wikidata.js';

vi.mock('axios');
const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };

describe('fetchWikidataFacts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extracts population year, driving-side item, and non-deprecated border qids', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        entities: {
          Q142: {
            sitelinks: { enwiki: { title: 'France' } },
            claims: {
              P1082: [{
                mainsnak: { datavalue: { value: 67000000 } },
                rank: 'preferred',
                qualifiers: { P585: [{ datavalue: { value: { time: '+2021-00-00T00:00:00Z' } } }] },
              }],
              P1622: [{ mainsnak: { datavalue: { value: { id: 'Q45871' } } }, rank: 'normal' }],
              P47: [
                { mainsnak: { datavalue: { value: { id: 'Q183' } } }, rank: 'normal' },
                { mainsnak: { datavalue: { value: { id: 'Q39' } } }, rank: 'deprecated' },
              ],
            },
          },
        },
      },
    });

    const result = await fetchWikidataFacts(['France']);

    expect(result.France).toEqual({
      populationYear: 2021,
      drivingSideQid: 'Q45871',
      borderQids: ['Q183'],
    });
  });

  it('prefers the claim ranked "preferred" over other non-deprecated claims', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        entities: {
          Q142: {
            sitelinks: { enwiki: { title: 'France' } },
            claims: {
              P1082: [
                { mainsnak: { datavalue: { value: 1 } }, rank: 'normal', qualifiers: { P585: [{ datavalue: { value: { time: '+2019-00-00T00:00:00Z' } } }] } },
                { mainsnak: { datavalue: { value: 2 } }, rank: 'preferred', qualifiers: { P585: [{ datavalue: { value: { time: '+2022-00-00T00:00:00Z' } } }] } },
              ],
            },
          },
        },
      },
    });

    const result = await fetchWikidataFacts(['France']);
    expect(result.France.populationYear).toBe(2022);
  });

  it('skips entities with no enwiki sitelink', async () => {
    mockedAxios.get.mockResolvedValue({ data: { entities: { Q1: { claims: {} } } } });
    const result = await fetchWikidataFacts(['Unknown']);
    expect(result).toEqual({});
  });

  it('does not throw when a batch request fails, and returns an empty result', async () => {
    mockedAxios.get.mockRejectedValue(new Error('network down'));
    const result = await fetchWikidataFacts(['France']);
    expect(result).toEqual({});
  });
});

describe('resolveLabels', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves english labels for the given qids', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { entities: { Q45871: { labels: { en: { value: 'right-hand traffic' } } } } },
    });

    const result = await resolveLabels(['Q45871']);
    expect(result).toEqual({ Q45871: 'right-hand traffic' });
  });

  it('omits qids with no english label', async () => {
    mockedAxios.get.mockResolvedValue({ data: { entities: { Q1: { labels: {} } } } });
    const result = await resolveLabels(['Q1']);
    expect(result).toEqual({});
  });
});

describe('resolveIsoCodes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves and uppercases the P297 ISO code claim', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        entities: {
          Q183: { claims: { P297: [{ mainsnak: { datavalue: { value: 'de' } }, rank: 'normal' }] } },
        },
      },
    });

    const result = await resolveIsoCodes(['Q183']);
    expect(result).toEqual({ Q183: 'DE' });
  });

  it('omits entities with no P297 claim', async () => {
    mockedAxios.get.mockResolvedValue({ data: { entities: { Q1: { claims: {} } } } });
    const result = await resolveIsoCodes(['Q1']);
    expect(result).toEqual({});
  });
});
