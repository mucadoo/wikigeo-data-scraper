import { vi, describe, beforeEach, it, expect } from 'vitest';
import axios from 'axios';
import { fetchSubdivisionFacts, resolveEntities, resolveIso3166_2 } from '../src/scraper/utils/subdivision-enrich.js';

vi.mock('axios');
const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };

describe('fetchSubdivisionFacts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extracts localized name, sitelinks, type/capital qids, population(+year), area and flag', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        entities: {
          Q99: {
            labels: { en: { value: 'California' }, pt: { value: 'Califórnia' }, ja: { value: 'カリフォルニア州' } },
            sitelinks: { enwiki: { title: 'California' }, ptwiki: { title: 'Califórnia' }, dewiki: { title: 'Kalifornien' } },
            claims: {
              P1082: [{
                mainsnak: { datavalue: { value: { amount: '+39538223' } } },
                rank: 'preferred',
                qualifiers: { P585: [{ datavalue: { value: { time: '+2020-04-01T00:00:00Z' } } }] },
              }],
              P2046: [{ mainsnak: { datavalue: { value: { amount: '+423967', unit: 'http://www.wikidata.org/entity/Q712226' } } }, rank: 'normal' }],
              P31: [{ mainsnak: { datavalue: { value: { id: 'Q35657' } } }, rank: 'normal' }],
              P36: [{ mainsnak: { datavalue: { value: { id: 'Q34647' } } }, rank: 'normal' }],
              P41: [{ mainsnak: { datavalue: { value: 'Flag of California.svg' } }, rank: 'normal' }],
              P625: [{ mainsnak: { datavalue: { value: { latitude: 37.0, longitude: -120.0 } } }, rank: 'normal' }],
            },
          },
        },
      },
    });

    const result = await fetchSubdivisionFacts(['Q99']);
    expect(result.Q99).toMatchObject({
      typeQid: 'Q35657',
      capitalQid: 'Q34647',
      flagUrl: 'https://en.wikipedia.org/wiki/Special:FilePath/Flag_of_California.svg?width=250',
      coordinates: { lat: 37, lng: -120 },
      population: 39538223,
      populationYear: 2020,
      areaKm2: 423967,
    });
    expect(result.Q99.name.pt).toBe('Califórnia');
    expect(result.Q99.sitelinks).toEqual({ en: 'California', pt: 'Califórnia', de: 'Kalifornien' });
  });

  it('collects non-deprecated official-language (P37) and border (P47) qids', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        entities: {
          Q1: {
            labels: { en: { value: 'X' } }, sitelinks: {},
            claims: {
              P37: [
                { mainsnak: { datavalue: { value: { id: 'Q1860' } } }, rank: 'normal' },
                { mainsnak: { datavalue: { value: { id: 'Q150' } } }, rank: 'deprecated' },
              ],
              P47: [{ mainsnak: { datavalue: { value: { id: 'Q1384' } } }, rank: 'normal' }],
            },
          },
        },
      },
    });
    const result = await fetchSubdivisionFacts(['Q1']);
    expect(result.Q1.officialLanguageQids).toEqual(['Q1860']);
    expect(result.Q1.borderQids).toEqual(['Q1384']);
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
    const result = await fetchSubdivisionFacts(['Q1']);
    expect(result.Q1.areaKm2).toBeCloseTo(258.999, 2);
  });

  it('does not throw when a batch fails', async () => {
    mockedAxios.get.mockRejectedValue(new Error('boom'));
    expect(await fetchSubdivisionFacts(['Q1'])).toEqual({});
  });
});

describe('resolveEntities', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves localized labels and coordinates', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        entities: {
          Q34647: {
            labels: { en: { value: 'Sacramento' }, fr: { value: 'Sacramento' } },
            claims: { P625: [{ mainsnak: { datavalue: { value: { latitude: 38.58, longitude: -121.49 } } }, rank: 'normal' }] },
          },
        },
      },
    });
    const result = await resolveEntities(['Q34647']);
    expect(result.Q34647.name.en).toBe('Sacramento');
    expect(result.Q34647.coordinates).toEqual({ lat: 38.58, lng: -121.49 });
  });
});

describe('resolveIso3166_2', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps qids to their uppercased P300 code and omits items without one', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        entities: {
          Q1384: { claims: { P300: [{ mainsnak: { datavalue: { value: 'us-ny' } }, rank: 'normal' }] } },
          Q30: { claims: {} },
        },
      },
    });
    const result = await resolveIso3166_2(['Q1384', 'Q30']);
    expect(result).toEqual({ Q1384: 'US-NY' });
  });
});
