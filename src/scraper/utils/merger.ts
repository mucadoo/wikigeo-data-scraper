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
        existingItem.name = { ...existingItem.name, ...newItem.name };
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
  if (newData.areaKm2) country.areaKm2 = newData.areaKm2;
  if (newData.densityKm2) country.densityKm2 = newData.densityKm2;
  if (newData.gdp) country.gdp = newData.gdp;
  if (newData.hdi) country.hdi = newData.hdi;
  if (newData.callingCode && newData.callingCode.length > 0) country.callingCode = newData.callingCode;
  if (newData.internetTld && newData.internetTld.length > 0) country.internetTld = newData.internetTld;

  return country;
};
