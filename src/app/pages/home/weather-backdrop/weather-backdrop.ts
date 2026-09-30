import { Component, computed, input } from '@angular/core';
import { DayPhase, WeatherTone } from '../../../models/weather.models';

type Effect = 'rain' | 'storm' | 'snow' | 'clouds' | 'stars';

/** How many particles each effect draws. */
const COUNTS: Record<Effect, number> = { rain: 70, storm: 90, snow: 45, clouds: 5, stars: 60 };

/** Spreads values evenly over 0–1 without clumping (golden-ratio sequence), so layouts are stable. */
const spread = (i: number, offset = 0) => (i * 0.618034 + offset) % 1;

/** Decorative weather layer drawn over the sky gradient, behind the dashboard. */
@Component({
  selector: 'app-weather-backdrop',
  templateUrl: './weather-backdrop.html',
  styleUrl: './weather-backdrop.scss',
  host: {
    'aria-hidden': 'true',
    '[class.light-sky]': "phase() === 'day' || phase() === 'dawn'",
  },
})
export class WeatherBackdrop {
  readonly tone = input<WeatherTone>();
  readonly phase = input<DayPhase>();

  protected readonly effect = computed((): Effect | undefined => {
    switch (this.tone()) {
      case 'rain':
        return 'rain';
      case 'storm':
        return 'storm';
      case 'snow':
        return 'snow';
      case 'cloud':
      case 'fog':
        return 'clouds';
      case 'night':
        return 'stars';
      case 'sun':
        return this.phase() === 'night' ? 'stars' : undefined;
      default:
        return undefined;
    }
  });

  /** Position (%) and timing (s) for each particle, consumed as CSS variables. */
  protected readonly particles = computed(() => {
    const effect = this.effect();
    if (!effect) {
      return [];
    }
    return Array.from({ length: COUNTS[effect] }, (_, i) => ({
      x: spread(i) * 100,
      y: spread(i, 0.37) * 100,
      // Negative delays start each particle part-way through its loop, so nothing pops in.
      delay: -spread(i, 0.71) * 10,
      speed: 0.7 + spread(i, 0.13) * 0.6,
    }));
  });
}
