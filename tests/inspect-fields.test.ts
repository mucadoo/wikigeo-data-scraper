
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseFields, extractInfoboxBody } from '../src/scraper/parsers/wikitext-infobox.js';

describe('Inspect infobox fields', () => {
  it('should parse fields for albania', () => {
    const wikitext = fs.readFileSync(path.join(process.cwd(), 'tests/snapshots/wikitext/en/albania.txt'), 'utf-8');
    const body = extractInfoboxBody(wikitext)!;
    const fields = parseFields(body);
    console.log('Albania fields keys:', Object.keys(fields));
    console.log('Albania calling_code:', fields['calling_code']);
    console.log('Albania cctld:', fields['cctld']);
  });

  it('should parse fields for australia', () => {
    const wikitext = fs.readFileSync(path.join(process.cwd(), 'tests/snapshots/wikitext/en/australia.txt'), 'utf-8');
    const body = extractInfoboxBody(wikitext)!;
    const fields = parseFields(body);
    console.log('Australia fields keys:', Object.keys(fields));
    console.log('Australia calling_code:', fields['calling_code']);
    console.log('Australia cctld:', fields['cctld']);
  });
});
