import { httpResource } from '@angular/common/http';
import { Injectable, Signal } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  AirQualityResponse,
  CurrentOnlyResponse,
  ForecastResponse,
  Place,
  PhotonResponse,
  ReverseGeocodeResponse,
  TemperatureUnit,
  WindUnit,
  YesterdayResponse,
} from '../models/weather.models';

// Endpoints come from `.env` via the generated environment file (see scripts/set-env.mjs).
export const FORECAST_URL = environment.forecastUrl;
export const AIR_QUALITY_URL = environment.airQualityUrl;
export const SEARCH_URL = environment.searchUrl;
export const REVERSE_GEOCODE_URL = environment.reverseGeocodeUrl;
export const RAINVIEWER_URL = environment.rainViewerUrl;
export const MAP_TILE_URL = environment.mapTileUrl;

/** OpenStreetMap features that clutter place search (bus stops, footpaths, platforms…). */
const SEARCH_EXCLUDED_TAGS = [
  '!public_transport',
  '!railway',
  '!building',
  '!highway:bus_stop',
  '!highway:footway',
  '!highway:steps',
  '!highway:platform',
  '!amenity:vending_machine',
];

/** Shown when the browser can't (or won't) share the user's location. */
export const DEFAULT_PLACE: Place = { name: 'New York', latitude: 40.7128, longitude: -74.006 };

@Injectable({ providedIn: 'root' })
export class WeatherService {
  /**
   * Current conditions, hourly and daily forecasts for the next 7 days for `place`, refetched
   * whenever `place`, `unit` or `windUnit` changes.
   * Must be called in an injection context (e.g. a component field initializer).
   */
  forecast(
    place: Signal<Place | undefined>,
    unit: Signal<TemperatureUnit>,
    windUnit: Signal<WindUnit>,
  ) {
    return httpResource<ForecastResponse>(() => {
      const p = place();
      if (!p) {
        return undefined;
      }
      return {
        url: FORECAST_URL,
        params: {
          latitude: p.latitude,
          longitude: p.longitude,
          current: [
            'temperature_2m',
            'apparent_temperature',
            'weather_code',
            'is_day',
            'relative_humidity_2m',
            'wind_speed_10m',
            'wind_direction_10m',
            'visibility',
            'uv_index',
            'precipitation',
          ].join(','),
          minutely_15: 'precipitation',
          forecast_minutely_15: 8,
          hourly: 'temperature_2m,weather_code,is_day,precipitation_probability',
          daily: [
            'weather_code',
            'temperature_2m_max',
            'temperature_2m_min',
            'precipitation_probability_max',
            'precipitation_sum',
            'wind_speed_10m_max',
            'uv_index_max',
            'sunrise',
            'sunset',
          ].join(','),
          forecast_days: 7,
          temperature_unit: unit(),
          wind_speed_unit: windUnit(),
          timezone: 'auto',
        },
      };
    });
  }

  /**
   * Yesterday's and today's highs for `place`, always in °C so a unit switch doesn't refetch
   * (the difference converts on its own).
   */
  yesterday(place: Signal<Place | undefined>) {
    return httpResource<YesterdayResponse>(() => {
      const p = place();
      if (!p) {
        return undefined;
      }
      return {
        url: FORECAST_URL,
        params: {
          latitude: p.latitude,
          longitude: p.longitude,
          daily: 'temperature_2m_max',
          past_days: 1,
          forecast_days: 1,
          timezone: 'auto',
        },
      };
    });
  }

  /**
   * Current temperature and conditions for several places in one request. Open-Meteo answers
   * with an array for 2+ places and a single object for one; the value is always an array here.
   */
  currentFor(places: Signal<Place[]>, unit: Signal<TemperatureUnit>) {
    return httpResource<CurrentOnlyResponse[]>(
      () => {
        const list = places();
        if (!list.length) {
          return undefined;
        }
        return {
          url: FORECAST_URL,
          params: {
            latitude: list.map((p) => p.latitude).join(','),
            longitude: list.map((p) => p.longitude).join(','),
            current: 'temperature_2m,weather_code,is_day',
            temperature_unit: unit(),
            timezone: 'auto',
          },
        };
      },
      { parse: (body) => (Array.isArray(body) ? body : [body]) as CurrentOnlyResponse[] },
    );
  }

  /** Current US AQI and main pollutants for `place`. */
  airQuality(place: Signal<Place | undefined>) {
    return httpResource<AirQualityResponse>(() => {
      const p = place();
      if (!p) {
        return undefined;
      }
      return {
        url: AIR_QUALITY_URL,
        params: {
          latitude: p.latitude,
          longitude: p.longitude,
          current: 'us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide',
        },
      };
    });
  }

  /**
   * Places, landmarks and streets matching `query`, ranked towards `near` when given.
   * Idle until the query is at least 2 characters.
   */
  search(query: Signal<string>, near: Signal<Place | undefined>) {
    return httpResource<PhotonResponse>(() => {
      const q = query().trim();
      if (q.length < 2) {
        return undefined;
      }
      const bias = near();
      return {
        url: SEARCH_URL,
        params: {
          q,
          limit: 10,
          lang: 'en',
          osm_tag: SEARCH_EXCLUDED_TAGS,
          ...(bias && { lat: bias.latitude, lon: bias.longitude }),
        },
      };
    });
  }

  /** Looks up a readable name for `place`; only requests when the place has no name yet. */
  reverseGeocode(place: Signal<Place | undefined>) {
    return httpResource<ReverseGeocodeResponse>(() => {
      const p = place();
      if (!p || p.name) {
        return undefined;
      }
      return {
        url: REVERSE_GEOCODE_URL,
        params: { latitude: p.latitude, longitude: p.longitude, localityLanguage: 'en' },
      };
    });
  }

  /** Resolves to the device's location, or `DEFAULT_PLACE` if it's unavailable. */
  locate(): Promise<Place> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(DEFAULT_PLACE);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
        () => resolve(DEFAULT_PLACE),
        { timeout: 10_000, maximumAge: 10 * 60_000 },
      );
    });
  }
}
