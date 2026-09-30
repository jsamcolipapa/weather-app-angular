import { DatePipe, DecimalPipe, DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  compareToYesterday,
  compassDirection,
  currentHourIndex,
  dayPhase,
  describeAirQuality,
  describeHumidity,
  describeNextHourRain,
  describeUvIndex,
  describeVisibility,
  describeWeather,
  formatPlaceName,
  outfitTips,
  parseLocalTime,
  Place,
  samePlace,
  shareText,
  TemperatureUnit,
  WIND_UNIT_LABELS,
  WIND_UNITS,
  WindUnit,
} from '../../weather/weather.models';
import { ForecastView, PreferencesService } from '../../weather/preferences.service';
import { showNotification } from '../../weather/notify';
import { WeatherService } from '../../weather/weather.service';
import { DayDetails } from './day-details/day-details';
import { HourlyChart } from './hourly-chart/hourly-chart';
import { PlaceSearch } from './place-search/place-search';
import { RainMap } from './rain-map/rain-map';
import { SavedPlaces } from './saved-places/saved-places';
import { WeatherBackdrop } from './weather-backdrop/weather-backdrop';

/** The UV gauge's scale runs 0–12; these are its labelled ticks. */
const UV_MAX = 12;
const UV_TICKS = [0, 3, 6, 9, 12].map((value) => {
  const angle = Math.PI * (1 - value / UV_MAX);
  return { value, x: 60 + 66 * Math.cos(angle), y: 62 - 66 * Math.sin(angle) };
});

/** Upper bound for the air-quality meter; values above it pin to the top. */
const AQI_METER_MAX = 300;

/** Multiply a wind speed in Open-Meteo's `current_units` by this to get km/h. */
const KMH_PER_UNIT: Record<string, number> = { 'km/h': 1, 'mp/h': 1.609, 'm/s': 3.6 };

/** Refetch this often while the page is open… */
const REFRESH_MS = 15 * 60_000;
/** …and when the tab comes back into view after at least this long. */
const STALE_MS = 5 * 60_000;

