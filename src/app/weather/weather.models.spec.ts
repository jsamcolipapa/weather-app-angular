import { PhotonFeature, toSearchResult } from './weather.models';

const feature = (properties: Partial<PhotonFeature['properties']>): PhotonFeature => ({
  geometry: { coordinates: [121.056, 14.585] },
  properties: { osm_type: 'W', osm_id: 42, ...properties },
});

describe('toSearchResult', () => {
  it('describes where a landmark is', () => {
    const result = toSearchResult(
      feature({
        name: 'SM Megamall',
        city: 'Mandaluyong',
        county: 'Metro Manila',
        state: 'Metro Manila',
        country: 'Philippines',
      }),
    );
    expect(result).toEqual({
      id: 'W42',
      name: 'SM Megamall',
      detail: 'Mandaluyong, Metro Manila, Philippines',
      latitude: 14.585,
      longitude: 121.056,
    });
  });

  it("doesn't repeat the place's own name in its detail", () => {
    const result = toSearchResult(
      feature({ name: 'Makati', city: 'Makati', state: 'Metro Manila', country: 'Philippines' }),
    );
    expect(result?.detail).toBe('Metro Manila, Philippines');
  });

  it('skips unnamed features', () => {
    expect(toSearchResult(feature({ city: 'Taguig' }))).toBeUndefined();
  });
});
