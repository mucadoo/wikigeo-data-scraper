import {
  Continent,
  ContinentSchema,
  getEmptyContinent,
} from '../../types/continent.js';
import { getEmptyLocalizedField } from '../../types/country.js';

type LocalizedKey = 'name' | 'description';

/**
 * Merges a freshly scraped continent onto whatever is already stored, never letting a pass
 * that only fills some languages erase locales another pass already contributed. Mirrors
 * `mergeSubdivisionData` but for the flatter continent shape.
 */
export const mergeContinentData = (existingJson: string | null, incoming: Partial<Continent>): Continent => {
  const empty = getEmptyContinent();
  let existing: Continent;
  try {
    existing = existingJson ? ContinentSchema.parse(JSON.parse(existingJson)) : empty;
  } catch {
    existing = empty;
  }

  const merged: Continent = { ...empty, ...existing };

  // Localized object fields: overlay only the non-null locales the incoming pass supplied.
  (['name', 'description'] as LocalizedKey[]).forEach(field => {
    const incomingVal = incoming[field] || {};
    const nonNull = Object.fromEntries(
      Object.entries(incomingVal).filter(([, v]) => v !== null && v !== undefined),
    );
    merged[field] = { ...getEmptyLocalizedField(), ...(merged[field] || {}), ...nonNull };
  });

  // Scalar fields: overwrite only when the incoming pass carries a real value.
  if (incoming.code) merged.code = incoming.code;
  if (incoming.wikidataId) merged.wikidataId = incoming.wikidataId;
  if (incoming.coordinates) merged.coordinates = incoming.coordinates;
  if (incoming.population != null) merged.population = incoming.population;
  if (incoming.populationYear != null) merged.populationYear = incoming.populationYear;
  if (incoming.populationSource) merged.populationSource = incoming.populationSource;
  if (incoming.areaKm2 != null) merged.areaKm2 = incoming.areaKm2;
  if (incoming.areaSource) merged.areaSource = incoming.areaSource;
  if (incoming.densityKm2 != null) merged.densityKm2 = incoming.densityKm2;
  if (incoming.countryCount != null) merged.countryCount = incoming.countryCount;
  if (incoming.countryIsoCodes && incoming.countryIsoCodes.length > 0) {
    merged.countryIsoCodes = incoming.countryIsoCodes;
  }

  return merged;
};
