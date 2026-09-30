import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  AirQualityResponse,
  ForecastResponse,
  ReverseGeocodeResponse,
} from '../../weather/weather.models';
import {
  AIR_QUALITY_URL,
  FORECAST_URL,
  REVERSE_GEOCODE_URL,
  WeatherService,
} from '../../weather/weather.service';
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
const hours = Array.from({ length: 24 }, (_, i) => `2026-09-30T${String(i).padStart(2, '0')}:00`);

const response: ForecastResponse = {
  utc_offset_seconds: 0,
  current_units: { temperature_2m: '°C' },
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
  },
  hourly: {
    time: hours,
    temperature_2m: hours.map(() => 18),
    weather_code: hours.map(() => 0),
    is_day: hours.map(() => 1),
  },
  daily: {
    time: days,
    weather_code: days.map(() => 61),
    temperature_2m_max: days.map(() => 15),
    temperature_2m_min: days.map(() => 3),
    precipitation_probability_max: days.map(() => 30),
    sunrise: days.map((d) => `${d}T06:35`),
    sunset: days.map((d) => `${d}T17:42`),
  },
};

const airResponse: AirQualityResponse = { current: { us_aqi: 105 } };

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
    const req = httpTesting.expectOne((r) => r.url === FORECAST_URL);
    const airReq = httpTesting.expectOne((r) => r.url === AIR_QUALITY_URL);
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
    expect(card('Wind Status')).toContain('7.7km/h');
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

    const items = el.querySelectorAll('.forecast__item');
    expect(items.length).toBe(8);
    expect(items[1].textContent).toContain('03:00');
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

    const refetch = httpTesting.expectOne((r) => r.url === FORECAST_URL);
    expect(refetch.request.params.get('temperature_unit')).toBe('fahrenheit');
    refetch.flush(response);
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
