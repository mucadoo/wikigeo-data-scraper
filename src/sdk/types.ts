import { z } from 'zod';
import { CountrySchema, Country } from '../types/country.js';
import { SubdivisionSchema } from '../types/subdivision.js';

export * from '../types/country.js';
export * from '../types/subdivision.js';

export interface WikiGeoOptions {
    dataSource?: 'local' | 'remote';
    baseUrl?: string;
    localData?: Country[];
    localSubdivisions?: z.infer<typeof SubdivisionSchema>[];
}

export interface WikiGeoResponse<T> {
    data: T;
    source: 'remote' | 'local';
    timestamp: string;
}

export const CountryIndexSchema = z.array(
    CountrySchema.pick({ isoCode: true, name: true, flagUrl: true })
);

export type CountryIndex = z.infer<typeof CountryIndexSchema>;

export const SubdivisionIndexSchema = z.array(
    SubdivisionSchema.pick({ code: true, countryIsoCode: true, name: true, flagUrl: true })
);

export type SubdivisionIndex = z.infer<typeof SubdivisionIndexSchema>;
