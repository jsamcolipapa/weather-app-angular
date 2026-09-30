import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RainViewerMaps } from '../../../models/weather.models';
import { RAINVIEWER_URL } from '../../../services/weather.service';
import { RainMap } from './rain-map';

// Three frames, 10 minutes apart, ending at 14:20 local time.
const latest = new Date(2026, 8, 30, 14, 20).getTime() / 1000;
const maps: RainViewerMaps = {
  host: 'https://tiles.example',
  radar: {
    past: [1200, 600, 0].map((ago) => ({ time: latest - ago, path: `/v2/radar/${latest - ago}` })),
  },
};

describe('RainMap', () => {
  async function render() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(RainMap);
    fixture.componentRef.setInput('place', { latitude: 14.6, longitude: 121 });
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(RAINVIEWER_URL).flush(maps);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const time = (el: HTMLElement) =>
    el.querySelector('.controls__time')?.textContent?.replace(/\\s+/g, ' ').trim();

  it('starts on the latest radar frame', async () => {
    const { el } = await render();

    expect(el.querySelector<HTMLInputElement>('.controls__slider')?.max).toBe('2');
    expect(time(el)).toBe('14:20 latest');
  });

  it('scrubs back through earlier frames', async () => {
    const { fixture, el } = await render();
    const slider = el.querySelector<HTMLInputElement>('.controls__slider')!;

    slider.value = '0';
    slider.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(time(el)).toBe('14:00');
  });

  it('plays from the oldest frame and pauses', async () => {
    const { fixture, el } = await render();
    const play = el.querySelector<HTMLButtonElement>('.controls__play')!;

    play.click();
    await fixture.whenStable();
    expect(time(el)).toBe('14:00');
    expect(play.getAttribute('aria-label')).toBe('Pause radar animation');

    play.click();
    await fixture.whenStable();
    expect(play.getAttribute('aria-label')).toBe('Play the last 2 hours of radar');
  });
});
