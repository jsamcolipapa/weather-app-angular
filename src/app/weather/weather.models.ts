export type TemperatureUnit = 'celsius' | 'fahrenheit';

/** Open-Meteo `wind_speed_unit` values, in the order the unit button cycles through. */
export const WIND_UNITS = ['kmh', 'mph', 'ms'] as const;
export type WindUnit = (typeof WIND_UNITS)[number];
export const WIND_UNIT_LABELS: Record<WindUnit, string> = { kmh: 'km/h', mph: 'mph', ms: 'm/s' };

/** One-line summary for sharing, e.g. "22°C, partly cloudy in Quezon City". */
export function shareText(place: string, temperature: number, unit: string, label: string): string {
  return `${Math.round(temperature)}${unit}, ${label.toLowerCase()} in ${place}`;
}

export interface Place {
  /** Display name. Undefined for device locations until reverse-geocoded. */
  name?: string;
  latitude: number;
  longitude: number;
}

/** Subset of the BigDataCloud reverse-geocode response we use. */
export interface ReverseGeocodeResponse {
  locality: string;
  city: string;
  principalSubdivision: string;
  countryName: string;
}

/** e.g. "Quezon City, Manila" or "Manhattan, New York City". Empty if nothing usable. */
export function formatPlaceName(r: ReverseGeocodeResponse): string {
  const primary = r.locality || r.city;
  const secondary = r.city && r.city !== primary ? r.city : r.principalSubdivision || r.countryName;
  return [primary, secondary].filter(Boolean).join(', ');
}

/** Subset of the Open-Meteo forecast response we request. */
export interface ForecastResponse {
  utc_offset_seconds: number;
  current_units: {
    temperature_2m: string;
    /** "km/h", "mp/h" or "m/s". */
    wind_speed_10m: string;
  };
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    is_day: 0 | 1;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    /** Metres. */
    visibility: number;
    uv_index: number;
    /** Millimetres in the preceding 15 minutes. */
    precipitation: number;
  };
  /** Next 2 hours in 15-minute steps; each value covers the 15 minutes before its time. */
  minutely_15: {
    time: string[];
    /** Millimetres per step. */
    precipitation: number[];
  };
  /** Every hour of the 7 forecast days, from midnight today. */
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    is_day: (0 | 1)[];
    precipitation_probability: (number | null)[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    /** Millimetres. */
    precipitation_sum: number[];
    wind_speed_10m_max: number[];
    uv_index_max: number[];
    sunrise: string[];
    sunset: string[];
  };
}

/** Current conditions only, as returned per place by a multi-location forecast request. */
export interface CurrentOnlyResponse {
  current_units: { temperature_2m: string };
  current: { temperature_2m: number; weather_code: number; is_day: 0 | 1 };
}

/** Yesterday's and today's highs (`past_days=1`, `forecast_days=1`). */
export interface YesterdayResponse {
  daily: { time: string[]; temperature_2m_max: number[] };
}

/** Subset of the Open-Meteo air-quality response we request. Pollutants in µg/m³. */
export interface AirQualityResponse {
  current: {
    us_aqi: number | null;
    pm2_5: number | null;
    pm10: number | null;
    ozone: number | null;
    nitrogen_dioxide: number | null;
  };
}

/** Same spot to about 100 m, so a saved place matches the one it was saved from. */
export function samePlace(a: Place | undefined, b: Place | undefined): boolean {
  return (
    !!a &&
    !!b &&
    Math.abs(a.latitude - b.latitude) < 0.001 &&
    Math.abs(a.longitude - b.longitude) < 0.001
  );
}

/**
 * Index of the current hour in Open-Meteo's `hourly.time` (local ISO strings), so lists can
 * start from "now". 0 if `now` is before the first entry.
 */
export function currentHourIndex(now: string, times: string[]): number {
  const hour = `${now.slice(0, 13)}:00`;
  return Math.max(
    0,
    times.findIndex((time) => time >= hour),
  );
}

/** Subset of RainViewer's `weather-maps.json`: radar frames, oldest first. */
export interface RainViewerMaps {
  host: string;
  radar: { past: { time: number; path: string }[] };
}

