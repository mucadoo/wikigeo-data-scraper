import { Cheerio } from 'crawlee';
import { AnyNode } from 'domhandler';

export class ExtractionUtils {
  static cleanText($: Cheerio<AnyNode>): string {
    if (!$) return '';
    const clone = $.clone();
    // Remove footnotes, references, coordinates, and other non-textual elements
    clone.find('sup, .reference, .geo-inline, .geo-default, .geo-dms, .geo-dec, .geo, span.plainlinks, style, .screenreader-only, .smallsup, .as_of').remove();

    // Normalize spaces and remove hidden Unicode markers
    return clone.text()
      .replace(/[\s\u00A0]+/g, ' ')
      .replace(/[\u200B-\u200D\u200E\u200F\uFEFF]/g, '')
      .trim();
  }

  static extractArea(text: string): string {
    if (!text) return '';
    
    // Clean spaces, commas (often thousands separators), and common units
    const clean = text
      .replace(/[\u00A0\u200B-\u200F\uFEFF]/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/km\u00B2/g, 'km2')
      .replace(/km2/g, '')
      .replace(/sq mi/g, '')
      .replace(/,/g, '');
      
    const match = clean.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (match) {
        return match[1];
    }
    return '';
  }

  static extractPopulation(text: string): string {
    if (!text) return '';

    const clean = text
      .replace(/{{formatnum:([0-9,]+)}}/gi, '$1')
      .replace(/{{[^}]*}}/g, '')
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
      .replace(/\b(19|20)\d{2}\b/g, '')
      .replace(/,/g, '')
      .replace(/[\u00A0\u200B-\u200F\uFEFF]/g, '');

    const rangeMatch = clean.match(/([0-9.]+)\s*(?:-|–)\s*([0-9.]+)\s*(million|billion)/i);
    if (rangeMatch) {
      let val1 = parseFloat(rangeMatch[1]);
      let val2 = parseFloat(rangeMatch[2]);
      let avg = (val1 + val2) / 2;
      if (rangeMatch[3].toLowerCase() === 'million') avg *= 1_000_000;
      else if (rangeMatch[3].toLowerCase() === 'billion') avg *= 1_000_000_000;
      return Math.round(avg).toString();
    }

    const multiplierMatch = clean.match(/([0-9.]+)\s*(million|billion)/i);
    if (multiplierMatch) {
      let val = parseFloat(multiplierMatch[1]);
      if (multiplierMatch[2].toLowerCase() === 'million') val *= 1_000_000;
      else if (multiplierMatch[2].toLowerCase() === 'billion') val *= 1_000_000_000;
      return Math.round(val).toString();
    }
    
    const numMatch = clean.match(/([0-9]+)/);
    if (numMatch) return numMatch[1];

    return '';
  }

  static extractDensity(text: string): string {
    if (!text) return '';
    
    // Handle {{#expr: ... }}
    if (text.includes('#expr:')) {
      const exprMatch = text.match(/#expr:\s*([0-9./*+-]+)/);
      if (exprMatch) {
        try {
          // Very basic evaluation for simple divisions
          const parts = exprMatch[1].split('/');
          if (parts.length === 2) {
            const num = parseFloat(parts[0]);
            const den = parseFloat(parts[1]);
            if (den !== 0) return (num / den).toFixed(2);
          }
        } catch (e) {
          // ignore
        }
      }
    }

    // First try to find a number followed by km
    const patternWithUnit = /([0-9,.]+)(?=\s*\/?\s*km)/;
    const matchWithUnit = text.match(patternWithUnit);
    if (matchWithUnit) return matchWithUnit[1].replace(/,/g, '');
    
    // Fallback to just extracting the first number if no unit found
    const matchAnyNum = text.match(/([0-9,.]+)/);
    if (matchAnyNum) return matchAnyNum[1].replace(/,/g, '');
    
    return '';
  }

  static normalizeFlagUrl(url: string): string {
    if (!url) return '';
    let normalized = url.startsWith('http') ? url : `https:${url}`;
    return normalized.replace(/\/\d+px-/g, '/250px-');
  }

  static stripAllTemplates(text: string): string {
    if (!text) return '';
    
    // Strip references and HTML comments
    let cleaned = text
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
      .replace(/<ref[^>]*\/>/gi, '')
      .replace(/{{refn\|[\s\S]*?}}/gi, '')
      .replace(/{{efn\|[\s\S]*?}}/gi, '');

    // Replace some common templates with their text or nothing
    cleaned = cleaned.replace(/{{nbsp}}/gi, ' ')
                     .replace(/&nbsp;/gi, ' ')
                     .replace(/{{cite[^}]*}}/gi, '')
                     .replace(/{{convert\|(\d+)\|km2\|[^}]*}}/gi, '$1')
                     .replace(/{{small\|([^}]*)}}/gi, '$1')
                     .replace(/{{(?:hlist|flatlist|plainlist|unbulleted list|vlist|ublist)\|([^}]*)}}/gi, '$1');

    let braceCount = 0;
    let bracketCount = 0;
    let result = '';
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned.startsWith('{{', i)) {
            braceCount++;
            i++;
        } else if (cleaned.startsWith('}}', i)) {
            braceCount = Math.max(0, braceCount - 1);
            i++;
        } else if (cleaned.startsWith('[[', i)) {
            bracketCount++;
            i++;
            result += '[[';
        } else if (cleaned.startsWith(']]', i)) {
            bracketCount = Math.max(0, bracketCount - 1);
            i++;
            result += ']]';
        } else if (braceCount === 0) {
            if (cleaned[i] === '|' && bracketCount === 0) {
                result += '\n'; // Convert template pipes to newlines for segmenting
            } else {
                result += cleaned[i];
            }
        }
    }
    return result;
  }
}
