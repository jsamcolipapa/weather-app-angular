import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PreferencesService } from '../../../services/preferences.service';
import {
  AirQualityResponse,
  compassDirection,
  describeAirQuality,
  describeCloudCover,
  describeDayLength,
  describeDewPoint,
  describeHumidity,
  describePressure,
  describeUvIndex,
  describeVisibility,
  ForecastResponse,
  minutesBetween,
  moonPath,
  moonPhase,
  parseAbsoluteTime,
  parseLocalTime,
  YesterdayResponse,
} from '../../../models/weather.models';

/** The UV gauge's scale runs 0–12; these are its labelled ticks. */
const UV_MAX = 12;
const UV_TICKS = [0, 3, 6, 9, 12].map((value) => {
  const angle = Math.PI * (1 - value / UV_MAX);
  return { value, x: 60 + 66 * Math.cos(angle), y: 62 - 66 * Math.sin(angle) };
});

/** Upper bound for the air-quality meter; values above it pin to the top. */
const AQI_METER_MAX = 300;

/** Golden hour is roughly the first hour after sunrise and the last before sunset. */
const HOUR_MS = 3_600_000;

/** Radius of the moon drawing, in SVG units. */
const MOON_R = 20;

/**
 * "Today's Highlights" cards: UV, wind, sun, humidity, visibility, air quality, dew point,
 * pressure, cloud cover and the sky.
 */
@Component({
  selector: 'app-highlights',
  imports: [DatePipe, DecimalPipe, MatIconModule],
  templateUrl: './highlights.html',
  styleUrl: './highlights.scss',
})
export class Highlights {
  /** Undefined while loading. */
  readonly forecast = input<ForecastResponse>();
  /** For the day-length comparison; the card works without it. */
  readonly yesterday = input<YesterdayResponse>();
  readonly air = input<AirQualityResponse>();
  /** True once the air-quality request has finished, with or without data. */
  readonly airSettled = input(false);
  readonly windUnitLabel = input('km/h');

  readonly windUnitCycled = output<void>();

  protected readonly timeFormat = inject(PreferencesService).timeFormat;
  protected readonly uvTicks = UV_TICKS;
  protected readonly moonSize = MOON_R * 2;

  protected readonly highlights = computed(() => {
    const forecast = this.forecast();
    if (!forecast) {
      return undefined;
    }
    const { current, current_units, daily } = forecast;
    const dewPoint = current.dew_point_2m;
    const uv = Math.max(0, current.uv_index);
    const visibilityKm = current.visibility / 1000;
    return {
      uv: {
        value: uv,
        label: describeUvIndex(uv),
        percent: Math.min(uv / UV_MAX, 1) * 100,
      },
      wind: {
        speed: current.wind_speed_10m,
        direction: compassDirection(current.wind_direction_10m),
        gusts: current.wind_gusts_10m,
        // Wind direction is where it blows *from*; point the arrow where it's going.
        arrowRotation: current.wind_direction_10m + 180,
      },
      sunrise: parseLocalTime(daily.sunrise[0]),
      sunset: parseLocalTime(daily.sunset[0]),
      humidity: {
        value: current.relative_humidity_2m,
        label: describeHumidity(current.relative_humidity_2m),
      },
      visibility: { value: visibilityKm, label: describeVisibility(visibilityKm) },
      dewPoint: {
        value: dewPoint,
        // The comfort bands are in °C.
        label: describeDewPoint(
          current_units.temperature_2m === '°F' ? (dewPoint - 32) / 1.8 : dewPoint,
        ),
      },
      pressure: { value: current.pressure_msl, label: describePressure(current.pressure_msl) },
      cloud: { value: current.cloud_cover, label: describeCloudCover(current.cloud_cover) },
    };
  });

  /** Day length, golden hours and moon phase. */
  protected readonly sky = computed(() => {
    const forecast = this.forecast();
    if (!forecast) {
      return undefined;
    }
    const { current, daily } = forecast;
    const sunrise = parseLocalTime(daily.sunrise[0]);
    const sunset = parseLocalTime(daily.sunset[0]);
    const before = this.yesterday()?.daily;
    // Astronomy needs the absolute instant (place wall-clock minus utc_offset),
    // not the runner-local Date that parseLocalTime returns for display.
    const moon = moonPhase(parseAbsoluteTime(current.time, forecast.utc_offset_seconds ?? 0));
    return {
      dayLength: describeDayLength(
        minutesBetween(daily.sunrise[0], daily.sunset[0]),
        before ? minutesBetween(before.sunrise[0], before.sunset[0]) : undefined,
      ),
      goldenMorning: { start: sunrise, end: new Date(sunrise.getTime() + HOUR_MS) },
      goldenEvening: { start: new Date(sunset.getTime() - HOUR_MS), end: sunset },
      moon: { ...moon, path: moonPath(moon.cycle, MOON_R) },
    };
  });

  protected readonly airQuality = computed(() => {
    const current = this.air()?.current;
    if (current?.us_aqi == null) {
      return undefined;
    }
    const { us_aqi: aqi, pm2_5, pm10, ozone, nitrogen_dioxide } = current;
    return {
      value: aqi,
      label: describeAirQuality(aqi),
      percent: Math.min(aqi / AQI_METER_MAX, 1) * 100,
      pollutants: [
        { key: 'pm2_5', label: 'PM2.5', value: pm2_5 },
        { key: 'pm10', label: 'PM10', value: pm10 },
        { key: 'o3', label: 'O₃', value: ozone },
        { key: 'no2', label: 'NO₂', value: nitrogen_dioxide },
      ].filter((p) => p.value != null),
    };
  });
}
