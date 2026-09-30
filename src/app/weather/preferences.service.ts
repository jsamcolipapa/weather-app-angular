import { effect, Injectable, signal } from '@angular/core';
import { Place, TemperatureUnit, WindUnit } from './weather.models';

export type ForecastView = 'today' | 'week';

export interface Preferences {
  unit: TemperatureUnit;
  windUnit: WindUnit;
  view: ForecastView;
  /** Last searched place; undefined means "use the device location". */
  place?: Place;
  favourites: Place[];
  notifyRain: boolean;
}

export const PREFERENCES_KEY = 'weather-prefs';

const DEFAULTS: Preferences = {
  unit: 'celsius',
  windUnit: 'kmh',
  view: 'week',
  favourites: [],
  notifyRain: false,
};

/** User settings, kept in localStorage so they survive reloads. */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly state = signal<Preferences>(load());
  readonly prefs = this.state.asReadonly();

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
    return typeof saved === 'object' && saved ? { ...DEFAULTS, ...saved } : DEFAULTS;
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
