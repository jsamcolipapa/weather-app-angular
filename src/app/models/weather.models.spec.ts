import {
  AlertHour,
  bestOutdoorWindow,
  compareToYesterday,
  currentHourIndex,
  describeCloudCover,
  describeDataAge,
  describeDayLength,
  describeDewPoint,
  describeNextHourRain,
  describePressure,
  formatPrecipitation,
  HourConditions,
  minutesBetween,
  moonPath,
  moonPhase,
  outfitTips,
  parseAbsoluteTime,
  PhotonFeature,
  placeFromParams,
  placeToParams,
  samePlace,
  shareText,
  skyProgress,
  toSearchResult,
  weatherAlerts,
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

describe('placeToParams and placeFromParams', () => {
  it('round-trips a place through a link', () => {
    const params = placeToParams({ name: 'Quezon City', latitude: 14.67604, longitude: 121.0437 });
    expect(params.toString()).toBe('lat=14.676&lon=121.0437&name=Quezon+City');
    expect(placeFromParams(params)).toEqual({
      name: 'Quezon City',
      latitude: 14.676,
      longitude: 121.0437,
    });
  });

  it('names a device location with the name it was shown under', () => {
    const params = placeToParams({ latitude: 1, longitude: 2 }, 'Testville');
    expect(params.get('name')).toBe('Testville');
    expect(placeFromParams(new URLSearchParams('lat=1&lon=2'))).toEqual({
      latitude: 1,
      longitude: 2,
    });
  });

  it('ignores missing or invalid coordinates', () => {
    const from = (query: string) => placeFromParams(new URLSearchParams(query));
    expect(from('')).toBeUndefined();
    expect(from('lat=14.6')).toBeUndefined();
    expect(from('lat=&lon=')).toBeUndefined();
    expect(from('lat=north&lon=121')).toBeUndefined();
    expect(from('lat=91&lon=0')).toBeUndefined();
    expect(from('lat=0&lon=-181')).toBeUndefined();
  });
});

describe('weatherAlerts', () => {
  const calm: AlertHour = { temperature: 20, feelsLike: 20, uv: 3, gustKmh: 20 };
  const ids = (changes: Partial<AlertHour>, aqi?: number | null) =>
    weatherAlerts([calm, { ...calm, ...changes }], aqi).map((alert) => alert.id);

  it('stays quiet in ordinary weather', () => {
    expect(ids({}, 80)).toEqual([]);
    expect(ids({ uv: 7.9, gustKmh: 59, temperature: 0.5, feelsLike: 34.9 }, 150)).toEqual([]);
    expect(weatherAlerts([], null)).toEqual([]);
  });

  it('warns once a level is reached in any hour', () => {
    expect(ids({ uv: 8 })).toEqual(['uv']);
    expect(ids({ gustKmh: 60 })).toEqual(['wind']);
    expect(ids({ temperature: 0 })).toEqual(['frost']);
    expect(ids({ feelsLike: 35 })).toEqual(['heat']);
    expect(ids({}, 151)).toEqual(['air']);
  });

  it('describes the UV and air quality levels', () => {
    const messages = weatherAlerts([{ ...calm, uv: 11.2 }], 320).map((alert) => alert.message);
    expect(messages).toEqual(['Extreme UV ahead, up to 11', 'Hazardous air right now (AQI 320)']);
  });
});

describe('highlight labels', () => {
  it('describes the dew point, pressure and cloud cover', () => {
    expect([5, 12, 18, 23].map(describeDewPoint)).toEqual([
      'Dry',
      'Comfortable',
      'Sticky',
      'Muggy',
    ]);
    expect([995, 1013, 1028].map(describePressure)).toEqual(['Low', 'Normal', 'High']);
    expect([10, 40, 70, 95].map(describeCloudCover)).toEqual([
      'Clear',
      'Partly cloudy',
      'Mostly cloudy',
      'Overcast',
    ]);
  });
});

describe('formatPrecipitation', () => {
  it('shows millimetres or inches', () => {
    expect(formatPrecipitation(4.23, 'mm')).toBe('4.2 mm');
    expect(formatPrecipitation(0, 'mm')).toBe('0 mm');
    expect(formatPrecipitation(4.23, 'inch')).toBe('0.17 in');
    expect(formatPrecipitation(25.4, 'inch')).toBe('1 in');
  });
});

describe('describeDataAge', () => {
  const minutes = (n: number) => n * 60_000;

  it('stays quiet while the forecast is fresh and online', () => {
    expect(describeDataAge(minutes(20), true)).toBeUndefined();
    expect(describeDataAge(minutes(-3), true)).toBeUndefined();
  });

  it('says how old a stale forecast is', () => {
    expect(describeDataAge(minutes(50), true)).toBe('Updated 50 min ago');
    expect(describeDataAge(minutes(130), true)).toBe('Updated 2 h ago');
    expect(describeDataAge(minutes(60 * 72), true)).toBe('Updated 3 days ago');
  });

  it('flags being offline', () => {
    expect(describeDataAge(minutes(10), false)).toBe('Offline');
    expect(describeDataAge(minutes(130), false)).toBe('Offline · updated 2 h ago');
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

describe('bestOutdoorWindow', () => {
  const hour = (h: number, changes: Partial<HourConditions> = {}): HourConditions => ({
    time: `2026-09-30T${String(h).padStart(2, '0')}:00`,
    temperature: 21,
    rainChance: 0,
    uv: 2,
    windKmh: 5,
    isDay: h >= 6 && h < 18,
    ...changes,
  });
  const day = (changes: Record<number, Partial<HourConditions>> = {}) =>
    Array.from({ length: 24 }, (_, h) => hour(h, changes[h]));
  const times = (w: { start: Date; end: Date } | undefined) =>
    w && [w.start.getHours(), w.end.getHours()];

  it('picks the earliest ideal window from now', () => {
    expect(times(bestOutdoorWindow(day(), '2026-09-30T09:20'))).toEqual([9, 11]);
  });

  it('avoids rain, strong sun, wind and cold', () => {
    const hours = day({
      9: { rainChance: 80 },
      10: { uv: 9 },
      11: { windKmh: 45 },
      12: { temperature: 8 },
      14: { rainChance: 10 },
    });
    expect(times(bestOutdoorWindow(hours, '2026-09-30T09:00'))).toEqual([15, 17]);
  });

  it('only uses daylight hours left today', () => {
    expect(bestOutdoorWindow(day(), '2026-09-30T17:10')).toBeUndefined();
  });
});

describe('describeDayLength', () => {
  it('formats the length and the change since yesterday', () => {
    expect(describeDayLength(minutesBetween('2026-09-30T06:35', '2026-09-30T17:42'))).toBe(
      '11h 7m',
    );
    expect(describeDayLength(667, 670)).toBe('11h 7m · 3 min shorter than yesterday');
    expect(describeDayLength(701, 699)).toBe('11h 41m · 2 min longer than yesterday');
    expect(describeDayLength(700, 700)).toBe('11h 40m · same as yesterday');
  });
});

describe('skyProgress', () => {
  const at = (time: string) => new Date(`2026-09-30T${time}`);
  const sunrise = at('06:00');
  const sunset = at('18:00');

  it('follows the sun through the daylight', () => {
    expect(skyProgress(at('06:00'), sunrise, sunset, 'dawn')).toBe(0);
    expect(skyProgress(at('12:00'), sunrise, sunset, 'day')).toBe(0.5);
    expect(skyProgress(at('15:00'), sunrise, sunset, 'day')).toBe(0.75);
    expect(skyProgress(at('18:00'), sunrise, sunset, 'dusk')).toBe(1);
  });

  it('keeps the sun on the horizon during twilight outside the daylight', () => {
    expect(skyProgress(at('05:40'), sunrise, sunset, 'dawn')).toBe(0);
    expect(skyProgress(at('18:30'), sunrise, sunset, 'dusk')).toBe(1);
  });

  it('follows the moon through the night, either side of midnight', () => {
    expect(skyProgress(at('21:00'), sunrise, sunset, 'night')).toBe(0.25);
    expect(skyProgress(at('03:00'), sunrise, sunset, 'night')).toBe(0.75);
  });
});

describe('moonPath', () => {
  it('draws nothing lit at new moon and the whole disc at full moon', () => {
    // New moon: out along the right edge and straight back along it, enclosing nothing.
    expect(moonPath(0, 20)).toBe('M 20 0 A 20 20 0 0 1 20 40 A 20 20 0 0 0 20 0 Z');
    // Full moon: out along the left edge and back along the right.
    expect(moonPath(0.5, 10)).toBe('M 10 0 A 10 10 0 0 0 10 20 A 10 10 0 0 0 10 0 Z');
  });
});

describe('moonPhase', () => {
  it('names the phase and how much is lit', () => {
    const full = moonPhase(new Date(Date.UTC(2026, 8, 26, 12)));
    expect(full.name).toBe('Full moon');
    expect(full.illumination).toBeGreaterThan(0.99);

    expect(moonPhase(new Date(Date.UTC(2026, 7, 17, 12))).name).toBe('Waxing crescent');
    expect(moonPhase(new Date(Date.UTC(2026, 8, 10, 12))).name).toBe('Waning crescent');
  });

  it('is timezone-independent when parsed with the utc offset', () => {
    // 2026-09-30T15:30 at utc_offset_seconds 0 is 15:30Z → ~83% lit (Waning gibbous).
    const atUtc = moonPhase(parseAbsoluteTime('2026-09-30T15:30', 0));
    expect(atUtc.name).toBe('Waning gibbous');
    expect(Math.round(atUtc.illumination * 100)).toBe(83);
    expect(parseAbsoluteTime('2026-09-30T15:30', 0).getTime()).toBe(Date.UTC(2026, 8, 30, 15, 30));

    // Same wall-clock in UTC+8 is 07:30Z → ~85% lit; offset must shift the instant.
    const inManila = moonPhase(parseAbsoluteTime('2026-09-30T15:30', 8 * 3600));
    expect(Math.round(inManila.illumination * 100)).toBe(85);
    expect(parseAbsoluteTime('2026-09-30T15:30', 8 * 3600).getTime()).toBe(
      Date.UTC(2026, 8, 30, 7, 30),
    );
  });
});
