import { z } from 'zod';
import { CountrySchema, Country } from '../types/country.js';
import { SubdivisionSchema, Subdivision } from '../types/subdivision.js';
import {
    WikiGeoOptions,
    CountryIndexSchema,
    SubdivisionIndexSchema,
    SubdivisionIndex,
} from './types.js';

export * from './types.js';

export class WikiGeoClient {
    private dataSource: 'local' | 'remote';
    private baseUrl: string;
    private localData?: Country[];
    private localSubdivisions?: Subdivision[];

    constructor(options: WikiGeoOptions = {}) {
        this.dataSource = options.dataSource || 'local';
        this.baseUrl = options.baseUrl || 'https://mucadoo.github.io/wikigeo-data-scraper/';
        this.localData = options.localData;
        this.localSubdivisions = options.localSubdivisions;
        if (!this.baseUrl.endsWith('/')) this.baseUrl += '/';
    }

    private async readLocalDataFile<T>(fileName: string): Promise<T[]> {
        if (typeof process !== 'undefined' && process.versions?.node) {
            const fs = await import('fs');
            const path = await import('path');

            // Works in both CJS (__dirname) and ESM (import.meta.url)
            let baseDir: string;
            try {
                const { fileURLToPath } = await import('url');
                baseDir = path.dirname(fileURLToPath(import.meta.url));
            } catch {
                baseDir = __dirname;
            }

            const candidates = [
                path.resolve(process.cwd(), `data/${fileName}`),
                path.resolve(baseDir, `../../data/${fileName}`),
                path.resolve(baseDir, `../data/${fileName}`),
            ];

            for (const p of candidates) {
                if (fs.existsSync(p)) {
                    try {
                        const content = fs.readFileSync(p, 'utf-8');
                        const parsed = JSON.parse(content) as { data: T[] };
                        return parsed.data;
                    } catch { /* try next */ }
                }
            }
        }

        throw new Error(
            `Local data file '${fileName}' not found. Provide it in the constructor, ` +
            `or ensure data/${fileName} is accessible at runtime.`
        );
    }

    private async getLocalData(): Promise<Country[]> {
        if (this.localData) return this.localData;
        return this.readLocalDataFile<Country>('sovereign-states.json');
    }

    private async getLocalSubdivisions(): Promise<Subdivision[]> {
        if (this.localSubdivisions) return this.localSubdivisions;
        return this.readLocalDataFile<Subdivision>('subdivisions.json');
    }

    async getFullDatabase(): Promise<{ data: Country[], source: 'remote' | 'local', timestamp: string }> {
        if (this.dataSource === 'remote') {
            try {
                const response = await fetch(`${this.baseUrl}api/v1/all.json`);
                if (response.ok) {
                    const data = await response.json();
                    return {
                        data: z.array(CountrySchema).parse(data),
                        source: 'remote',
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (e) {
                console.warn('Network failure fetching full database, falling back to local data.', e);
            }
        }
        return {
            data: await this.getLocalData(),
            source: 'local',
            timestamp: new Date().toISOString()
        };
    }

    async listCountries(): Promise<{ data: ReturnType<typeof CountryIndexSchema.parse>, source: 'remote' | 'local', timestamp: string }> {
        if (this.dataSource === 'remote') {
            try {
                const response = await fetch(`${this.baseUrl}api/v1/index.json`);
                if (response.ok) {
                    const jsonData = await response.json();
                    return {
                        data: CountryIndexSchema.parse(jsonData),
                        source: 'remote',
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (e) {
                console.warn('Network failure fetching country list, falling back to local data.', e);
            }
        }
        const data = await this.getLocalData();
        return {
            data: CountryIndexSchema.parse(data),
            source: 'local',
            timestamp: new Date().toISOString()
        };
    }

    async getCountry(isoCode: string): Promise<{ data: Country, source: 'remote' | 'local', timestamp: string }> {
        if (this.dataSource === 'remote') {
            try {
                const response = await fetch(`${this.baseUrl}api/v1/countries/${isoCode.toUpperCase()}.json`);
                if (response.ok) {
                    const jsonData = await response.json();
                    return {
                        data: CountrySchema.parse(jsonData),
                        source: 'remote',
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (e) {
                console.warn(`Network failure fetching country ${isoCode}, falling back to local data.`, e);
            }
        }

        const data = await this.getLocalData();
        const country = data.find(c => c.isoCode === isoCode.toUpperCase());
        if (!country) throw new Error(`Country ${isoCode} not found in local data`);
        return {
            data: CountrySchema.parse(country),
            source: 'local',
            timestamp: new Date().toISOString()
        };
    }

    /** Returns every first-level administrative subdivision (state / province / region / …). */
    async getFullSubdivisions(): Promise<{ data: Subdivision[], source: 'remote' | 'local', timestamp: string }> {
        if (this.dataSource === 'remote') {
            try {
                const response = await fetch(`${this.baseUrl}api/v1/subdivisions/all.json`);
                if (response.ok) {
                    const data = await response.json();
                    return {
                        data: z.array(SubdivisionSchema).parse(data),
                        source: 'remote',
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (e) {
                console.warn('Network failure fetching subdivisions, falling back to local data.', e);
            }
        }
        return {
            data: await this.getLocalSubdivisions(),
            source: 'local',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Returns a lightweight subdivision list (code, parent country, localized name, flag),
     * optionally filtered to a single country by its ISO 3166-1 alpha-2 code.
     */
    async listSubdivisions(countryIsoCode?: string): Promise<{ data: SubdivisionIndex, source: 'remote' | 'local', timestamp: string }> {
        const filter = (list: SubdivisionIndex): SubdivisionIndex =>
            countryIsoCode ? list.filter(s => s.countryIsoCode === countryIsoCode.toUpperCase()) : list;

        if (this.dataSource === 'remote') {
            try {
                const response = await fetch(`${this.baseUrl}api/v1/subdivisions/index.json`);
                if (response.ok) {
                    const jsonData = await response.json();
                    return {
                        data: filter(SubdivisionIndexSchema.parse(jsonData)),
                        source: 'remote',
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (e) {
                console.warn('Network failure fetching subdivision list, falling back to local data.', e);
            }
        }

        const data = await this.getLocalSubdivisions();
        return {
            data: filter(SubdivisionIndexSchema.parse(data)),
            source: 'local',
            timestamp: new Date().toISOString()
        };
    }

    /** Fetches full details for a single subdivision by its ISO 3166-2 code (e.g. `US-CA`). */
    async getSubdivision(code: string): Promise<{ data: Subdivision, source: 'remote' | 'local', timestamp: string }> {
        const normalized = code.toUpperCase();
        if (this.dataSource === 'remote') {
            try {
                const response = await fetch(`${this.baseUrl}api/v1/subdivisions/${normalized}.json`);
                if (response.ok) {
                    const jsonData = await response.json();
                    return {
                        data: SubdivisionSchema.parse(jsonData),
                        source: 'remote',
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (e) {
                console.warn(`Network failure fetching subdivision ${code}, falling back to local data.`, e);
            }
        }

        const data = await this.getLocalSubdivisions();
        const subdivision = data.find(s => s.code === normalized);
        if (!subdivision) throw new Error(`Subdivision ${code} not found in local data`);
        return {
            data: SubdivisionSchema.parse(subdivision),
            source: 'local',
            timestamp: new Date().toISOString()
        };
    }
}
