import { z } from 'zod';
import {
  LocalizedField,
  getEmptyLocalizedField,
  MultiLangLinkField,
  LinkedArrayField,
  Coordinates,
} from './country.js';

/**
 * An administrative subdivision of a country: a state, province, region, oblast, canton,
 * department, and so on. `level` 1 covers the first-level units a country directly contains
 * (Wikidata P150); `level` 2 covers the units those first-level subdivisions in turn contain
 * (Italian provinces, French départements, Scottish council areas, …), linked upward by
 * `parentCode`. All are enumerated from Wikidata's ISO 3166-2 code property (P300); structured
 * facts come from Wikidata, localized descriptions from the matching Wikipedia articles.
 */
export const SubdivisionSchema = z.object({
  code: z.string().describe("ISO 3166-2 code, e.g. 'US-CA'"),
  wikidataId: z.string().nullable().describe('Wikidata item id (QID)'),
  countryIsoCode: z.string().describe('ISO 3166-1 alpha-2 code of the parent country'),
  level: z.union([z.literal(1), z.literal(2)]).default(1).describe('Administrative depth: 1 = first-level (state/province/region), 2 = second-level (province/department/district within a first-level unit)'),
  parentCode: z.string().nullable().default(null).describe('ISO 3166-2 code of the containing first-level subdivision (level-2 rows only; null for level-1 rows and when the parent carries no code)'),
  name: LocalizedField.describe('Localized name of the subdivision'),
  type: LocalizedField.describe("Localized subdivision type, e.g. 'state', 'province', 'region'"),
  typeEn: z.string().nullable().describe('Canonical English subdivision type, for filtering'),
  flagUrl: z.string().nullable().describe('URL to the subdivision flag image'),
  description: LocalizedField.describe('Localized descriptive summary'),
  capital: z.array(MultiLangLinkField).nullable().describe('Administrative seat / capital city'),
  capitalCoordinates: Coordinates.nullable().describe('Approximate coordinates of the capital'),
  coordinates: Coordinates.nullable().describe('Approximate centre point of the subdivision'),
  population: z.number().int().nullable().describe('Total population count'),
  populationYear: z.number().int().nullable().describe('Reference year for the population figure'),
  areaKm2: z.number().nullable().describe('Total area in square kilometers'),
  densityKm2: z.number().nullable().describe('Population density (people/km²)'),
  officialLanguage: LinkedArrayField.default([]).describe('Official / administrative languages (Wikidata P37)'),
  borders: z.array(MultiLangLinkField.extend({
    code: z.string().nullable().describe('ISO 3166-2 code of the neighbouring subdivision'),
  })).default([]).describe('Neighbouring subdivisions that themselves carry an ISO 3166-2 code (Wikidata P47)'),
});

export type Subdivision = z.infer<typeof SubdivisionSchema>;

export const getEmptySubdivision = (): Subdivision => ({
  code: '',
  wikidataId: null,
  countryIsoCode: '',
  level: 1,
  parentCode: null,
  name: getEmptyLocalizedField(),
  type: getEmptyLocalizedField(),
  typeEn: null,
  flagUrl: null,
  description: getEmptyLocalizedField(),
  capital: [],
  capitalCoordinates: null,
  coordinates: null,
  population: null,
  populationYear: null,
  areaKm2: null,
  densityKm2: null,
  officialLanguage: [],
  borders: [],
});
