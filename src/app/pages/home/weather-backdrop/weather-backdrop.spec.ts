import { TestBed } from '@angular/core/testing';
import { DayPhase, WeatherTone } from '../../../models/weather.models';
import { WeatherBackdrop } from './weather-backdrop';

describe('WeatherBackdrop', () => {
  async function render(inputs: {
    tone?: WeatherTone;
    phase?: DayPhase;
    progress?: number;
    cloudCover?: number;
    moonCycle?: number;
  }) {
    const fixture = TestBed.createComponent(WeatherBackdrop);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws nothing until the forecast is in', async () => {
    const el = await render({});

    expect(el.querySelector('.scene')).toBeNull();
    expect(el.querySelector('.backdrop')).toBeNull();
  });

  it('puts the sun in the left gutter in the morning and the right in the afternoon', async () => {
    const morning = await render({ tone: 'sun', phase: 'day', progress: 0.25 });
    expect(morning.querySelector('.body--sun.body--left')).not.toBeNull();
    expect(morning.querySelector('.moon')).toBeNull();

    TestBed.resetTestingModule();
    const afternoon = await render({ tone: 'sun', phase: 'day', progress: 0.75 });
    const sun = afternoon.querySelector<HTMLElement>('.body--sun.body--right')!;
    // Equally high either side of midday.
    expect(Number(sun.style.getPropertyValue('--height'))).toBeCloseTo(Math.SQRT1_2);
  });

  it('draws the moon in its phase with stars on a clear night', async () => {
    const el = await render({ tone: 'night', phase: 'night', progress: 0.5, moonCycle: 0.5 });

    expect(el.querySelector('.body--moon')).not.toBeNull();
    // Full moon: the terminator has the same radius as the disc.
    expect(el.querySelector('.moon__lit')?.getAttribute('d')).toBe(
      'M 20 0 A 20 20 0 0 0 20 40 A 20 20 0 0 0 20 0 Z',
    );
    expect(el.querySelector('.backdrop--stars')).not.toBeNull();
    expect(el.querySelector('.shooting-star')).not.toBeNull();
  });

  it('hides the sun and moon behind rain, snow and overcast skies', async () => {
    for (const tone of ['rain', 'storm', 'snow', 'cloud', 'fog'] as const) {
      TestBed.resetTestingModule();
      const el = await render({ tone, phase: 'day', cloudCover: 100 });
      expect(el.querySelector('.body')).toBeNull();
    }
  });

  it('adds clouds as the sky gets cloudier', async () => {
    const count = async (cloudCover: number) => {
      TestBed.resetTestingModule();
      const el = await render({ tone: 'sun', phase: 'day', cloudCover });
      return el.querySelectorAll('.cloud').length;
    };

    expect(await count(10)).toBe(0);
    expect(await count(40)).toBe(3);
    expect(await count(100)).toBe(6);
  });

  it('tints the scene for the time of day', async () => {
    const fixture = TestBed.createComponent(WeatherBackdrop);
    fixture.componentRef.setInput('phase', 'dusk');
    fixture.componentRef.setInput('tone', 'sun');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.getAttribute('data-phase')).toBe('dusk');
    expect(el.querySelector('.hills')).not.toBeNull();
  });
});
