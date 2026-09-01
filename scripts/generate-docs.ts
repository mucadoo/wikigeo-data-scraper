import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { CountrySchema, LANGUAGES } from '../src/types/country.js';
import { SubdivisionSchema } from '../src/types/subdivision.js';
import { ContinentSchema } from '../src/types/continent.js';

const OUTPUT_DIR = 'data';
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 1. Generate JSON Schema files (Zod 4 built-in emitter)
const countryJsonSchema = z.toJSONSchema(CountrySchema, { target: 'draft-7' });
countryJsonSchema.title = 'CountrySchema';
fs.writeFileSync(path.join(OUTPUT_DIR, 'schema.json'), JSON.stringify(countryJsonSchema, null, 2));

const subdivisionJsonSchema = z.toJSONSchema(SubdivisionSchema, { target: 'draft-7' });
subdivisionJsonSchema.title = 'SubdivisionSchema';
fs.writeFileSync(path.join(OUTPUT_DIR, 'subdivision.schema.json'), JSON.stringify(subdivisionJsonSchema, null, 2));

const continentJsonSchema = z.toJSONSchema(ContinentSchema, { target: 'draft-7' });
continentJsonSchema.title = 'ContinentSchema';
fs.writeFileSync(path.join(OUTPUT_DIR, 'continent.schema.json'), JSON.stringify(continentJsonSchema, null, 2));

