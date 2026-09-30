import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Place } from './weather.models';
import { SEARCH_URL, WeatherService } from './weather.service';

describe('WeatherService.search', () => {
  let httpTesting: HttpTestingController;
  let service: WeatherService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(WeatherService);
  });

  afterEach(() => httpTesting.verify());

  function search(query: string, near?: Place) {
    TestBed.runInInjectionContext(() => service.search(signal(query), signal(near)));
    TestBed.tick();
  }

  it('ranks results near the given place first and filters out clutter', () => {
    search(' BGC ', { latitude: 14.6, longitude: 121 });

    const req = httpTesting.expectOne((r) => r.url === SEARCH_URL);
    expect(req.request.params.get('q')).toBe('BGC');
    expect(req.request.params.get('lat')).toBe('14.6');
    expect(req.request.params.get('lon')).toBe('121');
    expect(req.request.params.getAll('osm_tag')).toContain('!highway:bus_stop');
    req.flush({ features: [] });
  });

  it('searches without a location bias when no place is known', () => {
    search('Manila');

    const req = httpTesting.expectOne((r) => r.url === SEARCH_URL);
    expect(req.request.params.has('lat')).toBe(false);
    req.flush({ features: [] });
  });

  it('waits for at least 2 characters', () => {
    search('M');
    httpTesting.expectNone((r) => r.url === SEARCH_URL);
  });
});
