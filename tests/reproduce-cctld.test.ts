
import { describe, it, expect } from 'vitest';
import { parseWikilinks } from '../src/scraper/parsers/wikitext-infobox.js';

function stripAllTemplates(text: string): string {
    let braceCount = 0;
    let result = '';
    for (let i = 0; i < text.length; i++) {
        if (text.startsWith('{{', i)) {
            braceCount++;
            i++;
        } else if (text.startsWith('}}', i)) {
            braceCount = Math.max(0, braceCount - 1);
            i++;
        } else if (braceCount === 0) {
            result += text[i];
        }
    }
    return result;
}

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
