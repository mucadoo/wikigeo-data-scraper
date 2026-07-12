
import { describe, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseFields, extractInfoboxBody } from '../src/scraper/parsers/wikitext-infobox.js';

describe('Inspect infobox fields', () => {
  const snapshotsDir = path.join(process.cwd(), 'tests/snapshots');
  const wikitextSnapshotsDir = path.join(snapshotsDir, 'wikitext');

  if (!fs.existsSync(wikitextSnapshotsDir)) {
    it.skip('Wikitext snapshots directory not found', () => {});
    return;
  }

  it('should parse fields for albania', () => {
    const wikitext = fs.readFileSync(path.join(wikitextSnapshotsDir, 'en/albania.txt'), 'utf-8');
    const body = extractInfoboxBody(wikitext)!;
    const fields = parseFields(body);
    console.log('Albania fields keys:', Object.keys(fields));
    console.log('Albania calling_code:', fields['calling_code']);
    console.log('Albania cctld:', fields['cctld']);
  });

  it('should parse fields for australia', () => {
    const wikitext = fs.readFileSync(path.join(wikitextSnapshotsDir, 'en/australia.txt'), 'utf-8');
    const body = extractInfoboxBody(wikitext)!;
    const fields = parseFields(body);
    console.log('Australia fields keys:', Object.keys(fields));
    console.log('Australia calling_code:', fields['calling_code']);
    console.log('Australia cctld:', fields['cctld']);
  });
});
