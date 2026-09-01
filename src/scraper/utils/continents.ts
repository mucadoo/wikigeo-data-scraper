// Static continent classification by ISO 3166-1 alpha-2 code, covering current UN member states,
// the two UN observer states this dataset also scrapes (Holy See/Vatican City, Palestine), and a
// handful of states with limited recognition (Taiwan, Kosovo, and the Sahrawi Arab Democratic
// Republic/Western Sahara, coded EH per ISO 3166-1).
// A handful of countries straddle two continents by landmass (Russia, Turkey, Kazakhstan, Georgia,
// Armenia, Azerbaijan, Cyprus); these follow the UN geoscheme convention used by most public datasets.
export const CONTINENT_BY_ISO2: Record<string, string> = {
  AF: 'Asia', AL: 'Europe', DZ: 'Africa', AD: 'Europe', AO: 'Africa', AG: 'North America',
  AR: 'South America', AM: 'Asia', AU: 'Oceania', AT: 'Europe', AZ: 'Asia', BS: 'North America',
  BH: 'Asia', BD: 'Asia', BB: 'North America', BY: 'Europe', BE: 'Europe', BZ: 'North America',
  BJ: 'Africa', BT: 'Asia', BO: 'South America', BA: 'Europe', BW: 'Africa', BR: 'South America',
  BN: 'Asia', BG: 'Europe', BF: 'Africa', BI: 'Africa', KH: 'Asia', CM: 'Africa', CA: 'North America',
  CV: 'Africa', CF: 'Africa', TD: 'Africa', CL: 'South America', CN: 'Asia', CO: 'South America',
  KM: 'Africa', CD: 'Africa', CG: 'Africa', CR: 'North America', HR: 'Europe', CU: 'North America',
  CY: 'Asia', CZ: 'Europe', DK: 'Europe', DJ: 'Africa', DM: 'North America', DO: 'North America',
  EC: 'South America', EG: 'Africa', SV: 'North America', GQ: 'Africa', ER: 'Africa', EE: 'Europe',
  SZ: 'Africa', ET: 'Africa', FJ: 'Oceania', FI: 'Europe', FR: 'Europe', GA: 'Africa', GM: 'Africa',
  GE: 'Asia', DE: 'Europe', GH: 'Africa', GR: 'Europe', GD: 'North America', GT: 'North America',
  GN: 'Africa', GW: 'Africa', GY: 'South America', HT: 'North America', HN: 'North America',
  HU: 'Europe', IS: 'Europe', IN: 'Asia', ID: 'Asia', IR: 'Asia', IQ: 'Asia', IE: 'Europe',
  IL: 'Asia', IT: 'Europe', CI: 'Africa', JM: 'North America', JP: 'Asia', JO: 'Asia', KZ: 'Asia',
  KE: 'Africa', KI: 'Oceania', KW: 'Asia', KG: 'Asia', LA: 'Asia', LV: 'Europe', LB: 'Asia',
  LS: 'Africa', LR: 'Africa', LY: 'Africa', LI: 'Europe', LT: 'Europe', LU: 'Europe', MG: 'Africa',
  MW: 'Africa', MY: 'Asia', MV: 'Asia', ML: 'Africa', MT: 'Europe', MH: 'Oceania', MR: 'Africa',
  MU: 'Africa', MX: 'North America', FM: 'Oceania', MD: 'Europe', MC: 'Europe', MN: 'Asia',
  ME: 'Europe', MA: 'Africa', MZ: 'Africa', MM: 'Asia', NA: 'Africa', NR: 'Oceania', NP: 'Asia',
  NL: 'Europe', NZ: 'Oceania', NI: 'North America', NE: 'Africa', NG: 'Africa', KP: 'Asia',
  MK: 'Europe', NO: 'Europe', OM: 'Asia', PK: 'Asia', PW: 'Oceania', PA: 'North America',
  PG: 'Oceania', PY: 'South America', PE: 'South America', PH: 'Asia', PL: 'Europe', PT: 'Europe',
  PS: 'Asia', QA: 'Asia', RO: 'Europe', RU: 'Europe', RW: 'Africa', KN: 'North America', LC: 'North America',
  VA: 'Europe', VC: 'North America', WS: 'Oceania', SM: 'Europe', ST: 'Africa', SA: 'Asia', SN: 'Africa',
  TW: 'Asia', EH: 'Africa', XK: 'Europe',
  RS: 'Europe', SC: 'Africa', SL: 'Africa', SG: 'Asia', SK: 'Europe', SI: 'Europe', SB: 'Oceania',
  SO: 'Africa', ZA: 'Africa', KR: 'Asia', SS: 'Africa', ES: 'Europe', LK: 'Asia', SD: 'Africa',
  SR: 'South America', SE: 'Europe', CH: 'Europe', SY: 'Asia', TJ: 'Asia', TZ: 'Africa',
  TH: 'Asia', TL: 'Asia', TG: 'Africa', TO: 'Oceania', TT: 'North America', TN: 'Africa',
  TR: 'Asia', TM: 'Asia', TV: 'Oceania', UG: 'Africa', UA: 'Europe', AE: 'Asia', GB: 'Europe',
  US: 'North America', UY: 'South America', UZ: 'Asia', VU: 'Oceania', VE: 'South America',
  VN: 'Asia', YE: 'Asia', ZM: 'Africa', ZW: 'Africa',
};

