import axios from 'axios';
import fs from 'fs';

interface WikipediaLangLink {
  lang: string;
  '*': string;
}

interface WikipediaPage {
  title: string;
  langlinks?: WikipediaLangLink[];
  revisions?: {
    slots?: {
      main?: {
        '*': string;
      };
    };
  }[];
}

interface WikipediaRedirect {
  from: string;
  to: string;
}

interface WikipediaQueryResponse {
  query?: {
    pages?: Record<string, WikipediaPage>;
    redirects?: WikipediaRedirect[];
    normalized?: WikipediaRedirect[];
  };
}

export class WikipediaAPI {
  private static snapshotData: Record<string, Record<string, string>> | null = null;
  private static isSnapshotMode = false;
  private static USER_AGENT = 'WikiGeoDataScraper/1.0 (mucadoo@personal.dev)';
  private static lastRequestTime = 0;
  private static MIN_DELAY = 500; // 2 requests per second

  private static async request(url: string): Promise<unknown> {
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
          let retryAfterSeconds = 5;
          if (isRateLimit && axios.isAxiosError(error) && error.response) {
            const header = error.response.headers['retry-after'];
            if (header) retryAfterSeconds = parseInt(header, 10);
          }
          const delay = (retryAfterSeconds + (5 - retries) * 2) * 1000;
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
    const data = await this.request(url) as { query: { categorymembers: { title: string }[] } };
    return data.query.categorymembers.map(m => m.title);
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
    
    const data = await this.request(url) as WikipediaQueryResponse;
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
   * Fetches wikitext for many article titles in one language, batched 50 titles per request
   * (the MediaWiki API's per-request page cap). Returns a map keyed by both the requested
   * title and the resolved (normalized / redirected) title. Used for subdivision descriptions,
   * where thousands of short intro paragraphs are needed across nine languages.
   */
  static async fetchWikitextBatch(titles: string[], lang: string = 'en'): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    const pending: string[] = [];

    for (const title of titles) {
      if (this.isSnapshotMode) {
        const filePath = `tests/snapshots/wikitext/${lang}/${this.sanitize(title)}.txt`;
        if (fs.existsSync(filePath)) {
          out[title] = fs.readFileSync(filePath, 'utf-8');
          continue;
        }
        // In snapshot mode, silently skip titles with no fixture.
        continue;
      }
      pending.push(title);
    }

    for (let i = 0; i < pending.length; i += 50) {
      const chunk = pending.slice(i, i + 50);
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&redirects=1&titles=${chunk.map(encodeURIComponent).join('|')}`;

      try {
        const data = await this.request(url) as WikipediaQueryResponse;
        const query = data?.query;
        if (!query?.pages) continue;

        // Map resolved titles back to the originally requested ones.
        const backMap: Record<string, string> = {};
        [...(query.normalized || []), ...(query.redirects || [])].forEach(r => { backMap[r.to] = backMap[r.from] || r.from; });
        const resolveOriginal = (t: string): string => {
          let cur = t;
          for (let hops = 0; hops < 4 && backMap[cur]; hops++) cur = backMap[cur];
          return cur;
        };

        Object.values(query.pages).forEach(page => {
          const wikitext = page?.revisions?.[0]?.slots?.main?.['*'];
          if (typeof wikitext !== 'string') return;
          out[page.title] = wikitext;
          const original = resolveOriginal(page.title);
          if (original) out[original] = wikitext;
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to fetch wikitext batch (${lang}): ${message}`);
      }
    }

    return out;
  }

  /**
   * Fetches clean plain-text intro extracts (TextExtracts extension) for a handful of article
   * titles in one language, batched 20 per request (the extension's `explaintext` page cap).
   * Returns a map keyed by both the requested and the resolved (normalized / redirected) title.
   * Preferred over wikitext parsing for a small set of prominent articles (e.g. continents)
   * whose leads carry heavy pronunciation / footnote templates the wikitext parser trips on.
   */
  static async fetchExtractsBatch(titles: string[], lang: string = 'en', sentences: number = 3): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    if (this.isSnapshotMode || titles.length === 0) return out;

    for (let i = 0; i < titles.length; i += 20) {
      const chunk = titles.slice(i, i + 20);
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exsentences=${sentences}&exlimit=20&redirects=1&format=json&titles=${chunk.map(encodeURIComponent).join('|')}`;

      try {
        const data = await this.request(url) as WikipediaQueryResponse & { query?: { pages?: Record<string, { title: string; extract?: string }> } };
        const query = data?.query;
        if (!query?.pages) continue;

        const backMap: Record<string, string> = {};
        [...(query.normalized || []), ...(query.redirects || [])].forEach(r => { backMap[r.to] = backMap[r.from] || r.from; });
        const resolveOriginal = (t: string): string => {
          let cur = t;
          for (let hops = 0; hops < 4 && backMap[cur]; hops++) cur = backMap[cur];
          return cur;
        };

        Object.values(query.pages).forEach(page => {
          const extract = page?.extract;
          if (typeof extract !== 'string' || !extract.trim()) return;
          const cleaned = extract.replace(/\s+/g, ' ').trim();
          out[page.title] = cleaned;
          const original = resolveOriginal(page.title);
          if (original) out[original] = cleaned;
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to fetch extract batch (${lang}): ${message}`);
      }
    }

    return out;
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
          if (!query || !query.pages) continue;
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
