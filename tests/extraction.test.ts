import { describe, it, expect } from 'vitest';
import { ExtractionUtils } from '../src/scraper/utils/extraction.js';
import { parseWikilinks } from '../src/scraper/parsers/wikitext-infobox.js';
import { parseDescriptionFromWikitext } from '../src/scraper/parsers/wikitext-description.js';

describe('ExtractionUtils', () => {
  describe('extractArea', () => {
    it('should extract standard area with commas', () => {
      expect(ExtractionUtils.extractArea('1,234,567.8 km2')).toBe('1234567.8');
    });

    it('should extract area with km2 suffix', () => {
      expect(ExtractionUtils.extractArea('123.45 km2')).toBe('123.45');
    });

    it('should handle square miles fallback', () => {
      expect(ExtractionUtils.extractArea('100,000 sq mi')).toBe('100000');
    });

    it('should handle non-breaking spaces and unicode markers', () => {
      expect(ExtractionUtils.extractArea('1\u00A0234\u200E km\u00B2')).toBe('1234');
    });

    it('should extract area from a {{convert}} template', () => {
      expect(ExtractionUtils.extractArea('{{convert|163610|km2|sqmi|abbr=on}}')).toBe('163610');
    });
  });

  describe('stripAllTemplates', () => {
    it('should strip nested templates while preserving surrounding wikilinks', () => {
      const raw = '[[.ad]]{{efn|Also [[.cat]]}}, shared with [[Pa\u00EFsos Catalans|Catalan-speaking territories]].';
      const stripped = ExtractionUtils.stripAllTemplates(raw);
      expect(stripped).not.toContain('{{');
      expect(stripped).not.toContain('}}');
      expect(stripped).toContain('[[.ad]]');
    });
  });

  describe('extractPopulation', () => {
    it('should extract single value with million', () => {
      expect(ExtractionUtils.extractPopulation('68.3 million')).toBe('68300000');
    });

    it('should extract single value with billion', () => {
      expect(ExtractionUtils.extractPopulation('1.4 billion')).toBe('1400000000');
    });

    it('should calculate average for range populations', () => {
      expect(ExtractionUtils.extractPopulation('1.2 – 1.4 million')).toBe('1300000');
    });

    it('should extract large numbers with commas', () => {
      expect(ExtractionUtils.extractPopulation('1,392,730,000')).toBe('1392730000');
    });

    it('should filter out year-like numbers', () => {
      expect(ExtractionUtils.extractPopulation('2024 estimate (1,234,567)')).toBe('1234567');
    });
  });

  describe('extractDensity', () => {
    it('should extract density values', () => {
      expect(ExtractionUtils.extractDensity('106.0 /km2')).toBe('106.0');
    });
  });

  describe('normalizeFlagUrl', () => {
    it('should normalize thumbnail size to 250px', () => {
      const url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Flag_of_France.svg/125px-Flag_of_France.svg.png';
      expect(ExtractionUtils.normalizeFlagUrl(url)).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Flag_of_France.svg/250px-Flag_of_France.svg.png');
    });

    it('should prepend https if missing', () => {
      expect(ExtractionUtils.normalizeFlagUrl('//upload.wikimedia.org/test.png')).toBe('https://upload.wikimedia.org/test.png');
    });
  });
});

describe('Wikitext Parsing', () => {
  describe('parseWikilinks', () => {
    it('should extract basic link', () => {
      const result = parseWikilinks('[[Brasília]]');
      expect(result).toEqual([{ articleId: 'Brasília', text: 'Brasília' }]);
    });

    it('should extract piped link', () => {
      const result = parseWikilinks('[[Brazilian real|Real]]');
      expect(result).toEqual([{ articleId: 'Brazilian real', text: 'Real' }]);
    });

    it('should extract a calling code from its piped article link', () => {
      const result = parseWikilinks('[[Telephone numbers in Andorra|+376]]');
      expect(result[0].text).toBe('+376');
    });

    it('should strip an inline {{efn}} template when parsing a TLD field', () => {
      const raw = '[[.ad]]{{efn|Also [[.cat]]}}, shared with [[Països Catalans|Catalan-speaking territories]].';
      const texts = parseWikilinks(raw).map(r => r.text);
      expect(texts.some(t => t.includes('{{'))).toBe(false);
      expect(texts).toContain('.ad');
    });
  });

  describe('parseDescriptionFromWikitext', () => {
    it('should clean basic description', () => {
      const wikitext = 'France is a country in Europe.';
      const result = parseDescriptionFromWikitext(wikitext);
      expect(result).toBe('France is a country in Europe.');
    });
  });
});