export interface ContinentRegistryEntry {
  /** Two-letter continent code, matching the common AF/AN/AS/EU/NA/SA/OC convention. */
  code: string;
  /** Canonical English name, exactly as it appears as a value in CONTINENT_BY_ISO2. */
  name: string;
  /** Wikidata item id for the continent, used to pull labels, descriptions and figures. */
  wikidataId: string;
}

// The seven continents. Antarctica is included for completeness even though it has no
// sovereign states (its `countryCount` / `countryIsoCodes` are always 0 / empty and its
// figures come entirely from Wikidata). Enumeration is a fixed seven-item list rather than
// a SPARQL query — the set never changes and the QIDs are stable.
export const CONTINENTS: ContinentRegistryEntry[] = [
  { code: 'AF', name: 'Africa', wikidataId: 'Q15' },
  { code: 'AN', name: 'Antarctica', wikidataId: 'Q51' },
  { code: 'AS', name: 'Asia', wikidataId: 'Q48' },
  { code: 'EU', name: 'Europe', wikidataId: 'Q46' },
  { code: 'NA', name: 'North America', wikidataId: 'Q49' },
  { code: 'SA', name: 'South America', wikidataId: 'Q18' },
  { code: 'OC', name: 'Oceania', wikidataId: 'Q55643' },
];

/** Continent codes that legitimately have no sovereign states in this dataset. */
export const CONTINENTS_WITHOUT_COUNTRIES = new Set(['AN']);

export const CONTINENT_CODE_BY_NAME: Record<string, string> = Object.fromEntries(
  CONTINENTS.map(c => [c.name, c.code]),
);

export const CONTINENT_BY_CODE: Record<string, ContinentRegistryEntry> = Object.fromEntries(
  CONTINENTS.map(c => [c.code, c]),
);

// Secondary continents for the sovereign states with contiguous territory on two continents.
// `CONTINENT_BY_ISO2` above holds each country's PRIMARY continent (the value of the country
// `continent` string); the entries here are the additional continent(s) it also belongs to.
// Restricted to the well-established contiguous transcontinental cases — countries that are
// only culturally/politically associated with a second continent (e.g. Armenia, Cyprus) keep
// their single primary assignment.
const EXTRA_CONTINENTS_BY_ISO2: Record<string, string[]> = {
  RU: ['Asia'], // primary Europe; Asian Russia east of the Urals
  TR: ['Europe'], // primary Asia; East Thrace
  KZ: ['Europe'], // primary Asia; west of the Ural River / Emba
  AZ: ['Europe'], // primary Asia; north of the Greater Caucasus watershed
  GE: ['Europe'], // primary Asia; South Caucasus, north slope in Europe
  EG: ['Asia'], // primary Africa; the Sinai Peninsula
};

/**
 * All continents an ISO 3166-1 alpha-2 country belongs to, as two-letter codes, primary
 * first. A single entry for the vast majority of countries; two for the contiguous
 * transcontinental states above.
 */
export const CONTINENT_CODES_BY_ISO2: Record<string, string[]> = Object.fromEntries(
  Object.entries(CONTINENT_BY_ISO2).map(([iso, primaryName]) => {
    const names = [primaryName, ...(EXTRA_CONTINENTS_BY_ISO2[iso] || [])];
    return [iso, names.map(n => CONTINENT_CODE_BY_NAME[n]).filter(Boolean)];
  }),
);

/** Two-letter continent codes for an ISO 3166-1 alpha-2 country code (primary first), or []. */
export function continentCodesForIso2(isoCode: string): string[] {
  return CONTINENT_CODES_BY_ISO2[isoCode] || [];
}
