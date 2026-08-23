import { Country, getEmptyLocalizedField } from '../../types/country.js';
import { ExtractionUtils } from '../utils/extraction.js';

export function parseWikilinks(raw: string): Array<{ articleId: string | null, text: string }> {
  const cleaned = ExtractionUtils.stripAllTemplates(raw);
  const segments = cleaned.split(/<br\s*\/?>|\n|\*|\{\{plainlist|\|\|\}\}/gi);
  const results: Array<{ articleId: string | null, text: string }> = [];
  
  for (const segment of segments) {
    const linkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let lastIdx = 0;
    let match;
    
    while ((match = linkRegex.exec(segment)) !== null) {
      const textBefore = segment.substring(lastIdx, match.index).replace(/'''|''/g, '').trim();
      if (textBefore.length > 0 && !/^[,; ]+$/.test(textBefore)) {
        // Ignore "and" or parenthetical notes if we have links in the segment
        const isJunk = /^(and|or|&|with)$|^\(.*\)$|^[;,.]$|=/i.test(textBefore);
        if (!isJunk) {
            results.push({ articleId: null, text: textBefore.replace(/\[\[/g, '').replace(/\]\]/g, '') });
        }
      }
      
      const linkText = (match[2] || match[1]).replace(/\[\[/g, '').replace(/\]\]/g, '');
      results.push({ articleId: match[1], text: linkText });
      lastIdx = linkRegex.lastIndex;
    }
    
    const remainingText = segment.substring(lastIdx).replace(/'''|''/g, '').trim();
    if (remainingText.length > 0 && !/^[,; ]+$/.test(remainingText)) {
      const hasLinks = results.some(r => r.articleId !== null);
      const isJunk = hasLinks && (/^(and|or|&|with)$|^\(.*\)$|^[;,.]$|=/i.test(remainingText));
      if (!isJunk) {
        results.push({ articleId: null, text: remainingText.replace(/\[\[/g, '').replace(/\]\]/g, '') });
      }
    }
  }

  return results.map(r => ({
      articleId: r.articleId,
      text: r.text.replace(/\[\[/g, '').replace(/\]\]/g, '').trim()
  })).filter(r => {
      const t = r.text;
      const lower = t.toLowerCase();
      if (t.length === 0) return false;
      if (/^[()[]\]\s,;|]+$/.test(t)) return false;
      // Filter out percentages and pure numbers which are often junk in language/currency fields
      if (/^\d+(\.\d+)?%$/.test(t)) return false;
      if (/^\d+(\.\d+)?$/.test(t) && !r.articleId) return false;
      const isJunkText = /^(and|or|&|with|alongside|recognized|by|law|item_style|white-space|nowrap)$/i.test(lower) || 
                         lower.startsWith('alongside') || 
                         lower.startsWith('recognized by');
      if (t.includes('=') || t.endsWith(':') || isJunkText) return false;
      if (t === '----' || t === '—' || t === '–') return false;
      if (lower === 'none' || lower === 'none officially' || lower === 'unknown' || lower.startsWith('none (')) return false;
      // Filter out single letters (often leftover from footnotes)
      if (t.length === 1 && !r.articleId && /^[a-z]$/i.test(t)) return false;
      return true;
  });
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export function parseInfoboxFromWikitext(wikitext: string, _lang: string): Partial<Country> {
  const infoboxBody = extractInfoboxBody(wikitext);
  if (!infoboxBody) return {};

  // Strip references and common non-data templates from the body
  // const cleanBody = infoboxBody
  //   .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
  //   .replace(/<ref[^>]*\/>/gi, '')
  //   .replace(/{{refn\|[\s\S]*?}}/gi, '')
  //   .replace(/{{efn\|[\s\S]*?}}/gi, '');

  const fields = parseFields(infoboxBody);
  const result: Partial<Country> = {};

  const FIELD_MAP = {
    capital: ['capital', 'capital_city', 'capitale', 'capitaux'],
    largestCity: ['largest_city', 'largest_settlement', 'plus_grande_ville'],
    population: ['population_estimate', 'population_census', 'population_total', 'population', 'population_totale', 'population_estimate'],
    areaKm2: ['area_km2', 'area_sqkm', 'area', 'superficie_totale', 'superficie', 'area_data2'],
    densityKm2: ['density_km2', 'population_density_km2', 'densité', 'population_density_sq_mi'],
    government: ['government_type', 'type_gouvernement', 'government'],
    officialLanguage: ['official_languages', 'languages', 'langues_officielles', 'official_language'],
    currency: ['currency', 'monnaie', 'code_monnaie', 'currency_code'],
    timeZone: ['timezone', 'utc_offset', 'time_zone', 'fuseau_horaire', 'time_offset'],
    callingCode: ['calling_code', 'indicatif_téléphonique', 'calling_code'],
    internetTld: ['cctld', 'domaine_internet', 'tld', 'internet_tld'],
    hdi: ['hdi', 'idh'],
    gdp: ['gdp_nominal', 'pib'],
    flagUrl: ['image_flag', 'flag_image', 'flag', 'image_drapeau'],
    isoCode: ['iso3166code', 'iso3166-1', 'iso3166_1', 'iso_3166-1', 'iso3166-1_alpha-2', 'iso3166-1_alpha_2'],
    demonym: ['demonym', 'nom_des_habitants'],
  };

  const getField = (keys: string[]) => {
    for (const key of keys) {
      if (fields[key] !== undefined && fields[key].trim() !== "") return fields[key];
      // Try normalized casing just in case
      const normalizedKey = key.toLowerCase();
      if (fields[normalizedKey] !== undefined && fields[normalizedKey].trim() !== "") return fields[normalizedKey];
    }
    return undefined;
  };

  // Helper to parse linked fields
  const getLinkedField = (keys: string[]) => {
    const raw = getField(keys);
    if (!raw) return [];
    return parseWikilinks(raw).map(link => ({
      articleId: link.articleId,
      name: { ...getEmptyLocalizedField(), en: link.text }
    }));
  };

  // Parsing logic
  const rawPopulation = getField(FIELD_MAP.population);
  if (rawPopulation) {
    const val = ExtractionUtils.extractPopulation(rawPopulation);
    if (val) result.population = parseInt(val, 10);
  }

  // Fallback population: try all fields in map if the first one failed
  if (!result.population) {
      for (const key of FIELD_MAP.population) {
          const raw = fields[key] || fields[key.toLowerCase()];
          if (raw && raw.trim()) {
              const val = ExtractionUtils.extractPopulation(raw);
              if (val) {
                  result.population = parseInt(val, 10);
                  break;
              }
          }
      }
  }

  const rawArea = getField(FIELD_MAP.areaKm2);
  if (rawArea) {
    const val = ExtractionUtils.extractArea(rawArea);
    if (val) result.areaKm2 = parseFloat(val);
  }
  
  if (!result.areaKm2) {
    const rawAreaSqMi = getField(['area_sq_mi']);
    if (rawAreaSqMi) {
      const val = ExtractionUtils.extractArea(rawAreaSqMi);
      if (val) result.areaKm2 = parseFloat(val) * 2.58999;
    }
  }

  // Fallback area: try all fields in map if failed
  if (!result.areaKm2) {
    for (const key of FIELD_MAP.areaKm2) {
        const raw = fields[key] || fields[key.toLowerCase()];
        if (raw && raw.trim()) {
            const val = ExtractionUtils.extractArea(raw);
            if (val) {
                result.areaKm2 = parseFloat(val);
                break;
            }
        }
    }
  }

  const rawDensity = getField(FIELD_MAP.densityKm2);
  if (rawDensity) {
      const val = ExtractionUtils.extractDensity(rawDensity);
      if (val) result.densityKm2 = parseFloat(val);
  }
  
  if (!result.densityKm2 && result.population && result.areaKm2 && result.areaKm2 > 0) {
      result.densityKm2 = parseFloat((result.population / result.areaKm2).toFixed(2));
  }

  result.capital = getLinkedField(FIELD_MAP.capital);
  result.largestCity = getLinkedField(FIELD_MAP.largestCity);
  
  // If largestCity is "capital" or contains Wikidata properties, copy the capital(s)
  const isLargestCityCapital = result.largestCity.some(city => 
    (city.name.en || '').toLowerCase().includes('capital') || 
    (city.name.en || '').includes('{{#property')
  );
  if (isLargestCityCapital) {
      if (result.capital && result.capital.length >= 1) {
          // Filter out "capital" and add real capital cities
          const cities = result.largestCity.filter(city => !(city.name.en || '').toLowerCase().includes('capital'));
          // If it's only "capital" or empty now, just use capital
          if (cities.length === 0) {
              result.largestCity = JSON.parse(JSON.stringify(result.capital));
          } else {
              // Merge capital into the list if not already present
              const existingNames = new Set(cities.map(c => (c.name.en || '').toLowerCase()));
              for (const cap of result.capital) {
                  if (!existingNames.has((cap.name.en || '').toLowerCase())) {
                      cities.push(JSON.parse(JSON.stringify(cap)));
                  }
              }
              result.largestCity = cities;
          }
      } else {
          // If capital is missing, at least remove the "capital" literal
          result.largestCity = result.largestCity.filter(city => 
              !(city.name.en || '').toLowerCase().includes('capital') && 
              !(city.name.en || '').includes('{{#property')
          );
      }
  } else if (result.largestCity.length === 1 && !result.largestCity[0].articleId) {
    const city = result.largestCity[0];
    const match = result.capital?.find(c => (c.name.en || '').toLowerCase() === (city.name.en || '').toLowerCase());
    if (match) city.articleId = match.articleId;
  }
  result.officialLanguage = getLinkedField(FIELD_MAP.officialLanguage);
  result.government = getLinkedField(FIELD_MAP.government);
  result.currency = getLinkedField(FIELD_MAP.currency).map(c => ({...c, isoCode: null})); // TODO: extract isoCode
  result.timeZone = getLinkedField(FIELD_MAP.timeZone);
  result.demonym = getLinkedField(FIELD_MAP.demonym);

  const rawHdi = getField(FIELD_MAP.hdi);
  if (rawHdi) {
    const match = rawHdi.match(/0\.\d{3}/);
    if (match) result.hdi = parseFloat(match[0]);
  }

  const rawGdp = getField(FIELD_MAP.gdp);
  if (rawGdp) {
    result.gdp = parseNumericValue(rawGdp);
  }

  const rawCallingCode = getField(FIELD_MAP.callingCode);
  if (rawCallingCode) {
    result.callingCode = parseWikilinks(rawCallingCode).map(link => link.text).map(s => s.trim()).filter(s => s.length > 0);
  }

  const rawTld = getField(FIELD_MAP.internetTld);
  if (rawTld) {
    result.internetTld = parseWikilinks(rawTld).map(link => link.text).map(s => s.trim()).filter(s => s.length > 0);
  }

  let rawIso = getField(FIELD_MAP.isoCode);
  if (!rawIso) {
    const coordinates = fields['coordinates'] || fields['coord'];
    if (coordinates) {
      const regionMatch = coordinates.match(/region:([a-zA-Z]{2})/);
      if (regionMatch) {
        rawIso = regionMatch[1];
      }
    }
  }

  // Prefer the country-code TLD over currency code: shared currencies (EUR, XCD, XOF, ...)
  // do not share a prefix with the ISO 3166-1 code, but ccTLDs almost always do.
  if (!rawIso && result.internetTld && result.internetTld.length > 0) {
    const tld = result.internetTld[0].replace(/\[\[|\]\]/g, '').trim().toLowerCase();
    if (tld.startsWith('.') && tld.length === 3) {
      rawIso = tld.substring(1);
    }
  }

  if (!rawIso) {
      const currencyCode = getField(['currency_code']);
      if (currencyCode && currencyCode.length >= 2) {
          rawIso = currencyCode.substring(0, 2);
      }
  }

  if (!rawIso) {
      const callingCode = getField(FIELD_MAP.callingCode);
      if (callingCode && callingCode.includes('375')) rawIso = 'BY'; // Specific for Belarus if still failing
  }

  if (rawIso) {
    const cleanIso = ExtractionUtils.stripAllTemplates(rawIso)
      .replace(/\[\[[^\]]*\]\]/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/[^a-zA-Z]/g, '');
    const match = cleanIso.match(/\b[a-zA-Z]{2}\b/);
    if (match) result.isoCode = match[0].toUpperCase();
  }

  // Handle known TLD/ISO exceptions
  if (result.isoCode === 'UK') result.isoCode = 'GB';
  if (result.isoCode === 'EL') result.isoCode = 'GR';

  const rawFlag = getField(FIELD_MAP.flagUrl);
  if (rawFlag) {
    const cleanFlag = rawFlag.replace(/\[\[|\]\]/g, '').split('|')[0].trim();
    if (cleanFlag) {
      result.flagUrl = `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(cleanFlag.replace(/\s/g, '_'))}?width=250`;
    }
  } else {
    result.flagUrl = null;
  }

  if (Object.keys(result).length === 0) {
    console.log('[DEBUG] Infobox body was:', infoboxBody.substring(0, 200));
  }

  return result;
}