/** What to wear below each feels-like temperature (°C). */
const CLOTHING_BY_TEMPERATURE: [below: number, label: string][] = [
  [5, 'Warm coat'],
  [12, 'Jacket'],
  [18, 'Light sweater'],
  [25, 'T-shirt'],
];

export interface OutfitTip {
  /** Material Symbols icon name. */
  icon: string;
  label: string;
}

/**
 * Clothing and kit suggestions for the day. Always in metric: °C (feels-like), % rain chance,
 * UV index and km/h wind.
 */
export function outfitTips(conditions: {
  temperature: number;
  rainChance: number;
  uv: number;
  windKmh: number;
}): OutfitTip[] {
  const { temperature, rainChance, uv, windKmh } = conditions;
  const clothing =
    CLOTHING_BY_TEMPERATURE.find(([below]) => temperature < below)?.[1] ??
    'Light, breathable clothes';
  const tips: OutfitTip[] = [{ icon: 'checkroom', label: clothing }];
  if (rainChance >= 40) tips.push({ icon: 'umbrella', label: 'Umbrella' });
  if (uv >= 3) tips.push({ icon: 'sunny', label: uv >= 6 ? 'Sunscreen & hat' : 'Sunscreen' });
  if (windKmh >= 30) tips.push({ icon: 'air', label: 'Windbreaker' });
  return tips;
}

/** e.g. "3° warmer than yesterday". Differences under 1° count as the same. */
export function compareToYesterday(todayHigh: number, yesterdayHigh: number): string {
  const diff = Math.round(todayHigh - yesterdayHigh);
  if (diff === 0) {
    return 'About the same as yesterday';
  }
  return `${Math.abs(diff)}° ${diff > 0 ? 'warmer' : 'cooler'} than yesterday`;
}

