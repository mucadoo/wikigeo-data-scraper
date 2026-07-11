/* eslint-disable @typescript-eslint/no-unused-vars */
export function parseDescriptionFromWikitext(wikitext: string, _lang: string): string {
  // 1. Remove the first Infobox block and other top-level templates
  let text = removeFirstInfobox(wikitext);
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
    
    // Check the first line of the paragraph
    const firstLine = p.split('\n')[0].trim();
    // Only exclude paragraphs that start with a template ({{)
    if (!firstLine.startsWith('{{')) {
      // More lenient: if it's reasonably long OR has bold OR it's one of the first few paragraphs
      if (p.length > 20 || p.includes("'''")) {
        paragraph = p;
        break;
      } else {
      }
    } else {
    }
  }

  if (!paragraph) return '';

  // 4. Strip Wikimarkup
  // Wikilinks: [[Article|Text]] -> Text; [[Article]] -> Article
  paragraph = paragraph.replace(/\[\[([^\]|]+\|)?([^\]|]+)\]\]/g, '$2');
  // Bold/italic markers
  paragraph = paragraph.replace(/'''|''/g, '');
  // HTML tags
  paragraph = paragraph.replace(/<[^>]+>.*?<\/[^>]+>|<[^>]+>/g, '');
  
  // Remove ALL templates {{...}} including multi-line ones
  // We use a more aggressive approach for templates in paragraphs
  let braceCount = 0;
  let cleanPara = '';
  for (let i = 0; i < paragraph.length; i++) {
    if (paragraph.startsWith('{{', i)) {
      braceCount++;
      i++;
    } else if (paragraph.startsWith('}}', i)) {
      braceCount = Math.max(0, braceCount - 1);
      i++;
    } else if (braceCount === 0) {
      cleanPara += paragraph[i];
    }
  }
  paragraph = cleanPara;

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
        j++;
      }
      i = j;
    } else {
      break;
    }
  }
  return text.substring(i);
}

export function removeFirstInfobox(wikitext: string): string {
  const startIdx = wikitext.toLowerCase().indexOf('{{infobox');
  if (startIdx === -1) return wikitext;

  let braceCount = 0;
  let j = startIdx;
  
  while (j < wikitext.length) {
    if (wikitext.startsWith('{{{', j)) {
      braceCount++;
      j += 3;
      continue;
    } else if (wikitext.startsWith('}}}', j)) {
      braceCount--;
      j += 3;
      if (braceCount <= 0) {
        const remaining = wikitext.substring(j).substring(0, 100).trim();
        if (!remaining.startsWith('|')) return wikitext.substring(0, startIdx) + wikitext.substring(j);
        braceCount = 1;
      }
      continue;
    } else if (wikitext.startsWith('{{', j)) {
      braceCount++;
      j += 2;
      continue;
    } else if (wikitext.startsWith('}}', j)) {
      braceCount--;
      j += 2;
      if (braceCount <= 0) {
        const remaining = wikitext.substring(j).substring(0, 100).trim();
        if (!remaining.startsWith('|')) return wikitext.substring(0, startIdx) + wikitext.substring(j);
        braceCount = 1;
      }
      continue;
    }
    
    // Safety: if we hit a new section, the infobox must have ended
    if (braceCount > 0 && j > startIdx + 500 && wikitext.startsWith('\n==', j)) {
        const lastBraces = wikitext.lastIndexOf('}}', j);
        if (lastBraces > startIdx) {
            return wikitext.substring(0, startIdx) + wikitext.substring(lastBraces + 2);
        }
        break;
    }
    j++;
  }
  
  return wikitext.substring(0, startIdx) + wikitext.substring(j);
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
