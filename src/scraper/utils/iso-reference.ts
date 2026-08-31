import countries from 'i18n-iso-countries';
import worldCountriesData from 'world-countries';
import type { Country as WorldCountry } from 'world-countries';
import { CONTINENT_BY_ISO2, continentCodesForIso2 } from './continents.js';

// world-countries ships types written for ESM default-export consumers; under this project's
// NodeNext module resolution the import resolves to the CJS module namespace instead, so cast
// back to the array shape the package actually exports at runtime.
const worldCountries = worldCountriesData as unknown as WorldCountry[];

export interface IsoReference {
  isoCode3: string | null;
  isoNumeric: string | null;
  continent: string | null;
  continentCodes: string[];
}

export function isValidIso2(isoCode: string | null | undefined): isoCode is string {
  return !!isoCode && countries.isValid(isoCode);
}

export function getIsoReference(isoCode: string): IsoReference {
  return {
    isoCode3: countries.alpha2ToAlpha3(isoCode) || null,
    isoNumeric: countries.alpha2ToNumeric(isoCode) || null,
    continent: CONTINENT_BY_ISO2[isoCode] || null,
    continentCodes: continentCodesForIso2(isoCode),
  };
}

// Land borders aren't reliably present as a structured Wikipedia infobox field, so this is
// sourced from the curated mledoze/countries static dataset (via `world-countries`) instead
// of being scraped, keyed by ISO alpha-2 code.
const BORDERS_BY_ISO2: Record<string, string[]> = Object.fromEntries(
  worldCountries.map(c => [
    c.cca2,
    (c.borders || []).map(cca3 => countries.alpha3ToAlpha2(cca3)).filter((v): v is string => !!v),
  ])
);

export function getBorderingIsoCodes(isoCode: string): string[] {
  return BORDERS_BY_ISO2[isoCode] || [];
}

const COMMON_NAME_BY_ISO2: Record<string, string> = Object.fromEntries(
  worldCountries.map(c => [c.cca2, c.name.common])
);

/** English common name for entities that aren't in our own scraped dataset (e.g. non-UN territories). */
export function getCommonName(isoCode: string): string | null {
  return COMMON_NAME_BY_ISO2[isoCode] || null;
}