// 2. Generate DATA_MODEL.md
const mdContent = `# Data Model Documentation

This document describes the structure of the sovereign state data provided by this project.

## Metadata
- **Versioning:** Automated from package.json version.
- **Supported Languages:** ${LANGUAGES.join(', ')}

## Data Dictionary
| Field | Type | Description |
| :--- | :--- | :--- |
| \`isoCode\` | string | ISO 3166-1 alpha-2 code |
| \`isoCode3\` | string | ISO 3166-1 alpha-3 code (static reference data) |
| \`isoNumeric\` | string | ISO 3166-1 numeric code (static reference data) |
| \`continent\` | string | Primary continent name (static reference data) |
| \`continentCodes\` | Array | Two-letter codes of every continent the country belongs to, primary first — two for contiguous transcontinental states (details in the separate continents dataset) |
| \`name\` | Object | Localized name of the country |
| \`flagUrl\` | string | URL of the national flag |
| \`description\` | Object | Localized descriptive summary |
| \`capital\` | Array | List of capital city links |
| \`capitalCoordinates\` | Object | Approximate \`{ lat, lng }\` of the capital |
| \`largestCity\` | Array | List of largest city links |
| \`population\` | number | Total population |
| \`populationYear\` | number | Reference year for the population figure |
| \`areaKm2\` | number | Total area in square kilometers |
| \`densityKm2\` | number | Population density (people/km²) |
| \`government\` | Array | Type of government |
| \`governmentLeaders\` | Array | Heads of state/government and other listed leaders (English) |
| \`officialLanguage\` | Array | Official languages |
| \`demonym\` | Array | Name of country residents |
| \`gdp\` | number | Nominal GDP (in millions USD) |
| \`gdpPerCapita\` | number | Nominal GDP per capita (USD) |
| \`gdpPpp\` | number | GDP (PPP) (in millions USD) |
| \`gdpPerCapitaPpp\` | number | GDP per capita (PPP) (USD) |
| \`gdpYear\` | number | Reference year for the GDP figures |
| \`hdi\` | number | Human Development Index |
| \`lifeExpectancy\` | number | Life expectancy at birth, in years (World Bank) |
| \`internetUsagePercent\` | number | Individuals using the Internet, % of population (World Bank) |
| \`unemploymentRate\` | number | Unemployment rate, % of labor force (World Bank) |
| \`currency\` | Array | Official currency/ies, including ISO 4217 code where available |
| \`timeZone\` | Array | Time zones |
| \`callingCode\` | Array | International dialing codes |
| \`internetTld\` | Array | Country top-level domains |
| \`drivingSide\` | string | \`left\` or \`right\` |
| \`motto\` | string | National motto (English) |
| \`anthem\` | string | National anthem name (English) |
| \`borders\` | Array | Bordering countries. Sourced from Wikidata (P47) where available, falling back to a static ISO reference dataset, resolved to this dataset's entries where possible |
| \`subdivisionCodes\` | Array | ISO 3166-2 codes of this country's first-level administrative subdivisions (details in the separate subdivisions dataset) |

*Note: All "Object" fields (e.g., \`name\`, \`description\`) are objects with keys for all supported languages (\`en\`, \`pt\`, \`fr\`, \`it\`, \`es\`). All "Array" fields contain objects with localized names and (where applicable) article identifiers, unless noted otherwise.*

## Subdivisions Dataset

First-level administrative subdivisions (states, provinces, regions, oblasts, …) are published
as a separate dataset (\`subdivisions.json\`, \`subdivisions.min.json\`, \`subdivisions.csv\`) and a
separate set of API files under \`api/v1/subdivisions/\`. JSON Schema: \`subdivision.schema.json\`.

| Field | Type | Description |
| :--- | :--- | :--- |
| \`code\` | string | ISO 3166-2 code, e.g. \`US-CA\` |
| \`wikidataId\` | string | Wikidata item id (QID) |
| \`countryIsoCode\` | string | ISO 3166-1 alpha-2 code of the parent country |
| \`name\` | Object | Localized name of the subdivision |
| \`type\` | Object | Localized subdivision type (\`state\`, \`province\`, \`region\`, …) |
| \`typeEn\` | string | Canonical English subdivision type, for filtering |
| \`flagUrl\` | string | URL of the subdivision flag |
| \`description\` | Object | Localized descriptive summary |
| \`capital\` | Array | Administrative seat / capital city links |
| \`capitalCoordinates\` | Object | Approximate \`{ lat, lng }\` of the capital |
| \`coordinates\` | Object | Approximate \`{ lat, lng }\` centre point of the subdivision |
| \`population\` | number | Total population |
| \`populationYear\` | number | Reference year for the population figure |
| \`areaKm2\` | number | Total area in square kilometers |
| \`densityKm2\` | number | Population density (people/km²) |
| \`officialLanguage\` | Array | Official / administrative languages (Wikidata P37) |
| \`borders\` | Array | Neighbouring subdivisions that carry an ISO 3166-2 \`code\` (Wikidata P47) |

### Subdivision Data Provenance

- The subdivision list, \`code\`, \`wikidataId\`, \`type\`/\`typeEn\`, \`population\`, \`populationYear\`,
  \`areaKm2\`, \`coordinates\`, \`capital\`, \`capitalCoordinates\`, \`flagUrl\`, \`officialLanguage\`
  and \`borders\` come from [Wikidata](https://www.wikidata.org/) (P300 ISO 3166-2 code, P1082
  population, P2046 area, P36 capital, P625 coordinates, P41 flag image, P31 instance-of,
  P37 official language, P47 shares-border-with).
- \`name\` and \`type\` are localized from Wikidata labels; \`description\` is the intro paragraph
  of the matching Wikipedia article in each supported language.
- \`densityKm2\` is computed from \`population\` / \`areaKm2\` when both are present.

## Continents Dataset

The seven continents (Africa, Antarctica, Asia, Europe, North America, South America,
Oceania) are published as a separate dataset
(\`continents.json\`, \`continents.min.json\`, \`continents.csv\`) and a separate set of API files
under \`api/v1/continents/\`. JSON Schema: \`continent.schema.json\`.

| Field | Type | Description |
| :--- | :--- | :--- |
| \`code\` | string | Two-letter continent code: \`AF\`, \`AN\`, \`AS\`, \`EU\`, \`NA\`, \`SA\`, \`OC\` |
| \`wikidataId\` | string | Wikidata item id (QID) |
| \`name\` | Object | Localized name of the continent |
| \`description\` | Object | Localized descriptive summary |
| \`coordinates\` | Object | Approximate \`{ lat, lng }\` centre point of the continent |
| \`population\` | number | Total population |
| \`populationYear\` | number | Reference year for the population figure (when from Wikidata) |
| \`populationSource\` | string | \`wikidata\` or \`aggregate\` (sum of member countries) |
| \`areaKm2\` | number | Total land area in square kilometers |
| \`areaSource\` | string | \`wikidata\` or \`aggregate\` (sum of member countries) |
| \`densityKm2\` | number | Population density (people/km²) |
| \`countryCount\` | number | Number of this dataset's sovereign states on the continent |
| \`countryIsoCodes\` | Array | ISO 3166-1 alpha-2 codes of those sovereign states |

### Continent Data Provenance

- \`name\` is localized from Wikidata labels; \`description\` is the intro paragraph of the
  matching Wikipedia article in each supported language.
- \`population\`, \`populationYear\`, \`areaKm2\` and \`coordinates\` come from [Wikidata](https://www.wikidata.org/)
  (P1082 population, P585 point-in-time, P2046 area, P625 coordinates). When Wikidata carries
  no figure, \`population\` / \`areaKm2\` fall back to the sum of the continent's member countries
  in this dataset and \`populationSource\` / \`areaSource\` is set to \`aggregate\`.
- \`countryIsoCodes\` and \`countryCount\` are derived from this project's static continent
  classification; countries carry the reverse pointer as \`continentCodes\`. The six contiguous
  transcontinental states (Russia, Turkey, Kazakhstan, Azerbaijan, Georgia, Egypt) appear
  under both of their continents. Antarctica has no sovereign states, so its \`countryCount\`
  is \`0\` and \`countryIsoCodes\` is empty.
- \`densityKm2\` is computed from \`population\` / \`areaKm2\` when both are present (and omitted
  when the ratio rounds to zero, as it does for Antarctica).

## Data Provenance

Most fields are scraped directly from Wikipedia infoboxes and article text. A few fields are
sourced elsewhere because Wikipedia's infobox doesn't reliably carry the data in a structured
form, or because an external source is simply more authoritative:
- \`isoCode3\`, \`isoNumeric\`, \`continent\`, \`continentCodes\`: static ISO 3166-1 reference data.
- \`borders\`: [Wikidata](https://www.wikidata.org/) (P47 "shares border with"), falling back to
  a static curated dataset ([mledoze/countries](https://github.com/mledoze/countries)) when
  Wikidata has no border claims for a country.
- \`populationYear\` and \`drivingSide\` fall back to Wikidata when the infobox doesn't state them.
- \`gdp\`, \`gdpPerCapita\`, \`gdpPpp\`, \`gdpPerCapitaPpp\`, \`gdpYear\`, \`lifeExpectancy\`,
  \`internetUsagePercent\`, \`unemploymentRate\`: [World Bank Open Data](https://data.worldbank.org/)
  where available (GDP figures fall back to the wikitext-parsed value otherwise).
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'DATA_MODEL.md'), mdContent);

console.log('Successfully generated schema.json and DATA_MODEL.md in /data');
