import { Country, CountrySchema, getEmptyCountry, getEmptyLocalizedField, MultiLangLinkField } from '../../types/country.js';
import { z } from 'zod';

type LocalizedFieldKey = 'name' | 'description';
type LocalizedArrayFieldKey = 'capital' | 'largestCity' | 'officialLanguage' | 'demonym' | 'currency' | 'government' | 'timeZone';
type MultiLangLink = z.infer<typeof MultiLangLinkField>;

export const mergeCountryData = (existingJson: string | null, newData: Partial<Country>): Country => {
  const empty = getEmptyCountry();
  let existing: Country;
  try {
    existing = existingJson ? CountrySchema.parse(JSON.parse(existingJson)) : empty;
  } catch {
    existing = empty;
  }
  
  const country: Country = { ...empty, ...existing };
  
  // 1. Merge String Fields (Name, Description)
  (['name', 'description'] as LocalizedFieldKey[]).forEach(field => {
    const newVal = newData[field] || {};
    const filteredNewVal = Object.fromEntries(
      Object.entries(newVal).filter(([key, v]) => {
        void key; // Explicitly mark as used to satisfy linting
        return v !== null && v !== undefined;
      })
    );
    country[field] = {
      ...getEmptyLocalizedField(),
      ...(country[field] || getEmptyLocalizedField()),
      ...filteredNewVal
    };
  });

  // 2. Merge Array Fields (Capital, Government, etc.)
  (['capital', 'largestCity', 'officialLanguage', 'demonym', 'currency', 'government', 'timeZone'] as LocalizedArrayFieldKey[]).forEach(field => {
    const newVal = (newData[field] || []) as (MultiLangLink & { isoCode?: string | null })[];
    const currentVal = (country[field] || []) as (MultiLangLink & { isoCode?: string | null })[];

    const mergedMap = new Map<string, MultiLangLink & { isoCode?: string | null }>();
    
    // Seed and normalize existing
    currentVal.forEach(item => {
      const key = item.articleId ? `id:${item.articleId}` : `text:${item.name.en}`;
      mergedMap.set(key, { 
        ...item, 
        name: { ...getEmptyLocalizedField(), ...item.name } 
      });
    });
    
    // Merge and normalize new
    newVal.forEach(newItem => {
      const key = newItem.articleId ? `id:${newItem.articleId}` : `text:${newItem.name.en}`;
      const existingItem = mergedMap.get(key);
      if (existingItem) {
        // Only overwrite locales the new pass actually supplied - a null/undefined locale here
        // (e.g. a pass that only ever fills in one language) must not erase one already merged in.
        const filteredNewName = Object.fromEntries(
          Object.entries(newItem.name).filter(([, v]) => v !== null && v !== undefined)
        );
        existingItem.name = { ...existingItem.name, ...filteredNewName };
        if (newItem.isoCode !== undefined) existingItem.isoCode = newItem.isoCode;
      } else {
        mergedMap.set(key, {
          ...newItem,
          name: { ...getEmptyLocalizedField(), ...newItem.name }
        });
      }
    });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    country[field] = Array.from(mergedMap.values()) as any;
  });

  // 3. Keep/Reset root fields (only overwrite if newData has a non-null value)
  if (newData.isoCode) country.isoCode = newData.isoCode;
  if (newData.flagUrl) country.flagUrl = newData.flagUrl;
  if (newData.population) country.population = newData.population;
  if (newData.populationYear) country.populationYear = newData.populationYear;
  if (newData.areaKm2) country.areaKm2 = newData.areaKm2;
  if (newData.densityKm2) country.densityKm2 = newData.densityKm2;
  if (newData.gdp) country.gdp = newData.gdp;
  if (newData.gdpPpp) country.gdpPpp = newData.gdpPpp;
  if (newData.gdpPerCapita) country.gdpPerCapita = newData.gdpPerCapita;
  if (newData.gdpPerCapitaPpp) country.gdpPerCapitaPpp = newData.gdpPerCapitaPpp;
  if (newData.gdpYear) country.gdpYear = newData.gdpYear;
  if (newData.hdi) country.hdi = newData.hdi;
  if (newData.callingCode && newData.callingCode.length > 0) country.callingCode = newData.callingCode;
  if (newData.internetTld && newData.internetTld.length > 0) country.internetTld = newData.internetTld;
  if (newData.drivingSide) country.drivingSide = newData.drivingSide;
  if (newData.motto) country.motto = newData.motto;
  if (newData.anthem) country.anthem = newData.anthem;
  if (newData.capitalCoordinates) country.capitalCoordinates = newData.capitalCoordinates;
  if (newData.governmentLeaders && newData.governmentLeaders.length > 0) country.governmentLeaders = newData.governmentLeaders;

  return country;
};
