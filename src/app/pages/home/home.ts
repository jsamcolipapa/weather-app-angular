import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  compassDirection,
  dayPhase,
  describeAirQuality,
  describeHumidity,
  describeUvIndex,
  describeVisibility,
  describeWeather,
  formatPlaceName,
  parseLocalTime,
  Place,
  TemperatureUnit,
} from '../../weather/weather.models';
import { WeatherService } from '../../weather/weather.service';
import { PlaceSearch } from './place-search/place-search';

type ForecastView = 'today' | 'week';

/** The UV gauge's scale runs 0–12; these are its labelled ticks. */
const UV_MAX = 12;
const UV_TICKS = [0, 3, 6, 9, 12].map((value) => {
  const angle = Math.PI * (1 - value / UV_MAX);
  return { value, x: 60 + 66 * Math.cos(angle), y: 62 - 66 * Math.sin(angle) };
});

/** Upper bound for the air-quality meter; values above it pin to the top. */
const AQI_METER_MAX = 300;

@Component({
  selector: 'app-home',
  imports: [DatePipe, DecimalPipe, MatButtonModule, MatIconModule, PlaceSearch],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly weatherService = inject(WeatherService);

  protected readonly place = signal<Place | undefined>(undefined);
  protected readonly unit = signal<TemperatureUnit>('celsius');
  protected readonly view = signal<ForecastView>('week');

  protected readonly forecast = this.weatherService.forecast(this.place, this.unit);
  protected readonly air = this.weatherService.airQuality(this.place);
  private readonly geocode = this.weatherService.reverseGeocode(this.place);

  protected readonly uvTicks = UV_TICKS;

  /** Placeholder cards while the forecast loads: one per day, or one per 3 hours. */
  protected readonly skeletonSlots = computed(() =>
    Array.from({ length: this.view() === 'week' ? 7 : 8 }),
  );

  /** Device locations come without a name; `placeName` looks one up via reverse geocoding. */
  protected readonly isDeviceLocation = computed(() => !!this.place() && !this.place()?.name);

  protected readonly placeName = computed(() => {
    const name = this.place()?.name;
    if (name) {
      return name;
    }
    const geocoded = this.geocode.hasValue() ? formatPlaceName(this.geocode.value()) : '';
    return geocoded || 'Your location';
  });

  protected readonly current = computed(() => {
    if (!this.forecast.hasValue()) {
      return undefined;
    }
    const { current, current_units, daily } = this.forecast.value();
    return {
      temperature: current.temperature_2m,
      unit: current_units.temperature_2m,
      feelsLike: current.apparent_temperature,
      time: parseLocalTime(current.time),
      condition: describeWeather(current.weather_code, current.is_day === 1),
      rainChance: daily.precipitation_probability_max[0],
    };
  });

  /** Dawn/day/dusk/night at the place, for the page background. Undefined while loading. */
  protected readonly phase = computed(() => {
    if (!this.forecast.hasValue()) {
      return undefined;
    }
    const { current, daily } = this.forecast.value();
    return dayPhase(
      parseLocalTime(current.time),
      parseLocalTime(daily.sunrise[0]),
      parseLocalTime(daily.sunset[0]),
    );
  });

  protected readonly week = computed(() => {
    if (!this.forecast.hasValue()) {
      return [];
    }
    const { daily } = this.forecast.value();
    return daily.time.map((time, i) => ({
      key: time,
      label: parseLocalTime(time),
      condition: describeWeather(daily.weather_code[i], true),
      high: daily.temperature_2m_max[i],
      low: daily.temperature_2m_min[i],
    }));
  });

  /** The next 24 hours in 3-hour steps. */
  protected readonly hours = computed(() => {
    if (!this.forecast.hasValue()) {
      return [];
    }
    const { hourly } = this.forecast.value();
    return hourly.time
      .map((time, i) => ({
        key: time,
        label: parseLocalTime(time),
        condition: describeWeather(hourly.weather_code[i], hourly.is_day[i] === 1),
        temperature: hourly.temperature_2m[i],
      }))
      .filter((_, i) => i % 3 === 0);
  });

  protected readonly highlights = computed(() => {
    if (!this.forecast.hasValue()) {
      return undefined;
    }
    const { current, daily } = this.forecast.value();
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
    };
  });

  protected readonly airQuality = computed(() => {
    const aqi = this.air.hasValue() ? this.air.value().current.us_aqi : null;
    if (aqi == null) {
      return undefined;
    }
    return {
      value: aqi,
      label: describeAirQuality(aqi),
      percent: Math.min(aqi / AQI_METER_MAX, 1) * 100,
    };
  });

  async ngOnInit() {
    await this.useMyLocation();
  }

  protected async useMyLocation() {
    this.place.set(await this.weatherService.locate());
  }
}
