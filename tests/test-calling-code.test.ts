
import { describe, it, expect } from 'vitest';
import { parseWikilinks } from '../src/scraper/parsers/wikitext-infobox.js';

describe('parseWikilinks', () => {
  it('should parse calling code', () => {
    const raw = '[[Telephone numbers in Andorra|+376]]';
    const result = parseWikilinks(raw);
    console.log('Result:', JSON.stringify(result, null, 2));
    expect(result[0].text).toBe('+376');
  });
});
