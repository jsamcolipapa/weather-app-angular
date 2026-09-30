import { TestBed } from '@angular/core/testing';
import { DayDetails, DayDetailsData } from './day-details';

const condition = { label: 'Rain', icon: 'rainy', tone: 'rain' as const };
const day: DayDetailsData = {
  label: new Date(2026, 9, 1),
  condition,
  high: 15,
  low: 3,
  rainChance: 80,
  rainTotal: 12.34,
  windMax: 24.6,
  uvMax: 2,
  sunrise: new Date(2026, 9, 1, 6, 35),
  sunset: new Date(2026, 9, 1, 17, 42),
  hours: [0, 3, 6].map((h) => ({
    key: `h${h}`,
    label: new Date(2026, 9, 1, h),
    condition,
    temperature: 5 + h,
  })),
};

describe('DayDetails', () => {
  async function render() {
    const fixture = TestBed.createComponent(DayDetails);
    fixture.componentRef.setInput('day', day);
    fixture.componentRef.setInput('windUnit', 'mph');
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it("shows the day's hours and totals", async () => {
    const { el } = await render();
    const stats = el.querySelector('.details__stats')?.textContent?.replace(/\s+/g, ' ');

    expect(el.querySelector('.details__title')?.textContent).toBe('Thursday, Oct 1');
    expect(el.querySelectorAll('.details__hour').length).toBe(3);
    expect(stats).toContain('12.3 mm · 80%');
    expect(stats).toContain('25 mph');
    expect(stats).toContain('2 · Low');
    expect(stats).toContain('6:35 AM – 5:42 PM');
  });

  it('closes on the close button and on Escape', async () => {
    const { fixture, el } = await render();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    el.querySelector<HTMLButtonElement>('.details__close')!.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closed).toHaveBeenCalledTimes(2);
  });
});
