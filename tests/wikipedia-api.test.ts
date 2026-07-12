import { WikipediaAPI } from '../src/scraper/utils/wikipedia-api.js';
import fs from 'fs';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import axios from 'axios';

// Mocking fs and axios
vi.mock('fs');
vi.mock('axios');

const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };

describe('WikipediaAPI fetchWikitext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (WikipediaAPI as any).isSnapshotMode = false;
  });

  test('fetches wikitext from API', async () => {
    const mockResponse = {
      data: {
        query: {
          pages: {
            '123': {
              revisions: [{ slots: { main: { '*': 'some wikitext' } } }]
            }
          }
        }
      }
    };
    mockedAxios.get.mockResolvedValue(mockResponse);

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
