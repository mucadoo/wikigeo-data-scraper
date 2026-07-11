import axios from 'axios';
import fs from 'fs';

interface WikipediaLangLink {
  lang: string;
  '*': string;
}

interface WikipediaPage {
  title: string;
  langlinks?: WikipediaLangLink[];
}

interface WikipediaRedirect {
  from: string;
  to: string;
}

interface WikipediaQueryResponse {
  query?: {
    pages?: Record<string, WikipediaPage>;
    redirects?: WikipediaRedirect[];
  };
}

export class WikipediaAPI {
  private static snapshotData: Record<string, Record<string, string>> | null = null;
  private static isSnapshotMode = false;
  private static USER_AGENT = 'WikiGeoDataScraper/1.0 (mucadoo@personal.dev)';
  private static lastRequestTime = 0;
  private static MIN_DELAY = 500; // 2 requests per second

  private static async request(url: string): Promise<any> {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;
    if (timeSinceLast < this.MIN_DELAY) {
      await new Promise(resolve => setTimeout(resolve, this.MIN_DELAY - timeSinceLast));
    }

    let retries = 5;
    while (retries > 0) {
      try {
        this.lastRequestTime = Date.now();
        const response = await axios.get(url, {
          headers: { 'User-Agent': this.USER_AGENT },
          timeout: 30000
        });
        return response.data;
      } catch (error: unknown) {
        const isRateLimit = axios.isAxiosError(error) && error.response?.status === 429;
        const isNetworkError = axios.isAxiosError(error) && (!error.response || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT');
        
        if ((isRateLimit || isNetworkError) && retries > 1) {
          const retryAfter = isRateLimit ? parseInt((error as any).response.headers['retry-after'] || '5', 10) : 2;
          const delay = (retryAfter + (5 - retries) * 2) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          retries--;
          continue;
        }
        throw error;
      }
    }
    throw new Error('Request failed after retries');
  }

  /**
   * Enables snapshot mode and loads translations from a file.
   * Useful for offline tests.
   */
  static useSnapshots(filePath: string = 'tests/snapshots/translations.json'): void {
    this.isSnapshotMode = true;
    if (fs.existsSync(filePath)) {
      this.snapshotData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  }

  private static sanitize(name: string): string {
    try {
      name = decodeURIComponent(name);
    } catch {
      // Ignore decode errors
    }
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  /**
   * Fetches members of a Wikipedia category.
   */
  static async fetchCategoryMembers(category: string, limit: number = 500): Promise<string[]> {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(category)}&cmlimit=${limit}&format=json`;
    const data = await this.request(url);
    return data.query.categorymembers.map((m: any) => m.title);
  }

  /**
   * Fetches wikitext for a given Wikipedia article title.
   */
  static async fetchWikitext(title: string, lang: string = 'en'): Promise<string> {
    if (this.isSnapshotMode) {
      const filePath = `tests/snapshots/wikitext/${lang}/${this.sanitize(title)}.txt`;
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
      }
    }

    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&redirects=1&titles=${encodeURIComponent(title)}`;
    
    const data = await this.request(url);
    const pages = data?.query?.pages;
    if (!pages) throw new Error('Unexpected API response shape');

    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') throw new Error(`Page '${title}' not found`);

    const page = pages[pageId];
    const wikitext = page?.revisions?.[0]?.slots?.main?.['*'];

    if (typeof wikitext !== 'string') {
      throw new Error(`Wikitext not found for page '${title}'`);
    }

    return wikitext;
  }

  /**
   * Fetches translations for given Wikipedia article titles.
   * @param articles List of Wikipedia article titles (e.g., 'Paris', 'Euro').
   * @param targetLangs Array of target language codes (e.g., ['pt', 'fr', 'it', 'es']).
   * @returns Mapping of article titles to translated titles per language: Record<ArticleTitle, Record<LangCode, TranslatedTitle>>
   */
  static async fetchTranslations(articles: string[], targetLangs: string[]): Promise<Record<string, Record<string, string>>> {
    if (articles.length === 0) return {};

    if (this.isSnapshotMode && this.snapshotData) {
      const result: Record<string, Record<string, string>> = {};
      articles.forEach(article => {
        const normalized = article.replace(/_/g, ' ');
        if (this.snapshotData![normalized]) {
          result[normalized] = this.snapshotData![normalized];
        }
      });
      return result;
    }

    const mapping: Record<string, Record<string, string>> = {};
    const chunkSize = 50;
    
    for (let i = 0; i < articles.length; i += chunkSize) {
      const chunk = articles.slice(i, i + chunkSize);
      
      for (const targetLang of targetLangs) {
        const url = `https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=${targetLang}&lllimit=max&redirects=1&format=json&titles=${chunk.map(encodeURIComponent).join('|')}`;
        
        try {
          const data = await this.request(url);
          const query = (data as WikipediaQueryResponse).query;
          if (!query || !query.pages) break;
          const pages = query.pages;
          
          // Map redirects back to original requested title
          const redirectMap: Record<string, string> = {};
          query.redirects?.forEach((r) => { redirectMap[r.to] = r.from; });

          Object.values(pages).forEach((page) => {
            const originalTitle = redirectMap[page.title] || page.title;
            if (!mapping[originalTitle]) mapping[originalTitle] = {};
            
            if (page.langlinks) {
              page.langlinks.forEach((link) => {
                mapping[originalTitle][link.lang] = link['*'];
              });
            }
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Failed to fetch translations for chunk (${targetLang}): ${message}`);
        }
      }
    }

    return mapping;
  }
}
