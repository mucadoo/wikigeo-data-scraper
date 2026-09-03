import { describe, it, expect, vi } from 'vitest';
import { WikiGeoClient, getEmptySubdivision } from '../src/sdk/index.js';

const sample = () => [
  { ...getEmptySubdivision(), code: 'US-CA', countryIsoCode: 'US', name: { ...getEmptySubdivision().name, en: 'California' }, typeEn: 'state', population: 39000000, description: { ...getEmptySubdivision().description, en: 'A state.' } },
  { ...getEmptySubdivision(), code: 'US-NY', countryIsoCode: 'US', name: { ...getEmptySubdivision().name, en: 'New York' }, typeEn: 'state', population: 20000000, description: { ...getEmptySubdivision().description, en: 'A state.' } },
  { ...getEmptySubdivision(), code: 'FR-ARA', countryIsoCode: 'FR', name: { ...getEmptySubdivision().name, en: 'Auvergne-Rhône-Alpes' }, typeEn: 'region', population: 8000000, description: { ...getEmptySubdivision().description, en: 'A region.' } },
  { ...getEmptySubdivision(), code: 'FR-01', countryIsoCode: 'FR', level: 2 as const, parentCode: 'FR-ARA', name: { ...getEmptySubdivision().name, en: 'Ain' }, typeEn: 'department', population: 650000, description: { ...getEmptySubdivision().description, en: 'A department.' } },
];

describe('WikiGeoClient subdivisions (local injection)', () => {
  it('getFullSubdivisions returns the injected list', async () => {
    const client = new WikiGeoClient({ dataSource: 'local', localSubdivisions: sample() });
    const { data, source } = await client.getFullSubdivisions();
    expect(source).toBe('local');
    expect(data.map(s => s.code)).toEqual(['US-CA', 'US-NY', 'FR-ARA', 'FR-01']);
  });

  it('listSubdivisions strips detail fields and can filter by country and level', async () => {
    const client = new WikiGeoClient({ dataSource: 'local', localSubdivisions: sample() });
    const { data: all } = await client.listSubdivisions();
    expect(all[0]).toHaveProperty('name');
    expect(all[0]).toHaveProperty('level');
    expect(all[0]).not.toHaveProperty('population');

    const { data: us } = await client.listSubdivisions('us');
    expect(us.map(s => s.code)).toEqual(['US-CA', 'US-NY']);

    const { data: frL2 } = await client.listSubdivisions('fr', 2);
    expect(frL2.map(s => s.code)).toEqual(['FR-01']);

    const { data: allL1 } = await client.listSubdivisions(undefined, 1);
    expect(allL1.map(s => s.code)).toEqual(['US-CA', 'US-NY', 'FR-ARA']);
  });

  it('getSubdivision looks up by code case-insensitively and throws when missing', async () => {
    const client = new WikiGeoClient({ dataSource: 'local', localSubdivisions: sample() });
    const { data } = await client.getSubdivision('fr-ara');
    expect(data.name.en).toBe('Auvergne-Rhône-Alpes');
    await expect(client.getSubdivision('US-ZZ')).rejects.toThrow(/not found/);
  });
});

describe('WikiGeoClient subdivisions (remote)', () => {
  it('fetches subdivisions/all.json and validates it', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => sample() });
    const client = new WikiGeoClient({ dataSource: 'remote', baseUrl: 'https://api.example.com/' });
    const { data, source } = await client.getFullSubdivisions();
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/api/v1/subdivisions/all.json');
    expect(source).toBe('remote');
    expect(data).toHaveLength(4);
  });

  it('getSubdivision hits the per-code endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => sample()[0] });
    const client = new WikiGeoClient({ dataSource: 'remote', baseUrl: 'https://api.example.com/' });
    await client.getSubdivision('us-ca');
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/api/v1/subdivisions/US-CA.json');
  });
});