@Component({
  selector: 'app-home',
  imports: [
    DatePipe,
    DecimalPipe,
    DayDetails,
    HourlyChart,
    MatButtonModule,
    MatIconModule,
    PlaceSearch,
    RainMap,
    SavedPlaces,
    WeatherBackdrop,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly weatherService = inject(WeatherService);
  private readonly preferences = inject(PreferencesService);
  private readonly document = inject(DOCUMENT);

  private readonly saved = this.preferences.prefs();
  protected readonly place = signal<Place | undefined>(this.saved.place);
  protected readonly unit = signal<TemperatureUnit>(this.saved.unit);
  protected readonly windUnit = signal<WindUnit>(this.saved.windUnit);
  protected readonly view = signal<ForecastView>(this.saved.view);

  protected readonly forecast = this.weatherService.forecast(this.place, this.unit, this.windUnit);
  protected readonly air = this.weatherService.airQuality(this.place);
  private readonly geocode = this.weatherService.reverseGeocode(this.place);
  private readonly yesterday = this.weatherService.yesterday(this.place);

  protected readonly uvTicks = UV_TICKS;
  protected readonly windUnitLabel = computed(() => WIND_UNIT_LABELS[this.windUnit()]);

  protected readonly notificationsSupported = typeof Notification !== 'undefined';
  protected readonly notifyRain = computed(() => this.preferences.prefs().notifyRain);
  /** Set once we've notified about the current "rain starting" spell, so we only do it once. */
  private rainNotified = false;

  /** True for a moment after the share text was copied to the clipboard. */
  protected readonly copied = signal(false);
  private lastRefresh = Date.now();

  /** Placeholder cards while the forecast loads: one per day, or one per 3 hours. */
  protected readonly skeletonSlots = computed(() =>
    Array.from({ length: this.view() === 'week' ? 7 : 8 }),
  );

  /** Device locations come without a name; `placeName` looks one up via reverse geocoding. */
  protected readonly isDeviceLocation = computed(() => !!this.place() && !this.place()?.name);

  protected readonly isFavourite = computed(() =>
    this.preferences.prefs().favourites.some((p) => samePlace(p, this.place())),
  );

  /** Week-view day whose details are open, by index into `week()`. Closes on a new place. */
  protected readonly selectedDay = linkedSignal<Place | undefined, number | undefined>({
    source: this.place,
    computation: () => undefined,
  });

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

  /** Current weather family, for the animated backdrop. */
  protected readonly tone = computed(() => this.current()?.condition.tone);

  /** e.g. "Rain starting in about 30 min"; undefined when the next hour looks unchanged. */
  protected readonly rainSoon = computed(() => {
    if (!this.forecast.hasValue()) {
      return undefined;
    }
    const { current, minutely_15 } = this.forecast.value();
    return describeNextHourRain(
      current.time,
      current.precipitation,
      minutely_15.time,
      minutely_15.precipitation,
    );
  });

  /** What to wear today; converts the forecast's units to the metric ones the tips use. */
  protected readonly wearTips = computed(() => {
    if (!this.forecast.hasValue()) {
      return undefined;
    }
    const { current, current_units, daily } = this.forecast.value();
    const feelsLike = current.apparent_temperature;
    return outfitTips({
      temperature: current_units.temperature_2m === '°F' ? (feelsLike - 32) / 1.8 : feelsLike,
      rainChance: daily.precipitation_probability_max[0] ?? 0,
      uv: daily.uv_index_max[0],
      windKmh: current.wind_speed_10m * (KMH_PER_UNIT[current_units.wind_speed_10m] ?? 1),
    });
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

  /** Every hour of the forecast; sliced into "next 24 h" and per-day lists below. */
  private readonly allHours = computed(() => {
    if (!this.forecast.hasValue()) {
      return [];
    }
    const { hourly } = this.forecast.value();
    return hourly.time.map((time, i) => ({
      key: time,
      label: parseLocalTime(time),
      condition: describeWeather(hourly.weather_code[i], hourly.is_day[i] === 1),
      temperature: hourly.temperature_2m[i],
      rainChance: hourly.precipitation_probability[i],
    }));
  });

  /** The next 24 hours, starting with the current one. */
  protected readonly next24Hours = computed(() => {
    if (!this.forecast.hasValue()) {
      return [];
    }
    const { current, hourly } = this.forecast.value();
    const start = currentHourIndex(current.time, hourly.time);
    return this.allHours().slice(start, start + 24);
  });

  /** The next 24 hours in 3-hour steps. */
  protected readonly hours = computed(() => this.next24Hours().filter((_, i) => i % 3 === 0));

  protected readonly dayDetails = computed(() => {
    const index = this.selectedDay();
    if (index === undefined || !this.forecast.hasValue()) {
      return undefined;
    }
    const { daily } = this.forecast.value();
    const date = daily.time[index];
    return {
      ...this.week()[index],
      rainChance: daily.precipitation_probability_max[index],
      rainTotal: daily.precipitation_sum[index],
      windMax: daily.wind_speed_10m_max[index],
      uvMax: daily.uv_index_max[index],
      sunrise: parseLocalTime(daily.sunrise[index]),
      sunset: parseLocalTime(daily.sunset[index]),
      hours: this.allHours()
        .filter((hour) => hour.key.startsWith(date))
        .filter((_, i) => i % 3 === 0),
    };
  });

  /** e.g. "3° warmer than yesterday", comparing daily highs. */
  protected readonly comparedToYesterday = computed(() => {
    const highs = this.yesterday.hasValue() ? this.yesterday.value().daily.temperature_2m_max : [];
    if (highs.length < 2) {
      return undefined;
    }
    // Highs come in °C; a difference in °F is just 1.8× bigger.
    const scale = this.unit() === 'fahrenheit' ? 1.8 : 1;
    return compareToYesterday(highs[1] * scale, highs[0] * scale);
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
    const { pm2_5, pm10, ozone, nitrogen_dioxide } = this.air.value()!.current;
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

  constructor() {
    // Remember settings. Device locations aren't saved, so they're looked up afresh next time.
    effect(() => {
      const place = this.place();
      this.preferences.update({
        unit: this.unit(),
        windUnit: this.windUnit(),
        view: this.view(),
        place: place?.name ? place : undefined,
      });
    });
    this.startAutoRefresh();

    // Notify about rain starting while the tab is in the background (auto-refresh keeps
    // `rainSoon` current). Once per spell: reset when the forecast no longer says it's starting.
    effect(() => {
      const message = this.rainSoon();
      if (!message?.startsWith('Rain starting')) {
        this.rainNotified = false;
        return;
      }
      if (this.rainNotified || !this.notifyRain() || this.document.visibilityState !== 'hidden') {
        return;
      }
      this.rainNotified = true;
      void showNotification(message, this.placeName());
    });
  }

  async ngOnInit() {
    if (!this.place()) {
      await this.useMyLocation();
    }
  }

  protected async useMyLocation() {
    this.place.set(await this.weatherService.locate());
  }

  protected async toggleRainAlerts() {
    if (this.notifyRain()) {
      this.preferences.update({ notifyRain: false });
      return;
    }
    const permission = await Notification.requestPermission();
    this.preferences.update({ notifyRain: permission === 'granted' });
  }

  protected toggleFavourite() {
    const place = this.place();
    if (!place) {
      return;
    }
    const { favourites } = this.preferences.prefs();
    this.preferences.update({
      favourites: this.isFavourite()
        ? favourites.filter((p) => !samePlace(p, place))
        : [...favourites, { ...place, name: this.placeName() }],
    });
  }

  protected toggleDay(index: number) {
    this.selectedDay.update((current) => (current === index ? undefined : index));
  }

  protected cycleWindUnit() {
    const next = (WIND_UNITS.indexOf(this.windUnit()) + 1) % WIND_UNITS.length;
    this.windUnit.set(WIND_UNITS[next]);
  }

  protected async share() {
    const now = this.current();
    if (!now) {
      return;
    }
    const text = shareText(this.placeName(), now.temperature, now.unit, now.condition.label);
    if (navigator.share) {
      // Rejects when the user closes the share sheet; nothing to do then.
      await navigator.share({ text }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(text);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  private refresh() {
    this.lastRefresh = Date.now();
    this.forecast.reload();
    this.air.reload();
  }

  /** Keeps the data (and with it the sky, backdrop and rain banner) current. */
  private startAutoRefresh() {
    const timer = setInterval(() => this.refresh(), REFRESH_MS);
    const onVisible = () => {
      if (this.document.visibilityState === 'visible' && Date.now() - this.lastRefresh > STALE_MS) {
        this.refresh();
      }
    };
    this.document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      this.document.removeEventListener('visibilitychange', onVisible);
    });
  }
}
