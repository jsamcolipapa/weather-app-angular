import { TestBed } from '@angular/core/testing';
import { HourlyChart, HourlyPoint } from './hourly-chart';

const points: HourlyPoint[] = Array.from({ length: 24 }, (_, h) => ({
  key: `h${h}`,
  label: new Date(2026, 8, 30, h),
  temperature: 10 + h / 2,
  rainChance: h < 12 ? 0 : 60,
}));

describe('HourlyChart', () => {
  async function render(input: HourlyPoint[]) {
    const fixture = TestBed.createComponent(HourlyChart);
    fixture.componentRef.setInput('points', input);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws a bar per hour and labels every third', async () => {
    const el = await render(points);

    expect(el.querySelectorAll('.chart__bar').length).toBe(24);
    expect(el.querySelectorAll('.chart__time').length).toBe(8);
    expect(el.querySelector('.chart__time')?.textContent).toBe('00:00');
  });

  it('summarises the chart for screen readers', async () => {
    const el = await render(points);

    expect(el.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Temperature between 10° and 22°, rain chance up to 60%, over the next 24 hours',
    );
  });

  it('draws nothing without enough data', async () => {
    const el = await render(points.slice(0, 1));

    expect(el.querySelector('svg')).toBeNull();
  });
});
