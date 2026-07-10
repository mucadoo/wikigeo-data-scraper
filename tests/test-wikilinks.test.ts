
import { describe, it, expect } from 'vitest';
import { parseWikilinks } from '../src/scraper/parsers/wikitext-infobox.js';

describe('parseWikilinks', () => {
  it('should parse complex wikilink', () => {
    const raw = '[[Telephone numbers in Australia|+61]]';
    const result = parseWikilinks(raw);
    console.log(JSON.stringify(result, null, 2));
    expect(result[0].text).toBe('+61');
  });

  it('should parse simple wikilink', () => {
    const raw = '[[.au]]';
    const result = parseWikilinks(raw);
    console.log(JSON.stringify(result, null, 2));
    expect(result[0].text).toBe('.au');
  });
});
