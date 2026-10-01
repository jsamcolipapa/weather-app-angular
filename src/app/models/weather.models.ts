export type TemperatureUnit = 'celsius' | 'fahrenheit';

/** Open-Meteo `wind_speed_unit` values, in the order the unit button cycles through. */
export const WIND_UNITS = ['kmh', 'mph', 'ms'] as const;
export type WindUnit = (typeof WIND_UNITS)[number];
export const WIND_UNIT_LABELS: Record<WindUnit, string> = { kmh: 'km/h', mph: 'mph', ms: 'm/s' };

export type PrecipUnit = 'mm' | 'inch';

/** A rain amount in the chosen unit, e.g. "4.2 mm" or "0.17 in". Forecasts always come in mm. */
export function formatPrecipitation(mm: number, unit: PrecipUnit): string {
  return unit === 'inch' ? `${Number((mm / 25.4).toFixed(2))} in` : `${Number(mm.toFixed(1))} mm`;
}

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

/** Query params that reopen `place`, e.g. `lat=14.676&lon=121.0437&name=Quezon+City`. */
export function placeToParams(place: Place, name = place.name): URLSearchParams {
  // 4 decimals is about 10 m, plenty for a forecast.
  const params = new URLSearchParams({
    lat: String(Number(place.latitude.toFixed(4))),
    lon: String(Number(place.longitude.toFixed(4))),
  });
  if (name) {
    params.set('name', name);
  }
  return params;
}

/** The place a shared link points at; undefined when its params are missing or invalid. */
export function placeFromParams(params: URLSearchParams): Place | undefined {
  const lat = params.get('lat')?.trim();
  const lon = params.get('lon')?.trim();
  if (!lat || !lon) {
    return undefined;
  }
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return undefined;
  }
  const name = params.get('name')?.trim();
  return { ...(name && { name }), latitude, longitude };
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
    /** Same unit as `wind_speed_10m`. */
    wind_gusts_10m: number;
    /** Same unit as `temperature_2m`. */
    dew_point_2m: number;
    /** Sea-level pressure in hPa. */
    pressure_msl: number;
    /** Percent of the sky covered. */
    cloud_cover: number;
  };
  /** Next 2 hours in 15-minute steps; each value covers the 15 minutes before its time. */
  minutely_15: {
    time: string[];
    /** Millimetres per step. */
    precipitation: number[];
  };
  /** Every hour of the forecast days, from midnight today. */
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    weather_code: number[];
    is_day: (0 | 1)[];
    precipitation_probability: (number | null)[];
    uv_index: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
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
    wind_gusts_10m_max: number[];
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

