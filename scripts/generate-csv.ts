import fs from 'fs';
import { Country } from '../src/types/country.js';

const INPUT_FILE = 'data/sovereign-states.json';
const OUTPUT_FILE = 'data/sovereign-states.csv';

function flattenData() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('Input file not found');
    return;
  }

  const json = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  const countries = json.data as Country[];

  const headers = [
    'isoCode', 'isoCode3', 'isoNumeric', 'continent',
    'name_en', 'name_pt', 'name_fr', 'name_it', 'name_es',
    'flagUrl', 'description_en', 'description_pt', 'description_fr', 'description_it', 'description_es',
    'capital', 'capitalLat', 'capitalLng', 'largestCity', 'population', 'populationYear', 'areaKm2', 'densityKm2',
    'government', 'governmentLeaders', 'officialLanguage', 'demonym',
    'gdp', 'gdpPerCapita', 'gdpPpp', 'gdpPerCapitaPpp', 'gdpYear', 'hdi',
    'lifeExpectancy', 'internetUsagePercent', 'unemploymentRate', 'currency',
    'timeZone', 'callingCode', 'internetTld', 'drivingSide', 'motto', 'anthem', 'borders'
  ];

  const rows = countries.map(c => {
    return [
      c.isoCode || '', c.isoCode3 || '', c.isoNumeric || '', c.continent || '',
      c.name.en || '', c.name.pt || '', c.name.fr || '', c.name.it || '', c.name.es || '',
      c.flagUrl || '',
      c.description.en || '', c.description.pt || '', c.description.fr || '', c.description.it || '', c.description.es || '',
      c.capital?.map(i => i.name.en).join('|') || '',
      c.capitalCoordinates?.lat?.toString() || '',
      c.capitalCoordinates?.lng?.toString() || '',
      c.largestCity?.map(i => i.name.en).join('|') || '',
      c.population?.toString() || '',
      c.populationYear?.toString() || '',
      c.areaKm2?.toString() || '',
      c.densityKm2?.toString() || '',
      c.government?.map(i => i.name.en).join('|') || '',
      c.governmentLeaders?.map(l => `${l.title}: ${l.name}`).join('|') || '',
      c.officialLanguage?.map(i => i.name.en).join('|') || '',
      c.demonym?.map(i => i.name.en).join('|') || '',
      c.gdp?.toString() || '',
      c.gdpPerCapita?.toString() || '',
      c.gdpPpp?.toString() || '',
      c.gdpPerCapitaPpp?.toString() || '',
      c.gdpYear?.toString() || '',
      c.hdi?.toString() || '',
      c.lifeExpectancy?.toString() || '',
      c.internetUsagePercent?.toString() || '',
      c.unemploymentRate?.toString() || '',
      c.currency?.map(i => i.isoCode || i.name.en).join('|') || '',
      c.timeZone?.map(i => i.name.en).join('|') || '',
      c.callingCode?.join('|') || '',
      c.internetTld?.join('|') || '',
      c.drivingSide || '',
      c.motto || '',
      c.anthem || '',
      c.borders?.map(b => b.isoCode || b.name.en).join('|') || ''
    ].map(val => `"${val.replace(/"/g, '""')}"`).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(OUTPUT_FILE, csv);
  console.log(`Successfully generated ${OUTPUT_FILE}`);
}

flattenData();
