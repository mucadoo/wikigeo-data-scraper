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

    // Remove templates, references, and other junk more aggressively
    let clean = text
      .replace(/{{formatnum:([0-9,]+)}}/gi, '$1')
      .replace(/{{[^}]*}}/g, '')
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
      .replace(/,/g, '')
      .replace(/[\u00A0\u200B-\u200F\uFEFF]/g, '');

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
    const pattern = /([0-9,.]+)(?=\s*\/?\s*km)/;
    const match = text.match(pattern);
    if (match) return match[1].replace(/,/g, '');
    return '';
  }

  static normalizeFlagUrl(url: string): string {
    if (!url) return '';
    let normalized = url.startsWith('http') ? url : `https:${url}`;
    return normalized.replace(/\/\d+px-/g, '/250px-');
  }
}
