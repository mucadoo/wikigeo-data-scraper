import { describe, it, expect, vi } from 'vitest';
import { WikiGeoClient, getEmptySubdivision } from '../src/sdk/index.js';

const sample = () => [
  { ...getEmptySubdivision(), code: 'US-CA', countryIsoCode: 'US', name: { ...getEmptySubdivision().name, en: 'California' }, typeEn: 'state', population: 39000000, description: { ...getEmptySubdivision().description, en: 'A state.' } },
  { ...getEmptySubdivision(), code: 'US-NY', countryIsoCode: 'US', name: { ...getEmptySubdivision().name, en: 'New York' }, typeEn: 'state', population: 20000000, description: { ...getEmptySubdivision().description, en: 'A state.' } },
  { ...getEmptySubdivision(), code: 'FR-ARA', countryIsoCode: 'FR', name: { ...getEmptySubdivision().name, en: 'Auvergne-Rhône-Alpes' }, typeEn: 'region', population: 8000000, description: { ...getEmptySubdivision().description, en: 'A region.' } },
];

describe('WikiGeoClient subdivisions (local injection)', () => {
  it('getFullSubdivisions returns the injected list', async () => {
    const client = new WikiGeoClient({ dataSource: 'local', localSubdivisions: sample() });
    const { data, source } = await client.getFullSubdivisions();
    expect(source).toBe('local');
    expect(data.map(s => s.code)).toEqual(['US-CA', 'US-NY', 'FR-ARA']);
  });

  it('listSubdivisions strips detail fields and can filter by country', async () => {
    const client = new WikiGeoClient({ dataSource: 'local', localSubdivisions: sample() });
    const { data: all } = await client.listSubdivisions();
    expect(all[0]).toHaveProperty('name');
    expect(all[0]).not.toHaveProperty('population');

    const { data: us } = await client.listSubdivisions('us');
    expect(us.map(s => s.code)).toEqual(['US-CA', 'US-NY']);
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
    expect(data).toHaveLength(3);
  });

  it('getSubdivision hits the per-code endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => sample()[0] });
    const client = new WikiGeoClient({ dataSource: 'remote', baseUrl: 'https://api.example.com/' });
    await client.getSubdivision('us-ca');
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/api/v1/subdivisions/US-CA.json');
  });
});
