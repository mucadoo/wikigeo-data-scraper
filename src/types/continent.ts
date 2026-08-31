import { z } from 'zod';
import {
  LocalizedField,
  getEmptyLocalizedField,
  Coordinates,
} from './country.js';

/**
 * A continent: one of the six landmass groupings this dataset's sovereign states are
 * classified into (Africa, Asia, Europe, North America, South America, Oceania — no
 * Antarctica, since it has no sovereign states). Enumerated from a small static registry
 * of Wikidata items; structured facts come from Wikidata, localized descriptions from the
 * matching Wikipedia articles, and population / area fall back to an aggregate of the
 * member countries already in this dataset when Wikidata has no figure.
 */
export const ContinentSchema = z.object({
  code: z.string().describe("Two-letter continent code: AF, AS, EU, NA, SA or OC"),
  wikidataId: z.string().nullable().describe('Wikidata item id (QID)'),
  name: LocalizedField.describe('Localized name of the continent'),
  description: LocalizedField.describe('Localized descriptive summary'),
  coordinates: Coordinates.nullable().describe('Approximate centre point of the continent'),
  population: z.number().int().nullable().describe('Total population'),
  populationYear: z.number().int().nullable().describe('Reference year for the population figure'),
  populationSource: z.enum(['wikidata', 'aggregate']).nullable().describe('Origin of the population figure'),
  areaKm2: z.number().nullable().describe('Total land area in square kilometers'),
  areaSource: z.enum(['wikidata', 'aggregate']).nullable().describe('Origin of the area figure'),
  densityKm2: z.number().nullable().describe('Population density (people/km²)'),
  countryCount: z.number().int().default(0).describe("Number of this dataset's sovereign states on the continent"),
  countryIsoCodes: z.array(z.string()).default([]).describe("ISO 3166-1 alpha-2 codes of this dataset's sovereign states on the continent"),
});

export type Continent = z.infer<typeof ContinentSchema>;

export const getEmptyContinent = (): Continent => ({
  code: '',
  wikidataId: null,
  name: getEmptyLocalizedField(),
  description: getEmptyLocalizedField(),
  coordinates: null,
  population: null,
  populationYear: null,
  populationSource: null,
  areaKm2: null,
  areaSource: null,
  densityKm2: null,
  countryCount: 0,
  countryIsoCodes: [],
});
