
import { describe, it, expect } from 'vitest';
import { parseWikilinks } from '../src/scraper/parsers/wikitext-infobox.js';

describe('Reproduction of TLD parsing issue', () => {
  it('should parse TLD correctly even with templates', () => {
    const raw = '[[.ad]]{{efn|Also [[.cat]]}}, shared with [[Països Catalans|Catalan-speaking territories]].';
    const result = parseWikilinks(raw);
    console.log(JSON.stringify(result, null, 2));
    
    // Check that templates were stripped
    const texts = result.map(r => r.text);
    expect(texts.some(t => t.includes('{{'))).toBe(false);
    expect(texts.includes('.ad')).toBe(true);
  });
});
