import {
  Subdivision,
  SubdivisionSchema,
  getEmptySubdivision,
} from '../../types/subdivision.js';
import { getEmptyLocalizedField, MultiLangLinkField } from '../../types/country.js';
import { z } from 'zod';

type LocalizedKey = 'name' | 'type' | 'description';
type MultiLangLink = z.infer<typeof MultiLangLinkField>;

/**
 * Merges a freshly scraped subdivision onto whatever is already stored, never letting a
 * pass that only fills some languages erase locales another pass already contributed.
 * Mirrors `mergeCountryData` but for the flatter subdivision shape.
 */
export const mergeSubdivisionData = (existingJson: string | null, incoming: Partial<Subdivision>): Subdivision => {
  const empty = getEmptySubdivision();
  let existing: Subdivision;
  try {
    existing = existingJson ? SubdivisionSchema.parse(JSON.parse(existingJson)) : empty;
  } catch {
    existing = empty;
  }

  const merged: Subdivision = { ...empty, ...existing };

  // Localized object fields: overlay only the non-null locales the incoming pass supplied.
  (['name', 'type', 'description'] as LocalizedKey[]).forEach(field => {
    const incomingVal = incoming[field] || {};
    const nonNull = Object.fromEntries(
      Object.entries(incomingVal).filter(([, v]) => v !== null && v !== undefined),
    );
    merged[field] = { ...getEmptyLocalizedField(), ...(merged[field] || {}), ...nonNull };
  });

  // Localized link arrays: de-duplicate by articleId then English name, overlaying locales.
  const mergeLinks = <T extends MultiLangLink>(current: T[] | null | undefined, next: T[] | null | undefined): T[] => {
    const map = new Map<string, T>();
    const seed = (items: T[] | null | undefined) => {
      (items || []).forEach(item => {
        const key = item.articleId ? `id:${item.articleId}` : `text:${item.name.en}`;
        const prev = map.get(key);
        const nonNull = Object.fromEntries(Object.entries(item.name).filter(([, v]) => v !== null && v !== undefined));
        map.set(key, prev
          ? { ...prev, ...item, name: { ...prev.name, ...nonNull } }
          : { ...item, name: { ...getEmptyLocalizedField(), ...item.name } });
      });
    };
    seed(current);
    seed(next);
    return Array.from(map.values());
  };

  merged.capital = mergeLinks(merged.capital, incoming.capital);
  merged.officialLanguage = mergeLinks(merged.officialLanguage, incoming.officialLanguage);
  merged.borders = mergeLinks(
    merged.borders as (MultiLangLink & { code: string | null })[],
    incoming.borders as (MultiLangLink & { code: string | null })[] | undefined,
  );

  // Scalar fields: overwrite only when the incoming pass carries a real value.
  if (incoming.code) merged.code = incoming.code;
  if (incoming.wikidataId) merged.wikidataId = incoming.wikidataId;
  if (incoming.countryIsoCode) merged.countryIsoCode = incoming.countryIsoCode;
  if (incoming.typeEn) merged.typeEn = incoming.typeEn;
  if (incoming.flagUrl) merged.flagUrl = incoming.flagUrl;
  if (incoming.capitalCoordinates) merged.capitalCoordinates = incoming.capitalCoordinates;
  if (incoming.coordinates) merged.coordinates = incoming.coordinates;
  if (incoming.population) merged.population = incoming.population;
  if (incoming.populationYear) merged.populationYear = incoming.populationYear;
  if (incoming.areaKm2) merged.areaKm2 = incoming.areaKm2;
  if (incoming.densityKm2) merged.densityKm2 = incoming.densityKm2;

  return merged;
};
