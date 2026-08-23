import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseCountryFromWikitext } from '../src/scraper/parsers/wikitext-country-parser.js';

// Regression corpus of real English Wikipedia country articles (frozen snapshots, no network
// access). This catches parser crashes/regressions against messy real-world wikitext that
// hand-written fixtures wouldn't reproduce.
describe('parseCountryFromWikitext (real-article corpus)', () => {
  const corpusDir = path.join(process.cwd(), 'tests/snapshots/wikitext/en');
  const files = fs.readdirSync(corpusDir).filter(f => f.endsWith('.txt'));

  it('has a non-trivial corpus to test against', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files)('parses %s without throwing and extracts core fields', (file) => {
    const wikitext = fs.readFileSync(path.join(corpusDir, file), 'utf-8');
    const parsed = parseCountryFromWikitext(wikitext, 'en');

    expect(parsed.isoCode || parsed.population).toBeTruthy();
    expect(parsed.description?.en).toBeTruthy();
  });
});
