import { TestBed } from '@angular/core/testing';
import { PREFERENCES_KEY, PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  beforeEach(() => localStorage.clear());

  const create = () => TestBed.inject(PreferencesService);

  it('starts from defaults', () => {
    expect(create().prefs()).toEqual({
      unit: 'celsius',
      windUnit: 'kmh',
      precipUnit: 'mm',
      clock: '24h',
      view: 'week',
      favourites: [],
      notify: false,
      alerts: { rain: true, uv: true, wind: true, frost: true, heat: true, air: true },
    });
  });

  it('keeps the rain alert setting saved by earlier versions', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ notifyRain: true }));

    const prefs = create().prefs();
    expect(prefs.notify).toBe(true);
    expect(prefs).not.toHaveProperty('notifyRain');
  });

  it('fills in alert types added since the settings were saved', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ alerts: { uv: false } }));

    expect(create().prefs().alerts).toMatchObject({ uv: false, rain: true, air: true });
  });

  it('saves changes to localStorage', () => {
    const service = create();
    service.update({ unit: 'fahrenheit' });
    TestBed.tick();

    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).unit).toBe('fahrenheit');
  });

  it('loads saved preferences over the defaults', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ view: 'today' }));

    expect(create().prefs()).toMatchObject({ view: 'today', unit: 'celsius' });
  });

  it('formats times for the chosen clock', () => {
    const service = create();
    expect(service.timeFormat()).toBe('HH:mm');

    service.update({ clock: '12h' });
    expect(service.timeFormat()).toBe('h:mm a');
  });

  it('ignores corrupt storage', () => {
    localStorage.setItem(PREFERENCES_KEY, '{not json');

    expect(create().prefs().unit).toBe('celsius');
  });
});
