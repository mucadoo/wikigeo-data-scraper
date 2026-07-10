
import { describe, it, expect } from 'vitest';
import { ExtractionUtils } from '../src/scraper/utils/extraction.js';

describe('ExtractionUtils Area', () => {
  it('should extract area from simple string', () => {
    expect(ExtractionUtils.extractArea('163610 km2')).toBe('163610');
  });

  it('should extract area from convert template', () => {
    // Current bug: {{convert|163610|km2|...}} might not be parsed correctly
    expect(ExtractionUtils.extractArea('{{convert|163610|km2|sqmi|abbr=on}}')).toBe('163610');
  });
});
