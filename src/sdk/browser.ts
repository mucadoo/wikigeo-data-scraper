import { z } from 'zod';
import { CountrySchema, Country } from '../types/country.js';
import { SubdivisionSchema, Subdivision } from '../types/subdivision.js';
import { ContinentSchema, Continent } from '../types/continent.js';
import {
    WikiGeoOptions,
    CountryIndexSchema,
    WikiGeoResponse,
    CountryIndex,
    SubdivisionIndexSchema,
    SubdivisionIndex,
    ContinentIndexSchema,
    ContinentIndex,
} from './types.js';

export * from './types.js';

export class WikiGeoClient {
    private dataSource: 'local' | 'remote';
    private baseUrl: string;
    private localData?: Country[];
    private localSubdivisions?: Subdivision[];
    private localContinents?: Continent[];

    constructor(options: WikiGeoOptions = {}) {
        this.dataSource = options.dataSource || 'local';
        this.baseUrl = options.baseUrl || 'https://mucadoo.github.io/wikigeo-data-scraper/';
        this.localData = options.localData;
        this.localSubdivisions = options.localSubdivisions;
        this.localContinents = options.localContinents;
        if (!this.baseUrl.endsWith('/')) this.baseUrl += '/';
    }

    private async getLocalData(): Promise<Country[]> {
        if (this.localData) return this.localData;
        throw new Error(`Local data not found. Please provide 'localData' in constructor.`);
    }

    private async getLocalSubdivisions(): Promise<Subdivision[]> {
        if (this.localSubdivisions) return this.localSubdivisions;
        throw new Error(`Local subdivisions not found. Please provide 'localSubdivisions' in constructor.`);
    }

    private async getLocalContinents(): Promise<Continent[]> {
        if (this.localContinents) return this.localContinents;
        throw new Error(`Local continents not found. Please provide 'localContinents' in constructor.`);
    }

    async getFullDatabase(): Promise<WikiGeoResponse<Country[]>> {
        if (this.dataSource === 'local') {
            return {
                data: await this.getLocalData(),
                source: 'local',
                timestamp: new Date().toISOString()
            };
        }

        const response = await fetch(`${this.baseUrl}api/v1/all.json`);
        if (!response.ok) throw new Error(`Failed to fetch full database: ${response.statusText}`);

        const data = await response.json();
        return {
            data: z.array(CountrySchema).parse(data),
            source: 'remote',
            timestamp: new Date().toISOString()
        };
    }

    async listCountries(): Promise<WikiGeoResponse<CountryIndex>> {
        if (this.dataSource === 'local') {
            const data = await this.getLocalData();
            return {
                data: CountryIndexSchema.parse(data),
                source: 'local',
                timestamp: new Date().toISOString()
            };
        }

        const response = await fetch(`${this.baseUrl}api/v1/index.json`);
        if (!response.ok) throw new Error(`Failed to fetch country list: ${response.statusText}`);

        const jsonData = await response.json();
        return {
            data: CountryIndexSchema.parse(jsonData),
            source: 'remote',
            timestamp: new Date().toISOString()
        };
    }

    async getCountry(isoCode: string): Promise<WikiGeoResponse<Country>> {
        if (this.dataSource === 'local') {
            const data = await this.getLocalData();
            const country = data.find(c => c.isoCode === isoCode.toUpperCase());
            if (!country) throw new Error(`Country ${isoCode} not found in local data`);
            return {
                data: CountrySchema.parse(country),
                source: 'local',
                timestamp: new Date().toISOString()
            };
        }

        const response = await fetch(`${this.baseUrl}api/v1/countries/${isoCode.toUpperCase()}.json`);
        if (!response.ok) throw new Error(`Failed to fetch country ${isoCode}: ${response.statusText}`);

        const jsonData = await response.json();
        return {
            data: CountrySchema.parse(jsonData),
            source: 'remote',
            timestamp: new Date().toISOString()
        };
    }

