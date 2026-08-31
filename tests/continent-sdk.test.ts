import { describe, it, expect, vi } from 'vitest';
import { WikiGeoClient, getEmptyContinent } from '../src/sdk/index.js';

const sample = () => [
  { ...getEmptyContinent(), code: 'EU', name: { ...getEmptyContinent().name, en: 'Europe' }, description: { ...getEmptyContinent().description, en: 'A continent.' }, population: 745000000, countryCount: 2, countryIsoCodes: ['FR', 'DE'] },
  { ...getEmptyContinent(), code: 'AS', name: { ...getEmptyContinent().name, en: 'Asia' }, description: { ...getEmptyContinent().description, en: 'A continent.' }, population: 4700000000, countryCount: 1, countryIsoCodes: ['JP'] },
];

describe('WikiGeoClient continents (local injection)', () => {
  it('getFullContinents returns the injected list', async () => {
    const client = new WikiGeoClient({ dataSource: 'local', localContinents: sample() });
    const { data, source } = await client.getFullContinents();
    expect(source).toBe('local');
    expect(data.map(c => c.code)).toEqual(['EU', 'AS']);
  });

  it('listContinents strips detail fields', async () => {
    const client = new WikiGeoClient({ dataSource: 'local', localContinents: sample() });
    const { data } = await client.listContinents();
    expect(data[0]).toHaveProperty('name');
    expect(data[0]).toHaveProperty('countryCount');
    expect(data[0]).not.toHaveProperty('population');
  });

  it('getContinent looks up by code case-insensitively and throws when missing', async () => {
    const client = new WikiGeoClient({ dataSource: 'local', localContinents: sample() });
    const { data } = await client.getContinent('eu');
    expect(data.name.en).toBe('Europe');
    await expect(client.getContinent('ZZ')).rejects.toThrow(/not found/);
  });
});

describe('WikiGeoClient continents (remote)', () => {
  it('fetches continents/all.json and validates it', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => sample() });
    const client = new WikiGeoClient({ dataSource: 'remote', baseUrl: 'https://api.example.com/' });
    const { data, source } = await client.getFullContinents();
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/api/v1/continents/all.json');
    expect(source).toBe('remote');
    expect(data).toHaveLength(2);
  });

  it('getContinent hits the per-code endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => sample()[0] });
    const client = new WikiGeoClient({ dataSource: 'remote', baseUrl: 'https://api.example.com/' });
    await client.getContinent('eu');
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/api/v1/continents/EU.json');
  });
});
