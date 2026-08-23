import { vi, describe, beforeEach, it, expect } from 'vitest';
import axios from 'axios';
import { fetchWorldBankIndicators, WORLD_BANK_INDICATORS } from '../src/scraper/utils/worldbank.js';

vi.mock('axios');
const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };

function rowsFor(indicatorCode: string, rows: { id: string; date: string; value: number | null }[]) {
  return {
    data: [
      { page: 1 },
      rows.map(r => ({ country: { id: r.id }, date: r.date, value: r.value })),
    ],
  };
}

describe('fetchWorldBankIndicators', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps only the latest year per requested ISO code, and scales GDP to millions', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes(WORLD_BANK_INDICATORS.gdp.code)) {
        return Promise.resolve(rowsFor('gdp', [
          { id: 'FR', date: '2020', value: 2_600_000_000_000 },
          { id: 'FR', date: '2022', value: 2_800_000_000_000 },
          { id: 'DE', date: '2022', value: 4_000_000_000_000 },
        ]));
      }
      return Promise.resolve(rowsFor('other', []));
    });

    const result = await fetchWorldBankIndicators(['FR']);

    // Only FR was requested, and only the newer (2022) row should win.
    expect(result.FR?.gdp).toEqual({ value: 2_800_000, year: 2022 });
    expect(result.DE).toBeUndefined();
  });

  it('skips rows with a null value', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes(WORLD_BANK_INDICATORS.lifeExpectancy.code)) {
        return Promise.resolve(rowsFor('lifeExpectancy', [{ id: 'FR', date: '2022', value: null }]));
      }
      return Promise.resolve(rowsFor('other', []));
    });

    const result = await fetchWorldBankIndicators(['FR']);
    expect(result.FR?.lifeExpectancy).toBeUndefined();
  });

  it('does not scale non-GDP metrics', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes(WORLD_BANK_INDICATORS.unemploymentRate.code)) {
        return Promise.resolve(rowsFor('unemploymentRate', [{ id: 'FR', date: '2022', value: 7.3 }]));
      }
      return Promise.resolve(rowsFor('other', []));
    });

    const result = await fetchWorldBankIndicators(['FR']);
    expect(result.FR?.unemploymentRate).toEqual({ value: 7.3, year: 2022 });
  });

  it('continues fetching other indicators when one indicator request fails', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes(WORLD_BANK_INDICATORS.gdp.code)) {
        return Promise.reject(new Error('World Bank API down'));
      }
      if (url.includes(WORLD_BANK_INDICATORS.lifeExpectancy.code)) {
        return Promise.resolve(rowsFor('lifeExpectancy', [{ id: 'FR', date: '2022', value: 82.5 }]));
      }
      return Promise.resolve(rowsFor('other', []));
    });

    const result = await fetchWorldBankIndicators(['FR']);
    expect(result.FR?.gdp).toBeUndefined();
    expect(result.FR?.lifeExpectancy).toEqual({ value: 82.5, year: 2022 });
  });
});
