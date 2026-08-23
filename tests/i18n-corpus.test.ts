import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseDescriptionFromWikitext } from '../src/scraper/parsers/wikitext-description.js';

// Small curated sample of real non-English Wikipedia articles, covering the locales with the
// highest structural risk to the shared, language-agnostic description extractor: non-Latin
// scripts (ja, ru, zh) and one Latin-but-non-English control (de). Unlike parser-corpus.test.ts,
// this intentionally isn't a full corpus — parseDescriptionFromWikitext is the only parsing path
// these locales exercise in production (see src/scraper/main.ts), so a handful of real articles
// per language is enough to catch script-specific regressions (e.g. a length heuristic tuned for
// English behaving oddly on dense CJK text, or a locale whose infobox template isn't literally
// named "Infobox").
describe('parseDescriptionFromWikitext (multilingual corpus)', () => {
  const wikitextBase = path.join(process.cwd(), 'tests/snapshots/wikitext');
  const langs = ['de', 'ja', 'ru', 'zh'];

  langs.forEach(lang => {
    const langDir = path.join(wikitextBase, lang);
    if (!fs.existsSync(langDir)) {
      it.skip(`${lang} sample not found (run: npx tsx scripts/download-snapshots.ts)`, () => {});
      return;
    }

    const files = fs.readdirSync(langDir).filter(f => f.endsWith('.txt'));

    it(`has a sample corpus for ${lang}`, () => {
      expect(files.length).toBeGreaterThan(0);
    });

    it.each(files)(`[${lang}] extracts a clean description from %s`, (file) => {
      const wikitext = fs.readFileSync(path.join(langDir, file), 'utf-8');
      const description = parseDescriptionFromWikitext(wikitext);

      expect(description.length).toBeGreaterThan(10);
      expect(description).not.toContain('{{');
      expect(description).not.toContain('[[');
      expect(description).not.toContain("'''");
    });
  });
});
