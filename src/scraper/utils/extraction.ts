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
    
    let clean = this.stripAllTemplates(text);

    // Clean spaces, commas (often thousands separators), and common units
    clean = clean
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

    let clean = text
      .replace(/{{formatnum:([0-9,]+)}}/gi, '$1');
    
    clean = this.stripAllTemplates(clean);

    clean = clean
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
        } catch {
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
    
    // Strip references, HTML comments and Wikidata calls
    let cleaned = text
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
      .replace(/<ref[^>]*\/>/gi, '')
      .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '')
      .replace(/<sub[^>]*>[\s\S]*?<\/sub>/gi, '')
      .replace(/{{#property:[^}]*}}/gi, '');

    // Strip HTML tags and common entities
    cleaned = cleaned.replace(/<[^>]+>/g, '')
                     .replace(/&nbsp;/gi, ' ')
                     .replace(/{{nbsp}}/gi, ' ')
                     .replace(/&amp;/gi, '&')
                     .replace(/{{convert\|([0-9,.]+)\|km2\|[^}]*}}/gi, '$1')
                     .replace(/{{convert\|([0-9,.]+)\|sqmi\|km2[^}]*}}/gi, (_, p1) => (parseFloat(p1.replace(/,/g, '')) * 2.58999).toFixed(2))
                     .replace(/{{small\|([^}]*)}}/gi, '$1');

    let result = '';
    let braceCount = 0;
    let bracketCount = 0;
    let stack: string[] = [];

    const listTemplates = [
      'hlist', 'flatlist', 'plainlist', 'unbulleted list', 'vlist', 'ublist', 'ubl', 'lang', 'native name', 'native_name',
      'vunblist', 'unbulleted', 'bulleted list', 'ordered list', 'horizontal list', 'item', 'native name list',
      'nowrap', 'small', 'big', 'larger', 'fontsize', 'center', 'bold', 'italic', 'i', 'b', 'u', 'flagcountry', 'flag'
    ];

    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned.startsWith('{{', i)) {
            const rest = cleaned.substring(i + 2);
            const match = rest.match(/^([a-z0-9\s_-]+)(\||\}\})/i);
            let name = match ? match[1].trim().toLowerCase().replace(/\s+/g, ' ') : '';
            
            if (listTemplates.includes(name)) {
                stack.push(name);
                const nextPipe = cleaned.indexOf('|', i + 2);
                if (nextPipe !== -1) {
                    i = nextPipe;
                    if (name === 'lang') {
                        const secondPipe = cleaned.indexOf('|', i + 1);
                        if (secondPipe !== -1) {
                            i = secondPipe;
                        }
                    }
                    // Skip parameter names like 1= or text=
                    const restAfterPipe = cleaned.substring(i + 1, i + 10);
                    const paramMatch = restAfterPipe.match(/^([1-9]|text|content|link|name)=/);
                    if (paramMatch) {
                        i += paramMatch[0].length;
                    }
                }
            } else {
                braceCount++;
                stack.push('');
                i++;
            }
        } else if (cleaned.startsWith('}}', i)) {
            const top = stack.pop();
            if (top === undefined || top === '') {
                braceCount = Math.max(0, braceCount - 1);
            }
            i++;
        } else if (cleaned.startsWith('[[', i)) {
            bracketCount++;
            i++;
            if (braceCount === 0) result += '[[';
        } else if (cleaned.startsWith(']]', i)) {
            bracketCount = Math.max(0, bracketCount - 1);
            i++;
            if (braceCount === 0) result += ']]';
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
