
import { describe, it, expect } from 'vitest';
import { ExtractionUtils } from '../src/scraper/utils/extraction.js';

describe('stripAllTemplates', () => {
  it('should strip nested templates', () => {
    const raw = '[[.ad]]{{efn|Also [[.cat]]}}, shared with [[Països Catalans|Catalan-speaking territories]].';
    const stripped = ExtractionUtils.stripAllTemplates(raw);
    console.log('Stripped:', stripped);
    // Should be: "[[.ad]], shared with [[Països Catalans|Catalan-speaking territories]]."
    expect(stripped).not.toContain('{{');
    expect(stripped).not.toContain('}}');
  });
});
