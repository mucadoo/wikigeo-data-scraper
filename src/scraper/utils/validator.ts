import { CountrySchema, LANGUAGES } from '../../types/country.js';

export class DataValidator {
  static validate(data: unknown) {
    const result = CountrySchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Data validation failed: ${JSON.stringify(result.error.issues, null, 2)}`);
    }
    
    const country = result.data;
    const errors: string[] = [];

    // Enforce ISO code
    if (!country.isoCode) errors.push('Missing ISO code');

    // Enforce all languages for name
    LANGUAGES.forEach(lang => {
      if (!country.name[lang]) errors.push(`Missing name for ${lang}`);
    });

    // Enforce English description (others are optional)
    if (!country.description.en) errors.push('Missing English description');

    // Existing essential fields
    if (!country.population) errors.push('Missing population');
    if (!country.areaKm2) errors.push('Missing area');
    
    if (errors.length > 0) {
      throw new Error(`Quality Gate Failed for ${country.isoCode} (${country.name.en || 'Unknown'}): ${errors.join(', ')}`);
    }

    return country;
  }
}
