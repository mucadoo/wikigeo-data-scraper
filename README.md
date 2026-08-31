# 🌍 WikiGeo Data Scraper & SDK

[![CI and Data Publishing](https://github.com/mucadoo/wikigeo-data-scraper/actions/workflows/publish-data.yml/badge.svg)](https://github.com/mucadoo/wikigeo-data-scraper/actions)
[![NPM Version](https://img.shields.io/npm/v/@mucadoo/wiki-geo-data)](https://www.npmjs.com/package/@mucadoo/wiki-geo-data)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An automated, daily-updated geographical dataset of sovereign states, **their first-level administrative subdivisions** (states, provinces, regions, …) **and the six continents**, built from Wikipedia and Wikidata across 9 languages (**English, Portuguese, French, Italian, Spanish, German, Japanese, Russian, Chinese**).

## 🚀 Consumption Options

This project provides multiple ways to access the data, depending on your needs.

### 1. TypeScript SDK (Recommended for Web/Node)

The SDK provides a type-safe client with support for **Pinned (Local)** or **Live (Remote)** data sources.

**For Node.js:**
```bash
npm install @mucadoo/wiki-geo-data
import { WikiGeoClient } from '@mucadoo/wiki-geo-data';
```

**For Browser/Frontend:**
```bash
npm install @mucadoo/wiki-geo-data
import { WikiGeoClient } from '@mucadoo/wiki-geo-data/browser';
```

#### WikiGeoClient API

**Constructor**
```typescript
new WikiGeoClient(options?: WikiGeoOptions)
```
- `dataSource`: `'local' | 'remote'` (Default: `'local'`)
- `baseUrl`: The base URL for remote API requests.
- `localData`: An array of `Country` objects for manual local data injection.

**Methods**
- `listCountries()`: Returns a summary list of all countries (ISO code, name, flag URL).
- `getCountry(isoCode: string)`: Fetches full details for a specific country by ISO 3166-1 alpha-2 code.
- `getFullDatabase()`: Returns the complete dataset for all countries.
- `listSubdivisions(countryIsoCode?: string)`: Returns a summary list of first-level subdivisions (ISO 3166-2 code, parent country, name, flag), optionally filtered to one country.
- `getSubdivision(code: string)`: Fetches full details for a subdivision by its ISO 3166-2 code (e.g. `US-CA`, `FR-IDF`).
- `getFullSubdivisions()`: Returns the complete subdivisions dataset.
- `listContinents()`: Returns a summary list of the six continents (code, localized name, member-country count).
- `getContinent(code: string)`: Fetches full details for a continent by its two-letter code (`AF`, `AS`, `EU`, `NA`, `SA`, `OC`).
- `getFullContinents()`: Returns the complete continents dataset.

#### Country Data Structure

The `Country` object includes the following primary fields:

| Field | Type | Description |
| :--- | :--- | :--- |
| `isoCode` | `string` | ISO 3166-1 alpha-2 code. |
| `isoCode3` / `isoNumeric` | `string` | ISO 3166-1 alpha-3 / numeric codes (static reference data). |
| `continent` | `string` | Primary continent name (static reference data). |
| `continentCodes` | `string[]` | Two-letter codes of every continent the country belongs to, primary first — two for contiguous transcontinental states (see the continents dataset). |
| `name` | `LocalizedField` | Localized name (`en`, `pt`, `fr`, `it`, `es`). |
| `flagUrl` | `string` | URL to the national flag image. |
| `description`| `LocalizedField` | Localized descriptive summary. |
| `population` | `number` | Total population count. |
| `areaKm2` | `number` | Area in km². |
| `capital` | `LinkedArrayField` | Capital cities with localized names. |
| `currency` | `Array` | Official currencies, including ISO 4217 code where available. |
| `gdp` / `gdpPpp` | `number` | Nominal / PPP GDP (millions USD). |
| `gdpPerCapita` / `gdpPerCapitaPpp` | `number` | Nominal / PPP GDP per capita (USD). |
| `governmentLeaders` | `Array` | Heads of state/government and other listed leaders (English). |
| `borders` | `Array` | Bordering countries. Sourced from a static ISO reference dataset, resolved against this dataset's entries where possible. |

See [`data/DATA_MODEL.md`](data/DATA_MODEL.md) for the complete field list.

*Note: Fields like `name`, `capital`, `officialLanguage`, and `description` use `LocalizedField`, an object containing versions for `en`, `pt`, `fr`, `it`, and `es`.*

#### Basic Usage

```typescript
const client = new WikiGeoClient({ dataSource: 'local' });

// 1. Get a lightweight list of all countries
const countries = await client.listCountries();

// 2. Get full details for a specific country by ISO code
const france = await client.getCountry('FR');
console.log(france.name.fr); // "France"
console.log(france.capital[0].name.en); // "Paris"

// 3. Bulk Export: Get the entire database in one request
const allData = await client.getFullDatabase();

// 4. Subdivisions (states / provinces / regions)
const frenchRegions = await client.listSubdivisions('FR');
const california = await client.getSubdivision('US-CA');
console.log(california.data.type.en);        // "state"
console.log(california.data.capital[0].name.en); // "Sacramento"
```

#### Subdivision Data Structure

Each `Subdivision` object carries:

| Field | Type | Description |
| :--- | :--- | :--- |
| `code` | `string` | ISO 3166-2 code (e.g. `US-CA`). |
| `wikidataId` | `string` | Wikidata item id (QID). |
| `countryIsoCode` | `string` | ISO 3166-1 alpha-2 code of the parent country. |
| `name` / `type` | `LocalizedField` | Localized name and subdivision type (`state`, `province`, `region`, …). |
| `typeEn` | `string` | Canonical English subdivision type, for filtering. |
| `description` | `LocalizedField` | Localized descriptive summary. |
| `capital` | `LinkedArrayField` | Administrative seat / capital. |
| `capitalCoordinates` / `coordinates` | `{ lat, lng }` | Capital location / subdivision centre point. |
| `population` / `populationYear` | `number` | Population and its reference year. |
| `areaKm2` / `densityKm2` | `number` | Area in km² and derived population density. |
| `flagUrl` | `string` | URL to the subdivision flag image. |

Countries additionally expose `subdivisionCodes: string[]` — the ISO 3166-2 codes of their first-level subdivisions.

#### Continent Data Structure

Each `Continent` object carries:

| Field | Type | Description |
| :--- | :--- | :--- |
| `code` | `string` | Two-letter continent code (`AF`, `AS`, `EU`, `NA`, `SA`, `OC`). |
| `wikidataId` | `string` | Wikidata item id (QID). |
| `name` / `description` | `LocalizedField` | Localized name and descriptive summary. |
| `coordinates` | `{ lat, lng }` | Approximate centre point. |
| `population` / `populationYear` | `number` | Population and its reference year. |
| `populationSource` / `areaSource` | `string` | `wikidata`, or `aggregate` when summed from member countries. |
| `areaKm2` / `densityKm2` | `number` | Land area in km² and derived population density. |
| `countryCount` | `number` | Number of this dataset's sovereign states on the continent. |
| `countryIsoCodes` | `string[]` | ISO 3166-1 alpha-2 codes of those sovereign states. |

Countries carry the reverse pointer as `continentCodes` (an array — the six contiguous transcontinental states such as Russia and Turkey appear under both of their continents, and in both continents' `countryIsoCodes`).

#### Data Sources

| Mode | Description | Reliability |
| :--- | :--- | :--- |
| `local` (Default) | Uses the `sovereign-states.json` file bundled in your `node_modules`. | **High.** Immutable until you update the package. Works offline. |
| `remote` | Fetches JSON files from GitHub Pages. | **Dynamic.** Always reflects the latest daily crawl from Wikipedia. |

### 2. Static REST API (No SDK required)

Perfect for mobile apps or simple fetch calls.

- **Index:** `https://mucadoo.github.io/wikigeo-data-scraper/api/v1/index.json`
- **Bulk Export:** `https://mucadoo.github.io/wikigeo-data-scraper/api/v1/all.json`
- **Country Detail:** `https://mucadoo.github.io/wikigeo-data-scraper/api/v1/countries/{ISO_CODE}.json` (e.g., `BR.json`, `US.json`)
- **Subdivisions Index / Bulk:** `.../api/v1/subdivisions/index.json` · `.../api/v1/subdivisions/all.json`
- **Subdivision Detail:** `.../api/v1/subdivisions/{ISO_3166_2}.json` (e.g. `US-CA.json`)
- **A Country's Subdivisions:** `.../api/v1/countries/{ISO_CODE}/subdivisions.json`
- **Continents Index / Bulk:** `.../api/v1/continents/index.json` · `.../api/v1/continents/all.json`
- **Continent Detail:** `.../api/v1/continents/{CODE}.json` (e.g. `EU.json`)
- **A Country's Continent(s):** `.../api/v1/countries/{ISO_CODE}/continents.json` (an array)

### 3. Bulk Data Files

For data science, analytics, or spreadsheet use:

- **JSON (Full):** `sovereign-states.json` / `subdivisions.json` / `continents.json` (Includes metadata)
- **JSON (Minified):** `sovereign-states.min.json` / `subdivisions.min.json` / `continents.min.json`
- **CSV:** `sovereign-states.csv` / `subdivisions.csv` / `continents.csv` (Ideal for Excel/Pandas)

## 🛠 Data Contract & Documentation

We use Zod to enforce a strict data contract.

  - 📖 [Data Model Dictionary](data/DATA_MODEL.md) - Explanations for every field (countries, subdivisions and continents).
  - 📜 [Country JSON Schema](data/schema.json) · [Subdivision JSON Schema](data/subdivision.schema.json) · [Continent JSON Schema](data/continent.schema.json) - For technical validation.

## 🔄 Versioning Strategy

  - Data Snapshots: New snapshots are generated daily. Check the GitHub Releases for historical data-YYYY.MM.DD tags.
  - SDK (SemVer): The NPM package follows Semantic Versioning. A patch version is released every time the data changes.
      - Use `dataSource: 'local'` to pin your data to the version of the SDK you installed.
      - Use `dataSource: 'remote'` to always get the live daily update from GitHub Pages.

## ⚖️ License & Attribution

  - Code: MIT License.
  - Data: Derived from Wikipedia. Data is available under Creative Commons Attribution-ShareAlike License. You must attribute Wikipedia and the contributors of this project.

Generated automatically by a team of Scraper Bots 🤖
