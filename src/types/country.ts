import { z } from 'zod';

export const LANGUAGES = ['en', 'pt', 'fr', 'it', 'es', 'de', 'ja', 'ru', 'zh'] as const;
export type Language = typeof LANGUAGES[number];

export const LocalizedField = z.object({
  en: z.string().nullable().describe("English translation"),
  pt: z.string().nullable().describe("Portuguese translation"),
  fr: z.string().nullable().describe("French translation"),
  it: z.string().nullable().describe("Italian translation"),
  es: z.string().nullable().describe("Spanish translation"),
  de: z.string().nullable().describe("German translation"),
  ja: z.string().nullable().describe("Japanese translation"),
  ru: z.string().nullable().describe("Russian translation"),
  zh: z.string().nullable().describe("Chinese translation"),
});

export const getEmptyLocalizedField = (): z.infer<typeof LocalizedField> => ({
  en: null,
  pt: null,
  fr: null,
  it: null,
  es: null,
  de: null,
  ja: null,
  ru: null,
  zh: null,
});

export const MultiLangLinkField = z.object({
  articleId: z.string().nullable().describe("Unique identifier of the Wikipedia article"),
  name: LocalizedField.describe("Localized name of the linked entity"),
});

export const LinkedArrayField = z.array(MultiLangLinkField);

export const Coordinates = z.object({
  lat: z.number(),
  lng: z.number(),
});
export type Coord = z.infer<typeof Coordinates>;

export const GovernmentLeader = z.object({
  title: z.string().describe("Leadership title as listed in the infobox, e.g. 'President'"),
  name: z.string().describe("Name of the office holder (English)"),
  articleId: z.string().nullable().describe("Wikipedia article id for the office holder, if linked"),
});

export const CountrySchema = z.object({
  isoCode: z.string().nullable().describe("ISO 3166-1 alpha-2 code of the country"),
  isoCode3: z.string().nullable().describe("ISO 3166-1 alpha-3 code of the country"),
  isoNumeric: z.string().nullable().describe("ISO 3166-1 numeric code of the country"),
  continent: z.string().nullable().describe("Continent the country belongs to"),
  continentCodes: z.array(z.string()).default([]).describe("Two-letter codes of every continent this country belongs to, primary first (two for contiguous transcontinental states); see the separate continents dataset"),
  name: LocalizedField.describe("Localized name of the country"),
  flagUrl: z.string().nullable().describe("URL to the national flag image"),
  description: LocalizedField.describe("Localized descriptive summary"),
  capital: z.array(MultiLangLinkField).nullable().describe("List of capital cities with localized names"),
  capitalCoordinates: Coordinates.nullable().describe("Approximate coordinates of the capital"),
  largestCity: LinkedArrayField.describe("List of largest cities with localized names"),
  population: z.number().int().nullable().describe("Total population count"),
  populationYear: z.number().int().nullable().describe("Reference year for the population figure"),
  areaKm2: z.number().nullable().describe("Total area in square kilometers"),
  densityKm2: z.number().nullable().describe("Population density (people/km²)"),
  government: LinkedArrayField.describe("Types of government"),
  governmentLeaders: z.array(GovernmentLeader).describe("Heads of state/government and other listed leaders (English)"),
  officialLanguage: LinkedArrayField.describe("Official languages of the country"),
  demonym: LinkedArrayField.describe("Name used to refer to residents"),
  gdp: z.number().nullable().describe("Nominal GDP in millions USD"),
  gdpPerCapita: z.number().nullable().describe("Nominal GDP per capita in USD"),
  gdpPpp: z.number().nullable().describe("GDP (PPP) in millions USD"),
  gdpPerCapitaPpp: z.number().nullable().describe("GDP per capita (PPP) in USD"),
  gdpYear: z.number().int().nullable().describe("Reference year for the GDP figures"),
  hdi: z.number().nullable().describe("Human Development Index"),
  lifeExpectancy: z.number().nullable().describe("Life expectancy at birth, in years (World Bank)"),
  internetUsagePercent: z.number().nullable().describe("Individuals using the Internet, % of population (World Bank)"),
  unemploymentRate: z.number().nullable().describe("Unemployment rate, % of labor force (World Bank)"),
  currency: z.array(MultiLangLinkField.extend({
    isoCode: z.string().nullable().describe("ISO 4217 currency code"),
  })).nullable().describe("Official currencies"),
  timeZone: LinkedArrayField.describe("Time zones observed"),
  callingCode: z.array(z.string()).nullable().describe("International calling codes"),
  internetTld: z.array(z.string()).nullable().describe("Country-specific top-level internet domains"),
  drivingSide: z.enum(['left', 'right']).nullable().describe("Side of the road traffic drives on"),
  motto: z.string().nullable().describe("National motto (English)"),
  anthem: z.string().nullable().describe("National anthem name (English)"),
  borders: z.array(MultiLangLinkField.extend({
    isoCode: z.string().nullable().describe("ISO 3166-1 alpha-2 code of the bordering country, resolved after the full dataset is built"),
  })).describe("Bordering/neighboring countries"),
  subdivisionCodes: z.array(z.string()).default([]).describe("ISO 3166-2 codes of this country's first-level administrative subdivisions (see the separate subdivisions dataset)"),
});

export type Country = z.infer<typeof CountrySchema>;

export const getEmptyCountry = (): Country => ({
  isoCode: null,
  isoCode3: null,
  isoNumeric: null,
  continent: null,
  continentCodes: [],
  name: getEmptyLocalizedField(),
  flagUrl: null,
  description: getEmptyLocalizedField(),
  capital: [],
  capitalCoordinates: null,
  largestCity: [],
  population: null,
  populationYear: null,
  areaKm2: null,
  densityKm2: null,
  government: [],
  governmentLeaders: [],
  officialLanguage: [],
  demonym: [],
  gdp: null,
  gdpPerCapita: null,
  gdpPpp: null,
  gdpPerCapitaPpp: null,
  gdpYear: null,
  hdi: null,
  lifeExpectancy: null,
  internetUsagePercent: null,
  unemploymentRate: null,
  currency: [],
  timeZone: [],
  callingCode: [],
  internetTld: [],
  drivingSide: null,
  motto: null,
  anthem: null,
  borders: [],
  subdivisionCodes: [],
});
