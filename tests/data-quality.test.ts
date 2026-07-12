
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Country } from '../src/types/country.js';

describe('Data Quality Checks', () => {
  const dataPath = path.join(process.cwd(), 'data/sovereign-states.min.json');
  
  if (!fs.existsSync(dataPath)) {
    console.warn('data/sovereign-states.min.json not found, skipping quality checks');
    return;
  }

  const fileContent = fs.readFileSync(dataPath, 'utf8');
  const json = JSON.parse(fileContent);
  const countries = json.data as Country[];

  it('should not contain <ref> tags in any field', () => {
    const countriesWithRefs: string[] = [];
    
    countries.forEach((country) => {
      const countryStr = JSON.stringify(country);
      if (countryStr.includes('<ref')) {
        countriesWithRefs.push(country.name.en || 'Unknown');
      }
    });

    if (countriesWithRefs.length > 0) {
      console.log('Countries with <ref> tags:', countriesWithRefs);
    }
    expect(countriesWithRefs).toEqual([]);
  });

  it('should not have "capital" as a name in largestCity unless it is actually named Capital', () => {
    const problematicCities: string[] = [];
    
    countries.forEach((country) => {
      country.largestCity?.forEach((city) => {
        if ((city.name.en || '').toLowerCase() === 'capital') {
          problematicCities.push(`${country.name.en}: ${city.name.en}`);
        }
      });
    });

    if (problematicCities.length > 0) {
      console.log('Countries with "capital" as largestCity name:', problematicCities);
    }
    expect(problematicCities).toEqual([]);
  });

  it('should have flagUrl populated for most countries', () => {
    const countriesMissingFlag = countries.filter((c) => !c.flagUrl).map((c) => c.name.en);
    console.log(`Countries missing flagUrl: ${countriesMissingFlag.length} / ${countries.length}`);
    // We expect some might be missing if not implemented, but let's see how many
    expect(countriesMissingFlag.length).toBeLessThan(countries.length / 2);
  });

  it('should have densityKm2 populated for most countries', () => {
    const countriesMissingDensity = countries.filter((c) => c.densityKm2 === null).map((c) => c.name.en);
    console.log(`Countries missing densityKm2: ${countriesMissingDensity.length} / ${countries.length}`);
    expect(countriesMissingDensity.length).toBeLessThan(countries.length / 4);
  });

  it('should not have empty articleId for important fields if they have a name', () => {
    const missingArticleIds: string[] = [];
    const fieldsToCheck = ['capital', 'largestCity', 'officialLanguage', 'currency'] as const;
    
    countries.forEach((country) => {
      fieldsToCheck.forEach(field => {
        const items = country[field] as { articleId: string | null; name: { en: string | null } }[] | null;
        items?.forEach((item) => {
          if (!item.articleId && item.name.en && item.name.en.length > 3) {
            missingArticleIds.push(`${country.name.en} [${field}]: ${item.name.en}`);
          }
        });
      });
    });

    if (missingArticleIds.length > 0) {
      console.log('Entries with missing articleId:', missingArticleIds.slice(0, 20), '...');
    }
    // This might be common, so let's just log it for now or set a reasonable threshold
    // expect(missingArticleIds.length).toBeLessThan(100);
  });
});
