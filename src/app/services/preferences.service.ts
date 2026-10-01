import { computed, effect, Injectable, signal } from '@angular/core';
import { AlertId, Place, PrecipUnit, TemperatureUnit, WindUnit } from '../models/weather.models';

/** Forecast tabs: the next 24 hours, 7 days or 14 days. */
export type ForecastView = 'today' | 'week' | 'fortnight';
export type ClockFormat = '24h' | '12h';

export interface Preferences {
  unit: TemperatureUnit;
  windUnit: WindUnit;
  precipUnit: PrecipUnit;
  clock: ClockFormat;
  view: ForecastView;
  /** Last searched place; undefined means "use the device location". */
  place?: Place;
  favourites: Place[];
  /** Master switch for browser notifications (the bell). */
  notify: boolean;
  /** Which alerts to notify about while `notify` is on. */
  alerts: Record<AlertId, boolean>;
}

export const PREFERENCES_KEY = 'weather-prefs';

const DEFAULTS: Preferences = {
  unit: 'celsius',
  windUnit: 'kmh',
  precipUnit: 'mm',
  clock: '24h',
  view: 'week',
  favourites: [],
  notify: false,
  alerts: { rain: true, uv: true, wind: true, frost: true, heat: true, air: true },
};

/** User settings, kept in localStorage so they survive reloads. */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly state = signal<Preferences>(load());
  readonly prefs = this.state.asReadonly();

  /** `DatePipe` format for times of day, following the 12/24-hour setting. */
  readonly timeFormat = computed(() => (this.state().clock === '12h' ? 'h:mm a' : 'HH:mm'));

  constructor() {
    effect(() => save(this.state()));
  }

  update(changes: Partial<Preferences>) {
    this.state.update((prefs) => ({ ...prefs, ...changes }));
  }
}

// Storage can be missing, full or blocked (private mode); fall back to defaults quietly.
function load(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}');
    if (typeof saved !== 'object' || !saved) {
      return DEFAULTS;
    }
    // `notify` was `notifyRain` when rain was the only alert.
    const { notifyRain, ...rest } = saved;
    return {
      ...DEFAULTS,
      ...(typeof notifyRain === 'boolean' && { notify: notifyRain }),
      ...rest,
      alerts: { ...DEFAULTS.alerts, ...rest.alerts },
    };
  } catch {
    return DEFAULTS;
  }
}

function save(prefs: Preferences) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    // Not persisted this time; the in-memory value still works.
  }
}
