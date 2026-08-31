import { extractInfoboxBody } from './wikitext-infobox.js';
import { ExtractionUtils } from '../utils/extraction.js';

export function parseDescriptionFromWikitext(wikitext: string): string {
  // 1. Remove the first Infobox block and other top-level templates
  let text = wikitext.replace(/<noinclude>|<\/noinclude>/gi, '');
  text = removeFirstInfobox(text);
  text = removeTopTemplates(text);
  
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  

  // 2. Remove other block templates at start of line
  text = text.replace(/^\{\{.*\}\}$/gm, '');

  // 3. Find first non-empty paragraph (handling multi-line paragraphs)
  const paragraphs = text.split(/\n\s*\n/);
  
  let paragraph = '';
  const excludeRegex = /^(=|[{[!|#])/;
  
  for (let p of paragraphs) {
    p = p.trim();
    if (!p) continue;
    
    // Skip common top-level junk that isn't a paragraph
    const lowerP = p.toLowerCase();
    if (p.startsWith('[[File:') || p.startsWith('[[Image:') || p.startsWith('{{') || lowerP.startsWith('{{infobox') || excludeRegex.test(p)) continue;
    
    // Check the first line of the paragraph
    const firstLine = p.split('\n')[0].trim();
    // Only exclude paragraphs that start with a template ({{)
    if (!firstLine.startsWith('{{')) {
      // More lenient: if it's reasonably long OR has bold OR it's one of the first few paragraphs
      if (p.length > 20 || p.includes("'''")) {
        // Clean it first to see if it's just a comment or junk
        let cleaned = p.replace(/<!--[\s\S]*?-->/g, '')
                       .replace(/<[^>]+>.*?<\/[^>]+>|<[^>]+>/g, '')
                       .trim();
        if (cleaned.length > 10) {
            paragraph = p;
            break;
        }
      }
    }
  }

  if (!paragraph) return '';

  // Drop lines that are just an embedded media/category link - on many non-English wikis an
  // image sits on its own line right after the lead sentence, with no blank line to separate
  // it into its own paragraph (e.g. frwiki "[[Fichier:...]]", itwiki "[[File:...]]").
  paragraph = paragraph
    .split('\n')
    .filter(line => !/^\s*\[\[[^\]:]+:[^\]]*\]\]\s*$/.test(line.trim()))
    .join('\n');

  // 4. Strip Wikimarkup and Templates
  paragraph = ExtractionUtils.stripAllTemplates(paragraph);

  // Remove any inline embedded media links (localized File:/Image: namespaces), including
  // their pipe-separated caption text.
  paragraph = paragraph.replace(/\[\[[^\]]*?\.(?:jpe?g|png|svg|gif|webp|tiff?|ogg|ogv)[^\]]*?\]\]/gi, '');
  // Pipe trick: [[Target|]] -> Target
  paragraph = paragraph.replace(/\[\[([^\]|]+)\|\]\]/g, '$1');
  // Wikilinks (incl. multi-pipe): keep the last segment; [[Article]] -> Article
  paragraph = paragraph.replace(/\[\[(?:[^\]|]*\|)*([^\]|]*)\]\]/g, '$1');
  // Safety net: strip any stray brackets left by malformed/nested markup
  paragraph = paragraph.replace(/\[\[|\]\]/g, '');
  // Bold/italic markers
  paragraph = paragraph.replace(/'''|''/g, '');
  
  // 5. Iteratively remove innermost (...)
  paragraph = removeNestedParentheses(paragraph);

  // 6. Normalize and trim
  return paragraph.replace(/\s+/g, ' ').replace(/ ,/g, ',').replace(/ \./g, '.').trim();
}

export function removeTopTemplates(text: string): string {
  let i = 0;
  while (i < text.length) {
    // Skip whitespace
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }
    // Check if starts with {{
    if (text.startsWith('{{', i)) {
      let braceCount = 0;
      let j = i;
      while (j < text.length) {
        if (text.startsWith('{{{', j)) {
          braceCount++;
          j += 3;
          continue;
        } else if (text.startsWith('}}}', j)) {
          braceCount--;
          j += 3;
          if (braceCount <= 0) break;
          continue;
        } else if (text.startsWith('{{', j)) {
          braceCount++;
          j += 2;
          continue;
        } else if (text.startsWith('}}', j)) {
          braceCount--;
          j += 2;
          if (braceCount <= 0) break;
          continue;
        }
        // Safety: don't let a single template consume more than 2000 chars of top-level junk
        if (j - i > 2000) break;
        j++;
      }
      if (braceCount <= 0) {
        i = j;
      } else {
        // If not closed properly, don't skip it as a top template
        break;
      }
    } else {
      break;
    }
  }
  return text.substring(i);
}

export function removeFirstInfobox(wikitext: string): string {
  const body = extractInfoboxBody(wikitext);
  if (!body) return wikitext;

  const startIdx = wikitext.toLowerCase().indexOf('{{infobox');
  if (startIdx === -1) return wikitext;

  return wikitext.substring(0, startIdx) + wikitext.substring(startIdx + body.length);
}

function removeNestedParentheses(text: string): string {
  let prev = text;
  while (true) {
    const next = prev.replace(/\([^()]*\)/g, '');
    if (next === prev) break;
    prev = next;
  }
  return prev;
}
