import { WikipediaAPI } from '../src/scraper/utils/wikipedia-api.js';
import fs from 'fs';
import { vi, describe, beforeEach, afterEach, test, it, expect } from 'vitest';
import axios from 'axios';

// Mocking fs and axios
vi.mock('fs');
vi.mock('axios');

const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn>; isAxiosError: ReturnType<typeof vi.fn> };

function wikitextResponse(text: string) {
  return { data: { query: { pages: { '1': { revisions: [{ slots: { main: { '*': text } } }] } } } } };
}

describe('WikipediaAPI fetchWikitext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (WikipediaAPI as any).isSnapshotMode = false;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (WikipediaAPI as any).lastRequestTime = 0;
  });

  test('fetches wikitext from API', async () => {
    mockedAxios.get.mockResolvedValue(wikitextResponse('some wikitext'));

    const wikitext = await WikipediaAPI.fetchWikitext('TestPage');
    expect(wikitext).toBe('some wikitext');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('titles=TestPage'),
      expect.any(Object)
    );
  });

  test('uses snapshot if available', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('snapshot wikitext');

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (WikipediaAPI as any).isSnapshotMode = true;
    const wikitext = await WikipediaAPI.fetchWikitext('TestPage');

    expect(wikitext).toBe('snapshot wikitext');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  test('throws error for missing page', async () => {
    const mockResponse = {
      data: {
        query: {
          pages: {
            '-1': {}
          }
        }
      }
    };
    mockedAxios.get.mockResolvedValue(mockResponse);

    await expect(WikipediaAPI.fetchWikitext('NonExistent')).rejects.toThrow("Page 'NonExistent' not found");
  });
});

describe('WikipediaAPI request retry/backoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (WikipediaAPI as any).isSnapshotMode = false;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (WikipediaAPI as any).lastRequestTime = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries after a 429 (honoring Retry-After) and eventually succeeds', async () => {
    const rateLimitError = Object.assign(new Error('Too Many Requests'), {
      response: { status: 429, headers: { 'retry-after': '1' } },
    });
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce(wikitextResponse('recovered'));

    const promise = WikipediaAPI.fetchWikitext('TestPage');
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('recovered');
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-retryable HTTP error (e.g. 404) and fails immediately', async () => {
    const notFoundError = Object.assign(new Error('Not Found'), {
      response: { status: 404, headers: {} },
    });
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockRejectedValue(notFoundError);

    await expect(WikipediaAPI.fetchWikitext('TestPage')).rejects.toThrow('Not Found');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('throttles consecutive requests to respect the minimum delay between calls', async () => {
    mockedAxios.get.mockResolvedValue(wikitextResponse('ok'));

    const first = WikipediaAPI.fetchWikitext('PageOne');
    await vi.runAllTimersAsync();
    await first;

    const second = WikipediaAPI.fetchWikitext('PageTwo');
    // Immediately after the first call returns, the request is still throttled - the second
    // axios call must not have fired yet.
    await vi.advanceTimersByTimeAsync(1);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);

    await vi.runAllTimersAsync();
    await second;
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });
});

describe('WikipediaAPI fetchTranslations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (WikipediaAPI as any).isSnapshotMode = false;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (WikipediaAPI as any).lastRequestTime = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an empty mapping without making a request for an empty article list', async () => {
    const result = await WikipediaAPI.fetchTranslations([], ['fr']);
    expect(result).toEqual({});
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('maps each article title to its per-language translation', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('lllang=fr')) {
        return Promise.resolve({
          data: { query: { pages: { '1': { title: 'France', langlinks: [{ lang: 'fr', '*': 'France' }] } } } },
        });
      }
      return Promise.resolve({
        data: { query: { pages: { '1': { title: 'France', langlinks: [{ lang: 'de', '*': 'Frankreich' }] } } } },
      });
    });

    const promise = WikipediaAPI.fetchTranslations(['France'], ['fr', 'de']);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ France: { fr: 'France', de: 'Frankreich' } });
  });

  it('remaps a redirected page back to the originally-requested title', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        query: {
          pages: { '1': { title: 'French Republic', langlinks: [{ lang: 'fr', '*': 'France' }] } },
          redirects: [{ from: 'France', to: 'French Republic' }],
        },
      },
    });

    const promise = WikipediaAPI.fetchTranslations(['France'], ['fr']);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ France: { fr: 'France' } });
  });

  it('logs and continues with the next language when one language request throws', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('lllang=fr')) return Promise.reject(new Error('fr lookup failed'));
      return Promise.resolve({
        data: { query: { pages: { '1': { title: 'France', langlinks: [{ lang: 'de', '*': 'Frankreich' }] } } } },
      });
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const promise = WikipediaAPI.fetchTranslations(['France'], ['fr', 'de']);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ France: { de: 'Frankreich' } });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('fr'));
  });

  it('skips only the language whose response is malformed, not the languages after it', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('lllang=fr')) return Promise.resolve({ data: {} }); // no `query` at all
      return Promise.resolve({
        data: { query: { pages: { '1': { title: 'France', langlinks: [{ lang: 'de', '*': 'Frankreich' }] } } } },
      });
    });

    const promise = WikipediaAPI.fetchTranslations(['France'], ['fr', 'de']);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ France: { de: 'Frankreich' } });
  });
});