/** Yesterday's and today's highs and sun times (`past_days=1`, `forecast_days=1`). */
export interface YesterdayResponse {
  daily: { time: string[]; temperature_2m_max: number[]; sunrise: string[]; sunset: string[] };
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

/** One hour of conditions in metric units, for `bestOutdoorWindow`. */
export interface HourConditions {
  /** Local ISO time, e.g. "2026-09-30T16:00". */
  time: string;
  /** °C. */
  temperature: number;
  /** Percent. */
  rainChance: number;
  uv: number;
  windKmh: number;
  isDay: boolean;
}

/** How unpleasant an hour is outside; 0 is ideal. */
function outdoorPenalty(hour: HourConditions): number {
  const tooCold = Math.max(0, 18 - hour.temperature);
  const tooHot = Math.max(0, hour.temperature - 25);
  return (
    (tooCold + tooHot) * 2 +
    hour.rainChance / 10 +
    Math.max(0, hour.uv - 5) * 2 +
    Math.max(0, hour.windKmh - 20) / 5
  );
}

/**
 * The most pleasant `length`-hour daylight window left today (from the current hour), for a
 * walk or run. Undefined when fewer than `length` daylight hours remain.
 */
export function bestOutdoorWindow(
  hours: HourConditions[],
  now: string,
  length = 2,
): { start: Date; end: Date } | undefined {
  const from = currentHourIndex(
    now,
    hours.map((h) => h.time),
  );
  const today = now.slice(0, 10);
  const candidates = hours.slice(from).filter((h) => h.time.startsWith(today));
  let best: { index: number; penalty: number } | undefined;
  for (let i = 0; i + length <= candidates.length; i++) {
    const window = candidates.slice(i, i + length);
    if (!window.every((h) => h.isDay)) {
      continue;
    }
    const penalty = window.reduce((sum, h) => sum + outdoorPenalty(h), 0);
    if (!best || penalty < best.penalty) {
      best = { index: i, penalty };
    }
  }
  if (!best) {
    return undefined;
  }
  const start = parseLocalTime(candidates[best.index].time);
  return { start, end: new Date(start.getTime() + length * 3_600_000) };
}

/** Minutes between two local ISO times, e.g. sunrise and sunset. */
export function minutesBetween(from: string, to: string): number {
  return Math.round((parseLocalTime(to).getTime() - parseLocalTime(from).getTime()) / 60_000);
}

/** e.g. "11h 42m · 1 min longer than yesterday". */
export function describeDayLength(minutes: number, yesterdayMinutes?: number): string {
  const length = `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  if (yesterdayMinutes === undefined) {
    return length;
  }
  const diff = minutes - yesterdayMinutes;
  const change =
    diff === 0
      ? 'same as yesterday'
      : `${Math.abs(diff)} min ${diff > 0 ? 'longer' : 'shorter'} than yesterday`;
  return `${length} · ${change}`;
}

/** A new moon to count from, and the average length of a lunar cycle. */
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_DAYS = 29.530588853;

const MOON_PHASES: [before: number, name: string][] = [
  [0.03, 'New moon'],
  [0.22, 'Waxing crescent'],
  [0.28, 'First quarter'],
  [0.47, 'Waxing gibbous'],
  [0.53, 'Full moon'],
  [0.72, 'Waning gibbous'],
  [0.78, 'Last quarter'],
  [0.97, 'Waning crescent'],
];

/**
 * Moon phase for `date`. `cycle` runs 0 → 1 from new moon through full (0.5) and back;
 * `illumination` is the lit fraction of the disc. Accurate to within about a day.
 */
export function moonPhase(date: Date): { cycle: number; illumination: number; name: string } {
  const days = (date.getTime() - KNOWN_NEW_MOON) / 86_400_000;
  const cycle = (((days / SYNODIC_DAYS) % 1) + 1) % 1;
  return {
    cycle,
    illumination: (1 - Math.cos(2 * Math.PI * cycle)) / 2,
    name: MOON_PHASES.find(([before]) => cycle < before)?.[1] ?? 'New moon',
  };
}

/**
 * SVG path for the lit part of a moon of `radius` at `cycle` (0 new → 0.5 full → 1 new), in a
 * box twice the radius wide: the outer edge on the lit side, then back along the terminator, an
 * ellipse that narrows towards the quarters.
 */
export function moonPath(cycle: number, radius: number): string {
  const r = radius;
  const waxing = cycle < 0.5;
  const rx = Math.abs(Math.cos(2 * Math.PI * cycle)) * r;
  const outerSweep = waxing ? 1 : 0;
  // Crescents bulge towards the lit edge, gibbous moons away from it.
  const terminatorSweep = waxing ? Number(cycle >= 0.25) : Number(cycle > 0.75);
  return `M ${r} 0 A ${r} ${r} 0 0 ${outerSweep} ${r} ${2 * r} A ${rx} ${r} 0 0 ${terminatorSweep} ${r} 0 Z`;
}

/** Forecasts refresh every 15 minutes, so anything older than this is out of date. */
const STALE_DATA_MS = 45 * 60_000;

/**
 * A note for when the forecast on screen isn't live, e.g. "Updated 2 h ago" or
 * "Offline · updated 3 days ago". Undefined while it's fresh and the device is online.
 */
export function describeDataAge(ageMs: number, online: boolean): string | undefined {
  if (ageMs < STALE_DATA_MS) {
    return online ? undefined : 'Offline';
  }
  const minutes = Math.floor(ageMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const ago = hours < 1 ? `${minutes} min ago` : days < 2 ? `${hours} h ago` : `${days} days ago`;
  return online ? `Updated ${ago}` : `Offline · updated ${ago}`;
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

/** How the air feels at a dew point in °C; a better guide to mugginess than humidity. */
export function describeDewPoint(celsius: number): string {
  if (celsius < 10) return 'Dry';
  if (celsius < 16) return 'Comfortable';
  if (celsius < 21) return 'Sticky';
  return 'Muggy';
}

/** Sea-level pressure in hPa. */
export function describePressure(hPa: number): string {
  if (hPa < 1000) return 'Low';
  if (hPa <= 1020) return 'Normal';
  return 'High';
}

/** Cloud cover in percent. */
export function describeCloudCover(percent: number): string {
  if (percent < 20) return 'Clear';
  if (percent < 50) return 'Partly cloudy';
  if (percent < 88) return 'Mostly cloudy';
  return 'Overcast';
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

/** What the app can warn about; `rain` is the within-the-hour heads-up, the rest look a day ahead. */
export const ALERT_IDS = ['rain', 'uv', 'wind', 'frost', 'heat', 'air'] as const;
export type AlertId = (typeof ALERT_IDS)[number];
export const ALERT_LABELS: Record<AlertId, string> = {
  rain: 'Rain starting',
  uv: 'Very high UV',
  wind: 'Strong gusts',
  frost: 'Frost',
  heat: 'Extreme heat',
  air: 'Unhealthy air',
};

export interface WeatherAlert {
  id: AlertId;
  /** Material Symbols icon name. */
  icon: string;
  tone: WeatherTone;
  message: string;
}

/** One upcoming hour in metric units, for `weatherAlerts`. */
export interface AlertHour {
  /** °C. */
  temperature: number;
  /** °C. */
  feelsLike: number;
  uv: number;
  gustKmh: number;
}

// Levels at which conditions are worth a warning.
const ALERT_UV = 8;
const ALERT_GUST_KMH = 60;
const ALERT_FROST_C = 0;
const ALERT_HEAT_C = 35;
const ALERT_AQI = 151;

/**
 * Warnings about the hours ahead (normally the next 24) and the current air quality. Messages
 * leave out temperatures and speeds so they read the same whatever units are chosen.
 */
export function weatherAlerts(hours: AlertHour[], aqi?: number | null): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  if (hours.length) {
    const uv = Math.max(...hours.map((h) => h.uv));
    if (uv >= ALERT_UV) {
      alerts.push({
        id: 'uv',
        icon: 'sunny',
        tone: 'sun',
        message: `${describeUvIndex(uv)} UV ahead, up to ${Math.round(uv)}`,
      });
    }
    if (Math.max(...hours.map((h) => h.gustKmh)) >= ALERT_GUST_KMH) {
      alerts.push({
        id: 'wind',
        icon: 'air',
        tone: 'cloud',
        message: 'Strong wind gusts in the next 24 hours',
      });
    }
    if (Math.min(...hours.map((h) => h.temperature)) <= ALERT_FROST_C) {
      alerts.push({
        id: 'frost',
        icon: 'ac_unit',
        tone: 'snow',
        message: 'Frost in the next 24 hours',
      });
    }
    if (Math.max(...hours.map((h) => h.feelsLike)) >= ALERT_HEAT_C) {
      alerts.push({
        id: 'heat',
        icon: 'thermostat',
        tone: 'sun',
        message: 'Extreme heat in the next 24 hours',
      });
    }
  }
  if (aqi != null && aqi >= ALERT_AQI) {
    alerts.push({
      id: 'air',
      icon: 'masks',
      tone: 'storm',
      message: `${describeAirQuality(aqi)} air right now (AQI ${Math.round(aqi)})`,
    });
  }
  return alerts;
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

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far the sun is through the daylight, or (when `phase` is night) the moon through the
 * night: 0 as it rises, 0.5 at its highest, 1 as it sets. `sunrise` and `sunset` are today's;
 * the night is taken to be the rest of the 24 hours.
 */
export function skyProgress(now: Date, sunrise: Date, sunset: Date, phase: DayPhase): number {
  const t = now.getTime();
  const daylight = sunset.getTime() - sunrise.getTime();
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  if (phase !== 'night') {
    return clamp((t - sunrise.getTime()) / daylight);
  }
  const night = DAY_MS - daylight;
  // After sunset count up from it; before sunrise count back from the end of the night.
  return clamp(
    t >= sunset.getTime() ? (t - sunset.getTime()) / night : 1 - (sunrise.getTime() - t) / night,
  );
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

/**
 * Parses an Open-Meteo local ISO time into its absolute instant, using the
 * response's `utc_offset_seconds`. Unlike `parseLocalTime` (which is for display
 * and intentionally runner-local), this is timezone-independent — same `getTime()`
 * whatever `TZ` the browser/CI runs in — so astronomy like `moonPhase` is stable.
 */
export function parseAbsoluteTime(iso: string, utcOffsetSeconds = 0): Date {
  const [date, time = '00:00'] = iso.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min) - utcOffsetSeconds * 1000);
}
