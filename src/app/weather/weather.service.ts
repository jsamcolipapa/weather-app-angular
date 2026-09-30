import { httpResource } from '@angular/common/http';
import { Injectable, Signal } from '@angular/core';
import {
  AirQualityResponse,
  ForecastResponse,
  Place,
  PhotonResponse,
  ReverseGeocodeResponse,
  TemperatureUnit,
} from './weather.models';

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
export const SEARCH_URL = 'https://photon.komoot.io/api/';
export const REVERSE_GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

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
   * Current conditions, the next 24 hours and the next 7 days for `place`, refetched
   * whenever `place` or `unit` changes.
   * Must be called in an injection context (e.g. a component field initializer).
   */
  forecast(place: Signal<Place | undefined>, unit: Signal<TemperatureUnit>) {
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
          ].join(','),
          hourly: 'temperature_2m,weather_code,is_day',
          forecast_hours: 24,
          daily: [
            'weather_code',
            'temperature_2m_max',
            'temperature_2m_min',
            'precipitation_probability_max',
            'sunrise',
            'sunset',
          ].join(','),
          forecast_days: 7,
          temperature_unit: unit(),
          wind_speed_unit: 'kmh',
          timezone: 'auto',
        },
      };
    });
  }

  /** Current US AQI for `place`. */
  airQuality(place: Signal<Place | undefined>) {
    return httpResource<AirQualityResponse>(() => {
      const p = place();
      if (!p) {
        return undefined;
      }
      return {
        url: AIR_QUALITY_URL,
        params: { latitude: p.latitude, longitude: p.longitude, current: 'us_aqi' },
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