    async getFullSubdivisions(): Promise<WikiGeoResponse<Subdivision[]>> {
        if (this.dataSource === 'local') {
            return {
                data: await this.getLocalSubdivisions(),
                source: 'local',
                timestamp: new Date().toISOString()
            };
        }

        const response = await fetch(`${this.baseUrl}api/v1/subdivisions/all.json`);
        if (!response.ok) throw new Error(`Failed to fetch subdivisions: ${response.statusText}`);

        const data = await response.json();
        return {
            data: z.array(SubdivisionSchema).parse(data),
            source: 'remote',
            timestamp: new Date().toISOString()
        };
    }

    async listSubdivisions(countryIsoCode?: string): Promise<WikiGeoResponse<SubdivisionIndex>> {
        const filter = (list: SubdivisionIndex): SubdivisionIndex =>
            countryIsoCode ? list.filter(s => s.countryIsoCode === countryIsoCode.toUpperCase()) : list;

        if (this.dataSource === 'local') {
            const data = await this.getLocalSubdivisions();
            return {
                data: filter(SubdivisionIndexSchema.parse(data)),
                source: 'local',
                timestamp: new Date().toISOString()
            };
        }

        const response = await fetch(`${this.baseUrl}api/v1/subdivisions/index.json`);
        if (!response.ok) throw new Error(`Failed to fetch subdivision list: ${response.statusText}`);

        const jsonData = await response.json();
        return {
            data: filter(SubdivisionIndexSchema.parse(jsonData)),
            source: 'remote',
            timestamp: new Date().toISOString()
        };
    }

    async getSubdivision(code: string): Promise<WikiGeoResponse<Subdivision>> {
        const normalized = code.toUpperCase();
        if (this.dataSource === 'local') {
            const data = await this.getLocalSubdivisions();
            const subdivision = data.find(s => s.code === normalized);
            if (!subdivision) throw new Error(`Subdivision ${code} not found in local data`);
            return {
                data: SubdivisionSchema.parse(subdivision),
                source: 'local',
                timestamp: new Date().toISOString()
            };
        }

        const response = await fetch(`${this.baseUrl}api/v1/subdivisions/${normalized}.json`);
        if (!response.ok) throw new Error(`Failed to fetch subdivision ${code}: ${response.statusText}`);

        const jsonData = await response.json();
        return {
            data: SubdivisionSchema.parse(jsonData),
            source: 'remote',
            timestamp: new Date().toISOString()
        };
    }

    async getFullContinents(): Promise<WikiGeoResponse<Continent[]>> {
        if (this.dataSource === 'local') {
            return {
                data: await this.getLocalContinents(),
                source: 'local',
                timestamp: new Date().toISOString()
            };
        }

        const response = await fetch(`${this.baseUrl}api/v1/continents/all.json`);
        if (!response.ok) throw new Error(`Failed to fetch continents: ${response.statusText}`);

        const data = await response.json();
        return {
            data: z.array(ContinentSchema).parse(data),
            source: 'remote',
            timestamp: new Date().toISOString()
        };
    }

    async listContinents(): Promise<WikiGeoResponse<ContinentIndex>> {
        if (this.dataSource === 'local') {
            const data = await this.getLocalContinents();
            return {
                data: ContinentIndexSchema.parse(data),
                source: 'local',
                timestamp: new Date().toISOString()
            };
        }

        const response = await fetch(`${this.baseUrl}api/v1/continents/index.json`);
        if (!response.ok) throw new Error(`Failed to fetch continent list: ${response.statusText}`);

        const jsonData = await response.json();
        return {
            data: ContinentIndexSchema.parse(jsonData),
            source: 'remote',
            timestamp: new Date().toISOString()
        };
    }

    async getContinent(code: string): Promise<WikiGeoResponse<Continent>> {
        const normalized = code.toUpperCase();
        if (this.dataSource === 'local') {
            const data = await this.getLocalContinents();
            const continent = data.find(c => c.code === normalized);
            if (!continent) throw new Error(`Continent ${code} not found in local data`);
            return {
                data: ContinentSchema.parse(continent),
                source: 'local',
                timestamp: new Date().toISOString()
            };
        }

        const response = await fetch(`${this.baseUrl}api/v1/continents/${normalized}.json`);
        if (!response.ok) throw new Error(`Failed to fetch continent ${code}: ${response.statusText}`);

        const jsonData = await response.json();
        return {
            data: ContinentSchema.parse(jsonData),
            source: 'remote',
            timestamp: new Date().toISOString()
        };
    }
}