/** Subset of a Photon (OpenStreetMap) search result. */
export interface PhotonFeature {
  /** [longitude, latitude]. */
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type: string;
    osm_id: number;
    name?: string;
    street?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

export interface PhotonResponse {
  features: PhotonFeature[];
}

export interface SearchResult {
  id: string;
  /** e.g. "SM Megamall". */
  name: string;
  /** Where it is, e.g. "Mandaluyong, Metro Manila, Philippines". */
  detail: string;
  latitude: number;
  longitude: number;
}

/** Flattens a Photon feature into a list entry; undefined for unnamed features. */
export function toSearchResult({
  geometry,
  properties: p,
}: PhotonFeature): SearchResult | undefined {
  if (!p.name) {
    return undefined;
  }
  const areas = [p.district, p.city, p.county, p.state].filter(
    (area, i, all): area is string =>
      !!area && area !== p.name && area !== p.country && all.indexOf(area) === i,
  );
  return {
    id: `${p.osm_type}${p.osm_id}`,
    name: p.name,
    detail: [...areas.slice(0, 2), p.country].filter(Boolean).join(', '),
    latitude: geometry.coordinates[1],
    longitude: geometry.coordinates[0],
  };
}

/** Colour family used to tint weather icons. */
export type WeatherTone = 'sun' | 'night' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm';

export interface WeatherCondition {
  label: string;
  /** Material Symbols icon name. */
  icon: string;
  tone: WeatherTone;
}

/** Maps a WMO weather code (as returned by Open-Meteo) to a label and icon. */
export function describeWeather(code: number, isDay: boolean): WeatherCondition {
  switch (code) {
    case 0:
      return {
        label: 'Clear sky',
        icon: isDay ? 'sunny' : 'clear_night',
        tone: isDay ? 'sun' : 'night',
      };
    case 1:
      return {
        label: 'Mainly clear',
        icon: isDay ? 'sunny' : 'clear_night',
        tone: isDay ? 'sun' : 'night',
      };
    case 2:
      return {
        label: 'Partly cloudy',
        icon: isDay ? 'partly_cloudy_day' : 'partly_cloudy_night',
        tone: isDay ? 'sun' : 'night',
      };
    case 3:
      return { label: 'Overcast', icon: 'cloud', tone: 'cloud' };
    case 45:
    case 48:
      return { label: 'Fog', icon: 'foggy', tone: 'fog' };
    case 51:
    case 53:
    case 55:
      return { label: 'Drizzle', icon: 'rainy_light', tone: 'rain' };
    case 56:
    case 57:
      return { label: 'Freezing drizzle', icon: 'rainy_light', tone: 'rain' };
    case 61:
    case 63:
    case 65:
      return { label: 'Rain', icon: 'rainy', tone: 'rain' };
    case 66:
    case 67:
      return { label: 'Freezing rain', icon: 'rainy', tone: 'rain' };
    case 71:
    case 73:
    case 75:
    case 77:
      return { label: 'Snow', icon: 'weather_snowy', tone: 'snow' };
    case 80:
    case 81:
    case 82:
      return { label: 'Rain showers', icon: 'rainy', tone: 'rain' };
    case 85:
    case 86:
      return { label: 'Snow showers', icon: 'weather_snowy', tone: 'snow' };
    case 95:
      return { label: 'Thunderstorm', icon: 'thunderstorm', tone: 'storm' };
    case 96:
    case 99:
      return { label: 'Thunderstorm with hail', icon: 'thunderstorm', tone: 'storm' };
    default:
      return { label: 'Unknown', icon: 'help', tone: 'cloud' };
  }
}

/** 16-point compass label for a bearing in degrees, e.g. 247 → "WSW". */
export function compassDirection(degrees: number): string {
  const points = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  return points[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}

export function describeHumidity(percent: number): string {
  if (percent < 30) return 'Dry';
  if (percent <= 60) return 'Normal';
  return 'Humid';
}

/** Visibility in kilometres. */
export function describeVisibility(km: number): string {
  if (km >= 10) return 'Clear';
  if (km >= 4) return 'Average';
  if (km >= 1) return 'Poor';
  return 'Very poor';
}

/** US AQI category names. */
export function describeAirQuality(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for some';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very unhealthy';
  return 'Hazardous';
}

export function describeUvIndex(uv: number): string {
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very high';
  return 'Extreme';
}

/** Rough position of the sun, used to theme the page background. */
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

/** How long either side of sunrise/sunset counts as dawn/dusk. */
const TWILIGHT_MS = 45 * 60 * 1000;

export function dayPhase(now: Date, sunrise: Date, sunset: Date): DayPhase {
  const t = now.getTime();
  if (Math.abs(t - sunrise.getTime()) <= TWILIGHT_MS) return 'dawn';
  if (Math.abs(t - sunset.getTime()) <= TWILIGHT_MS) return 'dusk';
  if (t > sunrise.getTime() && t < sunset.getTime()) return 'day';
  return 'night';
}

/** Less than this many millimetres in 15 minutes counts as dry. */
const WET_MM = 0.1;

/**
 * A short heads-up about rain starting or stopping within the next hour, e.g.
 * "Rain starting in about 30 min". Undefined when nothing changes.
 */
export function describeNextHourRain(
  now: string,
  currentPrecipitation: number,
  times: string[],
  amounts: number[],
): string | undefined {
  const start = parseLocalTime(now).getTime();
  // Each value covers the 15 minutes *before* its timestamp, so measure from the slot's start.
  const upcoming = times
    .map((time, i) => ({
      minutes: (parseLocalTime(time).getTime() - start) / 60_000 - 15,
      mm: amounts[i],
    }))
    .filter(({ minutes }) => minutes >= 0 && minutes < 60);
  if (!upcoming.length) {
    return undefined;
  }

  const rainingNow = currentPrecipitation >= WET_MM;
  const change = upcoming.find(({ mm }) => mm >= WET_MM !== rainingNow);
  if (!change) {
    return rainingNow ? 'Rain for the next hour' : undefined;
  }
  const when = change.minutes < 5 ? 'any minute now' : `in about ${Math.round(change.minutes)} min`;
  return `Rain ${rainingNow ? 'stopping' : 'starting'} ${when}`;
}

/**
 * Parses Open-Meteo's local ISO strings ("2026-09-30" or "2026-09-30T15:30") as
 * wall-clock time, so dates render in the place's own timezone rather than shifting.
 */
export function parseLocalTime(iso: string): Date {
  const [date, time = '00:00'] = iso.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}