export function extractInfoboxBody(wikitext: string): string | null {
  const startIdx = wikitext.toLowerCase().indexOf('{{infobox');
  if (startIdx === -1) return null;

  let braceCount = 0;
  for (let i = startIdx; i < wikitext.length; i++) {
    if (wikitext[i] === '{') {
      braceCount++;
    } else if (wikitext[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        // Lookahead to see if this is really the end
        const remaining = wikitext.substring(i + 1).trim();
        if (remaining.startsWith('|') && /^\|\s*[a-z0-9_-]+\s*=/.test(remaining)) {
          // It's likely a missing closing brace for a template inside a field
          braceCount = 1;
          continue;
        }
        return wikitext.substring(startIdx, i + 1);
      }
    }
    // Safety break for extremely long articles or missing end
    if (i - startIdx > 25000) break;
  }

  // Fallback: find the last }} before the first section
  const nextSection = wikitext.indexOf('\n==', startIdx);
  const endLimit = nextSection !== -1 ? nextSection : wikitext.length;
  const lastBraces = wikitext.lastIndexOf('}}', endLimit);
  if (lastBraces > startIdx) {
    return wikitext.substring(startIdx, lastBraces + 2);
  }

  return null;
}

export function parseFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = body.split('\n');
  
  let currentKey: string | null = null;
  let currentValue = '';
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const lineBraceDepthBefore = braceDepth;
    
    // Track braces in the entire line
    for (const char of line) {
      if (char === '{') braceDepth++;
      else if (char === '}') braceDepth--;
    }

    // We identify fields that start with | at the top level of the infobox.
    // We handle comments that might precede the | character.
    const effectiveTrimmed = trimmed.replace(/^<!--[\s\S]*?-->/g, '').trim();
    
    // Termination condition: if we see the closing braces at the top level
    if (effectiveTrimmed === '}}' && lineBraceDepthBefore <= 2) {
        if (currentKey) {
            fields[currentKey] = currentValue.trim();
        }
        return fields;
    }

    const isProbableField = effectiveTrimmed.startsWith('|') && /^\|\s*[a-z0-9_-]+\s*=/.test(effectiveTrimmed);
    // Increase allowed depth for probable fields to handle unclosed templates better
    const isAtLowDepth = lineBraceDepthBefore <= (isProbableField ? 8 : 2);
    
    if (effectiveTrimmed.startsWith('|') && (isProbableField || lineBraceDepthBefore <= 2) && isAtLowDepth) {
      if (currentKey) {
        fields[currentKey] = currentValue.trim();
      }
      const eqIdx = effectiveTrimmed.indexOf('=');
      if (eqIdx !== -1) {
        currentKey = effectiveTrimmed.substring(1, eqIdx).trim().toLowerCase();
        currentValue = effectiveTrimmed.substring(eqIdx + 1);
      } else {
        currentKey = null;
        currentValue = '';
      }
    } else {
      if (currentKey) {
        currentValue += (currentValue ? '\n' : '') + line;
      }
    }
  }

  if (currentKey) {
    fields[currentKey] = currentValue.replace(/\}\}\s*$/, '').trim();
  }

  return fields;
}

function parseNumericValue(text: string): number | null {
  const cleaned = text.replace(/[^0-9,.]/g, '');
  if (!cleaned) return null;
  const match = cleaned.match(/([0-9.,]+)/);
  if (!match) return null;
  const numStr = match[1];
  
  // Basic heuristic for common formats
  if (numStr.includes(',') && numStr.includes('.')) {
    return numStr.indexOf(',') < numStr.indexOf('.') 
      ? parseFloat(numStr.replace(/,/g, ''))
      : parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
  }
  if (numStr.includes(',')) {
    return numStr.split(',').length === 2 && numStr.split(',')[1].length === 3
      ? parseFloat(numStr.replace(/,/g, ''))
      : parseFloat(numStr.replace(',', '.'));
  }
  return parseFloat(numStr);
}
