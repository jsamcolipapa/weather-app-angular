import { DOCUMENT } from '@angular/common';
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
import { MatIconModule } from '@angular/material/icon';
import {
  bestOutdoorWindow,
  compareToYesterday,
  currentHourIndex,
  dayPhase,
  describeNextHourRain,
  describeWeather,
  formatPlaceName,
  outfitTips,
  parseLocalTime,
  Place,
  TemperatureUnit,
  WIND_UNIT_LABELS,
  WIND_UNITS,
  WindUnit,
} from '../../models/weather.models';
import { ForecastView, PreferencesService } from '../../services/preferences.service';
import { showNotification } from '../../services/notify';
import { WeatherService } from '../../services/weather.service';
import { CurrentConditions, CurrentWeather } from './current-conditions/current-conditions';
import { DayDetails } from './day-details/day-details';
import { ForecastStrip } from './forecast-strip/forecast-strip';
import { Highlights } from './highlights/highlights';
import { HourlyChart } from './hourly-chart/hourly-chart';
import { PlaceSearch } from './place-search/place-search';
import { RainMap } from './rain-map/rain-map';
import { SavedPlaces } from './saved-places/saved-places';
import { WeatherBackdrop } from './weather-backdrop/weather-backdrop';

/** Multiply a wind speed in Open-Meteo's `current_units` by this to get km/h. */
const KMH_PER_UNIT: Record<string, number> = { 'km/h': 1, 'mp/h': 1.609, 'm/s': 3.6 };

/** Refetch this often while the page is open… */
const REFRESH_MS = 15 * 60_000;
/** …and when the tab comes back into view after at least this long. */
const STALE_MS = 5 * 60_000;

@Component({
  selector: 'app-home',
  imports: [
    CurrentConditions,
    DayDetails,
    ForecastStrip,
    Highlights,
    HourlyChart,
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
  protected readonly yesterday = this.weatherService.yesterday(this.place);

  protected readonly windUnitLabel = computed(() => WIND_UNIT_LABELS[this.windUnit()]);

  protected readonly notificationsSupported = typeof Notification !== 'undefined';
  protected readonly notifyRain = computed(() => this.preferences.prefs().notifyRain);
  /** Set once we've notified about the current "rain starting" spell, so we only do it once. */
  private rainNotified = false;

  private lastRefresh = Date.now();

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

  protected readonly current = computed((): CurrentWeather | undefined => {
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

  /** Most pleasant 2-hour daylight window left today, for a walk or run. */
  protected readonly bestTime = computed(() => {
    if (!this.forecast.hasValue()) {
      return undefined;
    }
    const { current, current_units, hourly } = this.forecast.value();
    const toCelsius = (t: number) => (current_units.temperature_2m === '°F' ? (t - 32) / 1.8 : t);
    const toKmh = KMH_PER_UNIT[current_units.wind_speed_10m] ?? 1;
    return bestOutdoorWindow(
      hourly.time.map((time, i) => ({
        time,
        temperature: toCelsius(hourly.temperature_2m[i]),
        rainChance: hourly.precipitation_probability[i] ?? 0,
        uv: hourly.uv_index[i],
        windKmh: hourly.wind_speed_10m[i] * toKmh,
        isDay: hourly.is_day[i] === 1,
      })),
      current.time,
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

  protected toggleDay(index: number) {
    this.selectedDay.update((current) => (current === index ? undefined : index));
  }

  protected cycleWindUnit() {
    const next = (WIND_UNITS.indexOf(this.windUnit()) + 1) % WIND_UNITS.length;
    this.windUnit.set(WIND_UNITS[next]);
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
