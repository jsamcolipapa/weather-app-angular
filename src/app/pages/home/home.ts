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
  AlertId,
  bestOutdoorWindow,
  compareToYesterday,
  currentHourIndex,
  dayPhase,
  describeDataAge,
  describeNextHourRain,
  describeWeather,
  formatPlaceName,
  moonPhase,
  outfitTips,
  parseAbsoluteTime,
  parseLocalTime,
  Place,
  placeFromParams,
  placeToParams,
  skyProgress,
  TemperatureUnit,
  WeatherAlert,
  weatherAlerts,
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
import { SettingsMenu } from './settings-menu/settings-menu';
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
    SettingsMenu,
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
  /** A place in the URL (a shared link) wins over the last searched one. */
  protected readonly place = signal<Place | undefined>(
    placeFromParams(new URLSearchParams(this.document.location.search)) ?? this.saved.place,
  );
  protected readonly unit = signal<TemperatureUnit>(this.saved.unit);
  protected readonly windUnit = signal<WindUnit>(this.saved.windUnit);
  protected readonly view = signal<ForecastView>(this.saved.view);

  protected readonly forecast = this.weatherService.forecast(this.place, this.unit, this.windUnit);
  protected readonly air = this.weatherService.airQuality(this.place);
  private readonly geocode = this.weatherService.reverseGeocode(this.place);
  protected readonly yesterday = this.weatherService.yesterday(this.place);

  protected readonly windUnitLabel = computed(() => WIND_UNIT_LABELS[this.windUnit()]);

  protected readonly notificationsSupported = typeof Notification !== 'undefined';
  protected readonly notify = computed(() => this.preferences.prefs().notify);
  /** Alerts already notified about, so each spell notifies once; forgotten when it ends. */
  private readonly notified = new Set<AlertId>();

  private lastRefresh = Date.now();
  /** Bumped on every refresh and when the tab comes back, so `dataAge` is measured again. */
  private readonly tick = signal(0);
  private readonly online = signal(navigator.onLine);

  /**
   * e.g. "Offline · updated 2 h ago" when the forecast on screen is an old or cached copy.
   * Measured from the forecast's own timestamp, so it holds for the offline copy too.
   */
  protected readonly dataAge = computed(() => {
    this.tick();
    if (!this.forecast.hasValue()) {
      return undefined;
    }
    const { current, utc_offset_seconds } = this.forecast.value();
    const measured = parseAbsoluteTime(current.time, utc_offset_seconds ?? 0).getTime();
    return describeDataAge(Date.now() - measured, this.online());
  });

  /** Day whose details are open, by index into `days()`. Closes on a new place. */
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

  /** Where the sun or moon is, the moon's phase and the cloud cover, for the backdrop's sky. */
  protected readonly sky = computed(() => {
    const phase = this.phase();
    if (!phase || !this.forecast.hasValue()) {
      return undefined;
    }
    const { current, daily, utc_offset_seconds } = this.forecast.value();
    return {
      progress: skyProgress(
        parseLocalTime(current.time),
        parseLocalTime(daily.sunrise[0]),
        parseLocalTime(daily.sunset[0]),
        phase,
      ),
      cloudCover: current.cloud_cover,
      moonCycle: moonPhase(parseAbsoluteTime(current.time, utc_offset_seconds ?? 0)).cycle,
    };
  });

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

  /** Banners above the forecast: rain within the hour, then warnings for the next 24 hours. */
  protected readonly alerts = computed((): WeatherAlert[] => {
    if (!this.forecast.hasValue()) {
      return [];
    }
    const { current, current_units, hourly } = this.forecast.value();
    const toCelsius = (t: number) => (current_units.temperature_2m === '°F' ? (t - 32) / 1.8 : t);
    const toKmh = KMH_PER_UNIT[current_units.wind_speed_10m] ?? 1;
    const start = currentHourIndex(current.time, hourly.time);
    const ahead = hourly.time.slice(start, start + 24).map((_, n) => ({
      temperature: toCelsius(hourly.temperature_2m[start + n]),
      feelsLike: toCelsius(hourly.apparent_temperature[start + n]),
      uv: hourly.uv_index[start + n],
      gustKmh: hourly.wind_gusts_10m[start + n] * toKmh,
    }));
    const rain = this.rainSoon();
    return [
      ...(rain ? [{ id: 'rain', icon: 'umbrella', tone: 'rain', message: rain } as const] : []),
      ...weatherAlerts(ahead, this.air.hasValue() ? this.air.value().current.us_aqi : undefined),
    ];
  });

  /** Every forecast day, today first. */
  private readonly allDays = computed(() => {
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

  /** The days on the open tab: 7 for Week, all of them for 14 days. */
  protected readonly days = computed(() =>
    this.view() === 'fortnight' ? this.allDays() : this.allDays().slice(0, 7),
  );

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
      wind: hourly.wind_speed_10m[i],
      uv: hourly.uv_index[i],
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
    // A day picked on the 14-day tab may not be on the Week tab.
    const day = index === undefined ? undefined : this.days()[index];
    if (index === undefined || !day || !this.forecast.hasValue()) {
      return undefined;
    }
    const { daily } = this.forecast.value();
    const date = daily.time[index];
    return {
      ...day,
      rainChance: daily.precipitation_probability_max[index],
      rainTotal: daily.precipitation_sum[index],
      windMax: daily.wind_speed_10m_max[index],
      gustMax: daily.wind_gusts_10m_max[index],
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
      const named = place?.name ? place : undefined;
      this.preferences.update({
        unit: this.unit(),
        windUnit: this.windUnit(),
        view: this.view(),
        place: named,
      });
      this.syncUrl(named);
    });
    this.startAutoRefresh();

    // Notify about new alerts while the tab is in the background (auto-refresh keeps them
    // current). Once per spell: an alert can notify again after the forecast drops it.
    effect(() => {
      // The rain banner also says when rain stops or carries on; only its start is news.
      const active = this.alerts().filter(
        (alert) => alert.id !== 'rain' || alert.message.startsWith('Rain starting'),
      );
      const { notify, alerts: wanted } = this.preferences.prefs();
      for (const id of this.notified) {
        if (!active.some((alert) => alert.id === id)) {
          this.notified.delete(id);
        }
      }
      if (!notify || this.document.visibilityState !== 'hidden') {
        return;
      }
      for (const alert of active) {
        if (wanted[alert.id] && !this.notified.has(alert.id)) {
          this.notified.add(alert.id);
          void showNotification(alert.message, this.placeName(), alert.id);
        }
      }
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

  protected async toggleNotifications() {
    if (this.notify()) {
      this.preferences.update({ notify: false });
      return;
    }
    const permission = await Notification.requestPermission();
    this.preferences.update({ notify: permission === 'granted' });
  }

  protected toggleDay(index: number) {
    this.selectedDay.update((current) => (current === index ? undefined : index));
  }

  protected cycleWindUnit() {
    const next = (WIND_UNITS.indexOf(this.windUnit()) + 1) % WIND_UNITS.length;
    this.windUnit.set(WIND_UNITS[next]);
  }

  /** Keeps the address bar pointing at `place`, so the page can be bookmarked or shared. */
  private syncUrl(place: Place | undefined) {
    const { location, defaultView } = this.document;
    const url = new URL(location.href);
    url.search = place ? placeToParams(place).toString() : '';
    if (url.href !== location.href) {
      defaultView?.history.replaceState(defaultView.history.state, '', url);
    }
  }

  private refresh() {
    this.lastRefresh = Date.now();
    this.tick.update((n) => n + 1);
    this.forecast.reload();
    this.air.reload();
  }

  /** Keeps the data (and with it the sky, backdrop and rain banner) current. */
  private startAutoRefresh() {
    const timer = setInterval(() => this.refresh(), REFRESH_MS);
    const onVisible = () => {
      if (this.document.visibilityState !== 'visible') {
        return;
      }
      this.tick.update((n) => n + 1);
      if (Date.now() - this.lastRefresh > STALE_MS) {
        this.refresh();
      }
    };
    const onConnection = () => {
      this.online.set(navigator.onLine);
      // Back online: don't wait for the next tick to replace the offline copy.
      if (navigator.onLine) {
        this.refresh();
      }
    };
    const window = this.document.defaultView;
    this.document.addEventListener('visibilitychange', onVisible);
    window?.addEventListener('online', onConnection);
    window?.addEventListener('offline', onConnection);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      this.document.removeEventListener('visibilitychange', onVisible);
      window?.removeEventListener('online', onConnection);
      window?.removeEventListener('offline', onConnection);
    });
  }
}
