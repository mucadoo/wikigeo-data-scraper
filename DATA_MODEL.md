# Data Model Documentation

This document describes the structure of the sovereign state data provided by this project.

## Metadata
- **Versioning:** Automated from package.json version.
- **Supported Languages:** en, pt, fr, it, es

## Data Dictionary
| Field | Type | Description |
| :--- | :--- | :--- |
| `isoCode` | string | ISO 3166-1 alpha-2 code |
| `isoCode3` | string | ISO 3166-1 alpha-3 code (static reference data) |
| `isoNumeric` | string | ISO 3166-1 numeric code (static reference data) |
| `continent` | string | Continent (static reference data) |
| `name` | Object | Localized name of the country |
| `flagUrl` | string | URL of the national flag |
| `description` | Object | Localized descriptive summary |
| `capital` | Array | List of capital city links |
| `capitalCoordinates` | Object | Approximate `{ lat, lng }` of the capital |
| `largestCity` | Array | List of largest city links |
| `population` | number | Total population |
| `populationYear` | number | Reference year for the population figure |
| `areaKm2` | number | Total area in square kilometers |
| `densityKm2` | number | Population density (people/km²) |
| `government` | Array | Type of government |
| `governmentLeaders` | Array | Heads of state/government and other listed leaders (English) |
| `officialLanguage` | Array | Official languages |
| `demonym` | Array | Name of country residents |
| `gdp` | number | Nominal GDP (in millions USD) |
| `gdpPerCapita` | number | Nominal GDP per capita (USD) |
| `gdpPpp` | number | GDP (PPP) (in millions USD) |
| `gdpPerCapitaPpp` | number | GDP per capita (PPP) (USD) |
| `gdpYear` | number | Reference year for the GDP figures |
| `hdi` | number | Human Development Index |
| `lifeExpectancy` | number | Life expectancy at birth, in years (World Bank) |
| `internetUsagePercent` | number | Individuals using the Internet, % of population (World Bank) |
| `unemploymentRate` | number | Unemployment rate, % of labor force (World Bank) |
| `currency` | Array | Official currency/ies, including ISO 4217 code where available |
| `timeZone` | Array | Time zones |
| `callingCode` | Array | International dialing codes |
| `internetTld` | Array | Country top-level domains |
| `drivingSide` | string | `left` or `right` |
| `motto` | string | National motto (English) |
| `anthem` | string | National anthem name (English) |
| `borders` | Array | Bordering countries. Sourced from Wikidata (P47) where available, falling back to a static ISO reference dataset, resolved to this dataset's entries where possible |

*Note: All "Object" fields (e.g., `name`, `description`) are objects with keys for all supported languages (`en`, `pt`, `fr`, `it`, `es`). All "Array" fields contain objects with localized names and (where applicable) article identifiers, unless noted otherwise.*

## Data Provenance

Most fields are scraped directly from Wikipedia infoboxes and article text. A few fields are
sourced elsewhere because Wikipedia's infobox doesn't reliably carry the data in a structured
form, or because an external source is simply more authoritative:
- `isoCode3`, `isoNumeric`, `continent`: static ISO 3166-1 reference data.
- `borders`: [Wikidata](https://www.wikidata.org/) (P47 "shares border with"), falling back to
  a static curated dataset ([mledoze/countries](https://github.com/mledoze/countries)) when
  Wikidata has no border claims for a country.
- `populationYear` and `drivingSide` fall back to Wikidata when the infobox doesn't state them.
- `gdp`, `gdpPerCapita`, `gdpPpp`, `gdpPerCapitaPpp`, `gdpYear`, `lifeExpectancy`,
  `internetUsagePercent`, `unemploymentRate`: [World Bank Open Data](https://data.worldbank.org/)
  where available (GDP figures fall back to the wikitext-parsed value otherwise).
