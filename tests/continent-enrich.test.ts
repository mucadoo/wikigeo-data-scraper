import { vi, describe, beforeEach, it, expect } from 'vitest';
import axios from 'axios';
import { fetchContinentFacts } from '../src/scraper/utils/continent-enrich.js';

vi.mock('axios');
const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };

describe('fetchContinentFacts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extracts localized name, sitelinks, population(+year), area and coordinates', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        entities: {
          Q46: {
            labels: { en: { value: 'Europe' }, pt: { value: 'Europa' }, ja: { value: 'ヨーロッパ' } },
            sitelinks: { enwiki: { title: 'Europe' }, ptwiki: { title: 'Europa' }, dewiki: { title: 'Europa' } },
            claims: {
              P1082: [{
                mainsnak: { datavalue: { value: { amount: '+745000000' } } },
                rank: 'normal',
                qualifiers: { P585: [{ datavalue: { value: { time: '+2023-01-01T00:00:00Z' } } }] },
              }],
              P2046: [{ mainsnak: { datavalue: { value: { amount: '+10180000', unit: 'http://www.wikidata.org/entity/Q712226' } } }, rank: 'normal' }],
              P625: [{ mainsnak: { datavalue: { value: { latitude: 50.0, longitude: 15.0 } } }, rank: 'normal' }],
            },
          },
        },
      },
    });

    const result = await fetchContinentFacts(['Q46']);
    expect(result.Q46).toMatchObject({
      coordinates: { lat: 50, lng: 15 },
      population: 745000000,
      populationYear: 2023,
      areaKm2: 10180000,
    });
    expect(result.Q46.name.pt).toBe('Europa');
    expect(result.Q46.sitelinks).toEqual({ en: 'Europe', pt: 'Europa', de: 'Europa' });
  });

  it('converts square-mile area units to km²', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        entities: {
          Q1: {
            labels: { en: { value: 'X' } }, sitelinks: {},
            claims: { P2046: [{ mainsnak: { datavalue: { value: { amount: '+100', unit: 'http://www.wikidata.org/entity/Q232291' } } }, rank: 'normal' }] },
          },
        },
      },
    });
    const result = await fetchContinentFacts(['Q1']);
    expect(result.Q1.areaKm2).toBeCloseTo(258.999, 2);
  });

  it('returns an empty object with no ids and does not throw when the request fails', async () => {
    expect(await fetchContinentFacts([])).toEqual({});
    mockedAxios.get.mockRejectedValue(new Error('boom'));
    expect(await fetchContinentFacts(['Q1'])).toEqual({});
  });
});
