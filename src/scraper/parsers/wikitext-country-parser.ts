import { Country, getEmptyLocalizedField } from '../../types/country.js';
import { parseInfoboxFromWikitext } from './wikitext-infobox.js';
import { parseDescriptionFromWikitext } from './wikitext-description.js';

export function parseCountryFromWikitext(wikitext: string, lang: string = 'en'): Partial<Country> {
  const infoboxData = parseInfoboxFromWikitext(wikitext, lang);
  
  const description = parseDescriptionFromWikitext(wikitext);

  const country: Partial<Country> = {
    ...infoboxData,
  };

  const localizedDescription = getEmptyLocalizedField();
  if (description) {
    localizedDescription[lang as keyof typeof localizedDescription] = description;
    
    // Fallback: extract population from description if missing from infobox
    if (!country.population && lang === 'en') {
      const millionMatch = description.match(/population of (?:over|about|nearly|around )?([0-9,.]+)\s*million/i);
      if (millionMatch) {
        country.population = Math.round(parseFloat(millionMatch[1].replace(/,/g, '')) * 1_000_000);
      } else {
          const numMatch = description.match(/population of ([0-9,]+)/i);
          if (numMatch) {
              country.population = parseInt(numMatch[1].replace(/,/g, ''), 10);
          }
      }
    }
  }
  country.description = localizedDescription;

  return country;
}
