
import { describe, it, expect } from 'vitest';
import { parseInfoboxFromWikitext } from '../src/scraper/parsers/wikitext-infobox.js';

describe('Fix callingCode and internetTld', () => {
  it('should parse callingCode and internetTld correctly', () => {
    const wikitext = `
{{Infobox
| calling_code = [[Telephone numbers in Australia|+61]]
| cctld = [[.au]]
}}`;
    const result = parseInfoboxFromWikitext(wikitext, 'en');
    console.log('Parsed result:', JSON.stringify(result, null, 2));
    expect(result.callingCode).toEqual(['+61']);
    expect(result.internetTld).toEqual(['.au']);
  });

  it('should parse multiple callingCodes', () => {
    const wikitext = `
{{Infobox
| calling_code = [[+61]], [[+672]]
}}`;
    const result = parseInfoboxFromWikitext(wikitext, 'en');
    console.log('Parsed result:', JSON.stringify(result, null, 2));
    expect(result.callingCode).toEqual(['+61', '+672']);
  });
});
