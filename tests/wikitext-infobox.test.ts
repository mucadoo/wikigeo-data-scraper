import { describe, it, expect } from 'vitest';
import { parseInfoboxFromWikitext, parseCurrencyField } from '../src/scraper/parsers/wikitext-infobox.js';

describe('parseInfoboxFromWikitext', () => {
  it('should parse a single calling code from a piped article link', () => {
    const wikitext = `
{{Infobox
| calling_code = [[Telephone numbers in Australia|+61]]
| cctld = [[.au]]
}}`;
    const result = parseInfoboxFromWikitext(wikitext, 'en');
    expect(result.callingCode).toEqual(['+61']);
    expect(result.internetTld).toEqual(['.au']);
  });

  it('should parse multiple calling codes', () => {
    const wikitext = `
{{Infobox
| calling_code = [[+61]], [[+672]]
}}`;
    const result = parseInfoboxFromWikitext(wikitext, 'en');
    expect(result.callingCode).toEqual(['+61', '+672']);
  });

  it('should parse a bracketed calling code without a pipe', () => {
    const wikitext = `
{{Infobox
| calling_code = [[+260]]
}}`;
    const result = parseInfoboxFromWikitext(wikitext, 'en');
    expect(result.callingCode).toEqual(['+260']);
  });
});

describe('parseCurrencyField', () => {
  it('should pair a currency name with its ISO 4217 code', () => {
    const raw = '[[Euro]] ([[Euro sign|€]]) ([[ISO 4217|EUR]])';
    const result = parseCurrencyField(raw, null);
    expect(result).toEqual([
      { articleId: 'Euro', name: expect.objectContaining({ en: 'Euro' }), isoCode: 'EUR' },
    ]);
  });

  it('should fall back to the provided ISO code when none is found in the segment', () => {
    const raw = '[[CFP franc]] (XPF)';
    const result = parseCurrencyField(raw, 'XPF');
    expect(result[0].name.en).toBe('CFP franc');
    expect(result[0].isoCode).toBe('XPF');
  });
});
