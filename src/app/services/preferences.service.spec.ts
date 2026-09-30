import { TestBed } from '@angular/core/testing';
import { PREFERENCES_KEY, PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  beforeEach(() => localStorage.clear());

  const create = () => TestBed.inject(PreferencesService);

  it('starts from defaults', () => {
    expect(create().prefs()).toEqual({
      unit: 'celsius',
      windUnit: 'kmh',
      view: 'week',
      favourites: [],
      notifyRain: false,
    });
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

  it('ignores corrupt storage', () => {
    localStorage.setItem(PREFERENCES_KEY, '{not json');

    expect(create().prefs().unit).toBe('celsius');
  });
});
