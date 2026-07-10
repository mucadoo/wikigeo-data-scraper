import { Country, getEmptyLocalizedField } from '../../types/country.js';
import { ExtractionUtils } from '../utils/extraction.js';

export function parseWikilinks(raw: string): Array<{ articleId: string | null, text: string }> {
  const segments = raw.split(/<br\s*\/?>|\n|\*|\{\{plainlist|\|\|\}\}/gi).map(s => s.trim()).filter(s => s.length > 0);
  return segments.map(segment => {
    const linkMatch = segment.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    if (linkMatch) {
      return { articleId: linkMatch[1], text: linkMatch[2] || linkMatch[1] };
    }
    const cleanText = segment.replace(/'''|''|\{\{[^}]+\}\}/g, '').trim();
    return { articleId: null, text: cleanText };
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
    areaKm2: ['area_km2', 'area_sqkm', 'area', 'superficie_totale', 'superficie'],
    densityKm2: ['density_km2', 'population_density_km2', 'densité'],
    government: ['government_type', 'type_gouvernement'],
    officialLanguage: ['official_languages', 'languages_type', 'languages', 'langues_officielles'],
    currency: ['currency', 'monnaie', 'code_monnaie'],
    timeZone: ['timezone', 'utc_offset', 'time_zone', 'fuseau_horaire'],
    callingCode: ['calling_code', 'indicatif_téléphonique'],
    internetTld: ['cctld', 'domaine_internet'],
    hdi: ['hdi', 'idh'],
    gdp: ['gdp_nominal', 'pib'],
    flagUrl: ['flag_image', 'flag', 'image_drapeau'],
    isoCode: ['iso3166code', 'iso3166-1', 'iso3166_1', 'iso_3166-1'],
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

  // Parsing logic
  const rawPopulation = getField(FIELD_MAP.population);
  if (rawPopulation) {
    const val = ExtractionUtils.extractPopulation(rawPopulation);
    if (val) result.population = parseInt(val, 10);
  }

  const rawArea = getField(FIELD_MAP.areaKm2);
  if (rawArea) {
    const val = ExtractionUtils.extractArea(rawArea);
    if (val) result.areaKm2 = parseFloat(val);
  }

  const rawCapital = getField(FIELD_MAP.capital);
  if (rawCapital) {
    console.log(`[DEBUG] Found capital raw: "${rawCapital}"`);
    result.capital = parseWikilinks(rawCapital).map(link => ({
      articleId: link.articleId,
      name: { ...getEmptyLocalizedField(), en: link.text }
    }));
    console.log(`[DEBUG] Extracted capital links: ${result.capital.length}`);
  }

  const rawHdi = getField(FIELD_MAP.hdi);
  if (rawHdi) {
    const match = rawHdi.match(/0\.\d{3}/);
    if (match) result.hdi = parseFloat(match[0]);
  }

  const rawGdp = getField(FIELD_MAP.gdp);
  if (rawGdp) {
    result.gdp = parseNumericValue(rawGdp);
  }

  let rawIso = getField(FIELD_MAP.isoCode);
  if (!rawIso) {
    const coordinates = fields['coordinates'];
    if (coordinates) {
      const regionMatch = coordinates.match(/region:([a-zA-Z]{2})/);
      if (regionMatch) {
        rawIso = regionMatch[1];
      }
    }
  }

  if (rawIso) {
    const cleanIso = rawIso
      .replace(/{{[^}]*}}/g, '')
      .replace(/\[\[[^\]]*\]\]/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/[^a-zA-Z]/g, '');
    const match = cleanIso.match(/\b[a-zA-Z]{2}\b/);
    if (match) result.isoCode = match[0].toUpperCase();
  }

  const rawCallingCode = getField(FIELD_MAP.callingCode);
  if (rawCallingCode) {
    result.callingCode = rawCallingCode.split(/[;,]/).map(s => s.trim()).filter(s => s.length > 0);
  }

  const rawTld = getField(FIELD_MAP.internetTld);
  if (rawTld) {
    result.internetTld = rawTld.split(/[;,]/).map(s => s.trim()).filter(s => s.length > 0);
  }

  result.flagUrl = null; // TODO: Implement thumbnail URL construction

  console.log(`[DEBUG] Extracted ${Object.keys(result).length} fields for infobox`);
  if (Object.keys(result).length === 0) {
    console.log('[DEBUG] Infobox body was:', infoboxBody.substring(0, 200));
  }

  console.log(`[DEBUG] Final result keys: ${Object.keys(result)}`);
  console.log(`[DEBUG] Final result object: ${JSON.stringify(result)}`);
  return result;
}

export function extractInfoboxBody(wikitext: string): string | null {
  const startIdx = wikitext.toLowerCase().indexOf('{{infobox');
  if (startIdx === -1) return null;

  let braceCount = 0;
  let j = startIdx;
  
  while (j < wikitext.length) {
    if (wikitext.startsWith('{{', j)) {
      braceCount += 2;
      j += 2;
    } else if (wikitext.startsWith('}}', j)) {
      braceCount -= 2;
      j += 2;
      if (braceCount === 0) break;
    } else {
      j++;
    }
  }
  
  return wikitext.substring(startIdx, j);
}

export function parseFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = body.split('\n');
  
  let currentKey: string | null = null;
  let currentValue = '';
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Track braces in the entire line
    for (let i = 0; i < line.length; i++) {
      if (line.startsWith('{{', i)) { braceDepth++; i++; }
      else if (line.startsWith('}}', i)) { braceDepth--; i++; }
    }

    // We also allow fields that start with | even if braceDepth > 0 if they are at the start of the line
    if (trimmed.startsWith('|')) {
      console.log(`[DEBUG] Found field line: "${trimmed.substring(0, 30)}..."`);
      braceDepth = 0; // Reset braceDepth at the start of a new field
      if (currentKey) {
        fields[currentKey] = currentValue.trim();
      }
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        currentKey = trimmed.substring(1, eqIdx).trim().toLowerCase();
        currentValue = trimmed.substring(eqIdx + 1);
        console.log(`[DEBUG] Parsed key: "${currentKey}"`);
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
    fields[currentKey] = currentValue.trim();
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
