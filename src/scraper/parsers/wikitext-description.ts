/* eslint-disable @typescript-eslint/no-unused-vars */
export function parseDescriptionFromWikitext(wikitext: string, _lang: string): string {
  // 1. Remove the first Infobox block and other top-level templates
  let text = removeFirstInfobox(wikitext);
  text = removeTopTemplates(text);
  console.log(`[DEBUG] Description text (first 200 chars): "${text.substring(0, 200).replace(/\n/g, '\\n')}"`);

  // 2. Remove other block templates at start of line
  text = text.replace(/^\{\{.*\}\}$/gm, '');

  // 3. Find first non-empty paragraph (handling multi-line paragraphs)
  const paragraphs = text.split(/\n\s*\n/);
  console.log(`[DEBUG] Found ${paragraphs.length} paragraphs`);
  paragraphs.forEach((p, idx) => console.log(`[DEBUG] Paragraph ${idx}: "${p.substring(0, 50).replace(/\n/g, '\\n')}"`));
  
  let paragraph = '';
  const excludeRegex = /^(=|[{[!|#])/;
  
  for (let p of paragraphs) {
    p = p.trim();
    if (!p) continue;
    
    // Check the first line of the paragraph
    const firstLine = p.split('\n')[0].trim();
    console.log(`[DEBUG] Checking paragraph: "${firstLine.substring(0, 50)}..."`);
    // Only exclude paragraphs that start with a template ({{)
    if (!firstLine.startsWith('{{')) {
      // More lenient: if it's reasonably long OR has bold OR it's one of the first few paragraphs
      if (p.length > 20 || p.includes("'''")) {
        paragraph = p;
        break;
      } else {
        console.log(`[DEBUG] Paragraph too short or no bold: length=${p.length}, hasBold=${p.includes("'''")}`);
      }
    } else {
      console.log(`[DEBUG] Paragraph matched template start: "${firstLine.substring(0, 50)}..."`);
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
        if (text.startsWith('{{', j)) {
          braceCount++;
          j += 2;
        } else if (text.startsWith('}}', j)) {
          braceCount--;
          j += 2;
          if (braceCount === 0) break;
        } else {
          j++;
        }
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

  let i = startIdx;
  let braceCount = 0;
  let j = i;
  
  while (j < wikitext.length) {
    if (wikitext.startsWith('{{', j)) {
      braceCount++;
      j += 2;
    } else if (wikitext.startsWith('}}', j)) {
      braceCount--;
      j += 2;
      if (braceCount === 0) break;
    } else {
      j++;
    }
  }
  
  return wikitext.substring(0, i) + wikitext.substring(j);
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
