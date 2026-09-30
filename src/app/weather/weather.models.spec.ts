import {
  compareToYesterday,
  currentHourIndex,
  describeNextHourRain,
  outfitTips,
  PhotonFeature,
  samePlace,
  shareText,
  toSearchResult,
} from './weather.models';

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

describe('describeNextHourRain', () => {
  // Slots every 15 min from 15:30; each covers the 15 minutes before its time.
  const times = ['15:30', '15:45', '16:00', '16:15', '16:30', '16:45', '17:00', '17:15'].map(
    (t) => `2026-09-30T${t}`,
  );
  const rain = (...amounts: number[]) =>
    describeNextHourRain('2026-09-30T15:30', amounts[0], times, amounts);

  it('warns when rain is about to start', () => {
    expect(rain(0, 0, 0, 0.4, 1, 1, 1, 1)).toBe('Rain starting in about 30 min');
    expect(rain(0, 0.2, 0, 0, 0, 0, 0, 0)).toBe('Rain starting any minute now');
  });

  it('says when current rain will stop', () => {
    expect(rain(1, 1, 1, 0, 0, 0, 0, 0)).toBe('Rain stopping in about 30 min');
  });

  it('says when rain continues all hour', () => {
    expect(rain(1, 1, 1, 1, 1, 1, 1, 1)).toBe('Rain for the next hour');
  });

  it('stays quiet when the next hour is dry', () => {
    expect(rain(0, 0, 0.05, 0, 0, 0, 0, 0)).toBeUndefined();
  });

  it('ignores rain beyond the next hour', () => {
    expect(rain(0, 0, 0, 0, 0, 0, 2, 2)).toBeUndefined();
  });
});

describe('shareText', () => {
  it('summarises the current weather', () => {
    expect(shareText('Quezon City', 21.6, '°C', 'Partly cloudy')).toBe(
      '22°C, partly cloudy in Quezon City',
    );
  });
});

describe('samePlace', () => {
  it('matches places within about 100 m', () => {
    const a = { latitude: 14.5995, longitude: 120.9842 };
    expect(samePlace(a, { name: 'Manila', latitude: 14.5999, longitude: 120.9838 })).toBe(true);
    expect(samePlace(a, { latitude: 14.61, longitude: 120.9842 })).toBe(false);
    expect(samePlace(a, undefined)).toBe(false);
  });
});

describe('currentHourIndex', () => {
  const times = ['2026-09-30T00:00', '2026-09-30T01:00', '2026-09-30T02:00'];

  it('finds the hour containing now', () => {
    expect(currentHourIndex('2026-09-30T01:45', times)).toBe(1);
  });

  it('falls back to the start', () => {
    expect(currentHourIndex('2026-09-29T23:00', times)).toBe(0);
    expect(currentHourIndex('2026-10-02T00:00', times)).toBe(0);
  });
});

describe('compareToYesterday', () => {
  it('describes the difference in highs', () => {
    expect(compareToYesterday(15, 12.2)).toBe('3° warmer than yesterday');
    expect(compareToYesterday(10, 14)).toBe('4° cooler than yesterday');
    expect(compareToYesterday(10.3, 10)).toBe('About the same as yesterday');
  });
});

describe('outfitTips', () => {
  const tips = (temperature: number, rainChance = 0, uv = 0, windKmh = 0) =>
    outfitTips({ temperature, rainChance, uv, windKmh }).map((tip) => tip.label);

  it('picks clothing by feels-like temperature', () => {
    expect(tips(-2)).toEqual(['Warm coat']);
    expect(tips(10)).toEqual(['Jacket']);
    expect(tips(16)).toEqual(['Light sweater']);
    expect(tips(21)).toEqual(['T-shirt']);
    expect(tips(30)).toEqual(['Light, breathable clothes']);
  });

  it('adds rain, sun and wind gear when needed', () => {
    expect(tips(21, 60, 7, 35)).toEqual(['T-shirt', 'Umbrella', 'Sunscreen & hat', 'Windbreaker']);
    expect(tips(21, 39, 3, 29)).toEqual(['T-shirt', 'Sunscreen']);
  });
});
