import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  AirQualityResponse,
  CurrentOnlyResponse,
  ForecastResponse,
  ReverseGeocodeResponse,
  YesterdayResponse,
} from '../../models/weather.models';
import {
  AIR_QUALITY_URL,
  FORECAST_URL,
  RAINVIEWER_URL,
  REVERSE_GEOCODE_URL,
  WeatherService,
} from '../../services/weather.service';
import { PREFERENCES_KEY } from '../../services/preferences.service';
import { Home } from './home';

const days = [
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
  '2026-10-05',
  '2026-10-06',
];
// Every hour of the 7 days, as Open-Meteo returns without `forecast_hours`.
const hours = days.flatMap((d) =>
  Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`),
);
const quarters = ['15:30', '15:45', '16:00', '16:15', '16:30', '16:45', '17:00', '17:15'].map(
  (t) => `2026-09-30T${t}`,
);

const response: ForecastResponse = {
  utc_offset_seconds: 0,
  current_units: { temperature_2m: '°C', wind_speed_10m: 'km/h' },
  current: {
    time: '2026-09-30T15:30',
    temperature_2m: 21.6,
    apparent_temperature: 20.2,
    weather_code: 2,
    is_day: 1,
    relative_humidity_2m: 12,
    wind_speed_10m: 7.7,
    wind_direction_10m: 247,
    visibility: 5200,
    uv_index: 5.2,
    precipitation: 0,
  },
  minutely_15: {
    time: quarters,
    precipitation: quarters.map(() => 0),
  },
  hourly: {
    time: hours,
    temperature_2m: hours.map(() => 18),
    weather_code: hours.map(() => 0),
    is_day: hours.map(() => 1),
    precipitation_probability: hours.map(() => 20),
    // Strong midday sun (10:00–16:00), calm otherwise.
    uv_index: hours.map((h) =>
      Number(h.slice(11, 13)) >= 10 && Number(h.slice(11, 13)) <= 16 ? 8 : 0,
    ),
    wind_speed_10m: hours.map(() => 10),
  },
  daily: {
    time: days,
    weather_code: days.map(() => 61),
    temperature_2m_max: days.map(() => 15),
    temperature_2m_min: days.map(() => 3),
    precipitation_probability_max: days.map(() => 30),
    precipitation_sum: days.map(() => 4.2),
    wind_speed_10m_max: days.map(() => 18),
    uv_index_max: days.map(() => 6),
    sunrise: days.map((d) => `${d}T06:35`),
    sunset: days.map((d) => `${d}T17:42`),
  },
};

const airResponse: AirQualityResponse = {
  current: { us_aqi: 105, pm2_5: 38.4, pm10: 51, ozone: 60, nitrogen_dioxide: 12 },
};

const yesterdayResponse: YesterdayResponse = {
  daily: {
    time: ['2026-09-29', '2026-09-30'],
    temperature_2m_max: [12.2, 15],
    sunrise: ['2026-09-29T06:34', '2026-09-30T06:35'],
    sunset: ['2026-09-29T17:44', '2026-09-30T17:42'],
  },
};

/** The main forecast (not the "yesterday" or saved-places lookups on the same endpoint). */
const isForecast = (r: HttpRequest<unknown>) =>
  r.url === FORECAST_URL && r.params.has('minutely_15');
const isYesterday = (r: HttpRequest<unknown>) =>
  r.url === FORECAST_URL && r.params.has('past_days');

const geocodeResponse: ReverseGeocodeResponse = {
  locality: 'Quezon City',
  city: 'Manila',
  principalSubdivision: 'National Capital Region',
  countryName: 'Philippines',
};

describe('Home', () => {
  let httpTesting: HttpTestingController;
  let locate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    locate = vi.spyOn(TestBed.inject(WeatherService), 'locate').mockResolvedValue({
      name: 'Testville',
      latitude: 1,
      longitude: 2,
    });
  });

  afterEach(() => httpTesting.verify());

  async function render() {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    const req = httpTesting.expectOne(isForecast);
    const airReq = httpTesting.expectOne((r) => r.url === AIR_QUALITY_URL);
    // Answered straight away so whenStable() below doesn't wait on it.
    httpTesting.expectOne(isYesterday).flush(yesterdayResponse);
    return { fixture, req, airReq, el: fixture.nativeElement as HTMLElement };
  }

  const text = (el: HTMLElement, selector: string) =>
    el.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  it('shows skeleton placeholders until the data arrives', async () => {
    const { fixture, req, airReq, el } = await render();

    expect(el.querySelector('.current')?.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelectorAll('.forecast__item .skeleton--circle').length).toBe(7);
    expect(el.querySelectorAll('.card .card__value-skeleton').length).toBe(4);
    expect(el.querySelector('.current__temp')).toBeNull();

    req.flush(response);
    // Not whenStable(): it would wait for the air-quality request we're holding back.
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    // The forecast is in; only air quality is still loading.
    expect(el.querySelector('.current')?.getAttribute('aria-busy')).toBe('false');
    expect(el.querySelectorAll('.card .card__value-skeleton').length).toBe(1);

    airReq.flush(airResponse);
    await fixture.whenStable();
    expect(el.querySelector('.skeleton')).toBeNull();
  });

  it('shows the current weather for the located place', async () => {
    const { fixture, req, airReq, el } = await render();
    expect(req.request.params.get('latitude')).toBe('1');
    expect(req.request.params.get('temperature_unit')).toBe('celsius');

    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    expect(text(el, '.current__temp')).toContain('22°C');
    expect(text(el, '.current__time')).toBe('Wednesday, 15:30');
    expect(text(el, '.current__condition')).toContain('Partly cloudy');
    expect(el.textContent).toContain('Rain – 30%');
    expect(text(el, '.place__name')).toBe('Testville');
  });

  it("shows the week's forecast and today's highlights", async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    const days = el.querySelectorAll('.forecast__item');
    expect(days.length).toBe(7);
    expect(days[0].textContent).toContain('Wed');
    expect(days[0].textContent).toContain('15°');

    const card = (title: string) =>
      Array.from(el.querySelectorAll('.card'))
        .find((c) => c.querySelector('.card__title')?.textContent === title)
        ?.textContent?.replace(/\s+/g, ' ');
    expect(card('UV Index')).toContain('Moderate');
    expect(card('Wind Status')).toContain('7.7 km/h');
    expect(card('Wind Status')).toContain('WSW');
    expect(card('Sunrise & Sunset')).toContain('6:35 AM');
    expect(card('Sunrise & Sunset')).toContain('5:42 PM');
    expect(card('Humidity')).toContain('12%Dry');
    expect(card('Visibility')).toContain('5.2kmAverage');
    expect(card('Air Quality')).toContain('105Unhealthy for some');
  });

  it('switches to an hourly forecast on the Today tab', async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    Array.from(el.querySelectorAll<HTMLButtonElement>('.tabs__tab'))
      .find((b) => b.textContent!.includes('Today'))!
      .click();
    await fixture.whenStable();

    // Starts from the current hour (15:30 → 15:00), in 3-hour steps.
    const items = el.querySelectorAll('.forecast__item');
    expect(items.length).toBe(8);
    expect(items[0].textContent).toContain('15:00');
    expect(items[1].textContent).toContain('18:00');
    expect(el.querySelectorAll('app-hourly-chart .chart__dot').length).toBe(8);
  });

  it('refetches in Fahrenheit when °F is picked', async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    Array.from(el.querySelectorAll<HTMLButtonElement>('.units__unit'))
      .find((b) => b.textContent!.includes('°F'))!
      .click();
    TestBed.tick();

    const refetch = httpTesting.expectOne(isForecast);
    expect(refetch.request.params.get('temperature_unit')).toBe('fahrenheit');
    refetch.flush(response);
  });

  it('warns about rain starting within the hour', async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush({
      ...response,
      minutely_15: { time: quarters, precipitation: [0, 0, 0, 0.8, 1, 1, 1, 1] },
    });
    airReq.flush(airResponse);
    await fixture.whenStable();

    expect(text(el, '.rain-banner')).toContain('Rain starting in about 30 min');
  });

  it('shows no rain banner when the next hour is dry', async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    expect(el.querySelector('.rain-banner')).toBeNull();
  });

  it('animates the backdrop for the current weather', async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush({ ...response, current: { ...response.current, weather_code: 63 } });
    airReq.flush(airResponse);
    await fixture.whenStable();

    expect(el.querySelector('app-weather-backdrop .backdrop--rain')).not.toBeNull();
    expect(el.querySelectorAll('app-weather-backdrop .particle').length).toBeGreaterThan(0);
  });

  it('cycles the wind unit and refetches', async () => {
    const { fixture, req, airReq, el } = await render();
    expect(req.request.params.get('wind_speed_unit')).toBe('kmh');
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    el.querySelector<HTMLButtonElement>('.card__unit--toggle')!.click();
    TestBed.tick();

    const refetch = httpTesting.expectOne(isForecast);
    expect(refetch.request.params.get('wind_speed_unit')).toBe('mph');
    refetch.flush(response);
    await fixture.whenStable();
    expect(text(el, '.card__unit--toggle')).toBe('mph');
  });

  it('remembers the unit and searched place for next time', async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    Array.from(el.querySelectorAll<HTMLButtonElement>('.units__unit'))
      .find((b) => b.textContent!.includes('°F'))!
      .click();
    TestBed.tick();
    httpTesting.expectOne(isForecast).flush(response);
    await fixture.whenStable();

    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY)!);
    expect(saved.unit).toBe('fahrenheit');
    expect(saved.place).toEqual({ name: 'Testville', latitude: 1, longitude: 2 });
  });

  it('copies a summary when the browser has no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    el.querySelector<HTMLButtonElement>('.place__action--share')!.click();
    await fixture.whenStable();

    expect(writeText).toHaveBeenCalledWith('22°C, partly cloudy in Testville');
    expect(el.querySelector('.place__action--share')?.getAttribute('aria-label')).toBe(
      'Copied to clipboard',
    );
    vi.unstubAllGlobals();
  });

  it('opens and closes the details for a day', async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    const dayButtons = el.querySelectorAll<HTMLButtonElement>('.forecast__item--button');
    dayButtons[1].click();
    await fixture.whenStable();

    expect(dayButtons[1].getAttribute('aria-expanded')).toBe('true');
    expect(text(el, '.details__title')).toBe('Thursday, Oct 1');
    expect(el.querySelectorAll('.details__hour').length).toBe(8);
    expect(text(el, '.details__stats')).toContain('4.2 mm · 30%');
    expect(text(el, '.details__stats')).toContain('18 km/h');

    el.querySelector<HTMLButtonElement>('.details__close')!.click();
    await fixture.whenStable();
    expect(el.querySelector('app-day-details')).toBeNull();
  });

  it('compares today with yesterday', async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    expect(text(el, '.current__compare')).toBe('3° warmer than yesterday');
  });

  it('breaks down the air quality by pollutant', async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    const pollutants = text(el, '.pollutants');
    expect(pollutants).toContain('PM2.538');
    expect(pollutants).toContain('NO₂12');
  });

  it('saves the current place and lists it', async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    el.querySelector<HTMLButtonElement>('.place__action--save')!.click();
    TestBed.tick();
    const saved: CurrentOnlyResponse = {
      current_units: { temperature_2m: '°C' },
      current: { temperature_2m: 19, weather_code: 0, is_day: 1 },
    };
    httpTesting
      .expectOne(
        (r) =>
          r.url === FORECAST_URL &&
          r.params.get('current') === 'temperature_2m,weather_code,is_day',
      )
      .flush([saved]);
    await fixture.whenStable();

    expect(text(el, '.chip__name')).toBe('Testville');
    expect(text(el, '.chip__temp')).toBe('19°');
    expect(el.querySelector('.place__action--save')?.getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).favourites).toEqual([
      { name: 'Testville', latitude: 1, longitude: 2 },
    ]);
  });

  it('suggests what to wear', async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    // Feels like 20.2°C, 30% rain, UV max 6, 7.7 km/h wind.
    const tips = Array.from(el.querySelectorAll('.wear__tip'), (tip) =>
      tip.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(tips).toEqual(['checkroom T-shirt', 'sunny Sunscreen & hat']);
  });

  it('only loads the rain radar when asked', async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    expect(text(el, '.map-placeholder')).toContain('Show rain radar');
    expect(el.querySelector('app-rain-map')).toBeNull();
    httpTesting.expectNone((r) => r.url === RAINVIEWER_URL);
  });

  it('suggests the best time to be outside', async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    // From 15:30: the 15:00 and 16:00 hours still have UV 8, so the first calm pair is 17–19.
    expect(text(el, '.best-time')).toBe('directions_walk Best time outside 17:00–19:00');
  });

  it('shows day length, golden hour and the moon', async () => {
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    await fixture.whenStable();

    const sky = text(el, '.sky');
    expect(sky).toContain('11h 7m · 3 min shorter than yesterday');
    expect(sky).toContain('06:35–07:35 · 16:42–17:42');
    expect(sky).toContain('Waning gibbous');
    // utc_offset_seconds is 0, so 2026-09-30T15:30 wall-clock is 15:30Z → ~83% lit.
    expect(sky).toContain('83% lit');
  });

  it('shows a retry button when the request fails', async () => {
    const { fixture, req, airReq, el } = await render();

    req.flush('boom', { status: 500, statusText: 'Server Error' });
    airReq.flush(airResponse);
    await fixture.whenStable();

    expect(el.textContent).toContain("Couldn't load the weather.");
    expect(text(el, '.current button')).toContain('Try again');
  });

  it('shows the reverse-geocoded name for a device location', async () => {
    locate.mockResolvedValue({ latitude: 14.676, longitude: 121.0437 });
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    const geocodeReq = httpTesting.expectOne((r) => r.url === REVERSE_GEOCODE_URL);
    expect(geocodeReq.request.params.get('latitude')).toBe('14.676');

    geocodeReq.flush(geocodeResponse);
    await fixture.whenStable();

    expect(text(el, '.place__name')).toBe('Quezon City, Manila');
  });

  it('falls back to "Your location" when reverse geocoding fails', async () => {
    locate.mockResolvedValue({ latitude: 14.676, longitude: 121.0437 });
    const { fixture, req, airReq, el } = await render();
    req.flush(response);
    airReq.flush(airResponse);
    httpTesting
      .expectOne((r) => r.url === REVERSE_GEOCODE_URL)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(text(el, '.place__name')).toBe('Your location');
  });
});
