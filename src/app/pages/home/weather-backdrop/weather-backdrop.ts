import { Component, computed, input } from '@angular/core';
import { DayPhase, moonPath, WeatherTone } from '../../../models/weather.models';

type Effect = 'rain' | 'storm' | 'snow' | 'clouds' | 'stars';

/** How many particles each effect draws. */
const COUNTS: Record<Effect, number> = { rain: 70, storm: 90, snow: 45, clouds: 5, stars: 60 };

/** Spreads values evenly over 0–1 without clumping (golden-ratio sequence), so layouts are stable. */
const spread = (i: number, offset = 0) => (i * 0.618034 + offset) % 1;

/** Radius of the moon drawing, in SVG units. */
const MOON_R = 20;

/** Below this much cloud cover (%) the sky is drawn clear; above it, one cloud per step. */
const CLOUD_MIN_COVER = 20;
const CLOUD_STEP = 16;
const CLOUD_MAX = 6;

/**
 * Decorative sky drawn over the gradient, behind the dashboard: the sun or moon, clouds and a
 * horizon in the gutters either side of it, plus particles for the current weather.
 */
@Component({
  selector: 'app-weather-backdrop',
  templateUrl: './weather-backdrop.html',
  styleUrl: './weather-backdrop.scss',
  host: {
    'aria-hidden': 'true',
    '[class.light-sky]': "phase() === 'day' || phase() === 'dawn'",
    '[attr.data-phase]': 'phase()',
    '[attr.data-tone]': 'tone()',
  },
})
export class WeatherBackdrop {
  readonly tone = input<WeatherTone>();
  readonly phase = input<DayPhase>();
  /** 0 as the sun (or, at night, the moon) rises, 0.5 at its highest, 1 as it sets. */
  readonly progress = input<number>();
  /** Percent of the sky covered. */
  readonly cloudCover = input<number>();
  /** 0 new → 0.5 full → 1 new. */
  readonly moonCycle = input<number>();

  protected readonly moonSize = MOON_R * 2;

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

  /**
   * The sun or moon, when the sky is clear enough to see it. It climbs the left gutter until its
   * highest point, then sinks down the right one, so it's never hidden behind the dashboard.
   */
  protected readonly body = computed(() => {
    const phase = this.phase();
    const tone = this.tone();
    if (!phase || (tone !== 'sun' && tone !== 'night')) {
      return undefined;
    }
    const progress = this.progress() ?? 0.25;
    const kind = phase === 'night' ? ('moon' as const) : ('sun' as const);
    return {
      kind,
      side: progress < 0.5 ? ('left' as const) : ('right' as const),
      // 0 on the horizon, 1 at its highest.
      height: Math.sin(Math.PI * progress),
      moonPath: kind === 'moon' ? moonPath(this.moonCycle() ?? 0.5, MOON_R) : undefined,
    };
  });

  /** Clouds parked in the gutters, alternating sides; more of them the cloudier it is. */
  protected readonly clouds = computed(() => {
    const cover = this.cloudCover() ?? 0;
    const count = cover < CLOUD_MIN_COVER ? 0 : Math.min(CLOUD_MAX, Math.round(cover / CLOUD_STEP));
    return Array.from({ length: count }, (_, i) => ({
      side: i % 2 === 0 ? ('right' as const) : ('left' as const),
      // Where across its gutter (0 outer edge → 1 next to the dashboard) and how far down (%).
      // Kept to the inner half, so a cloud tucks behind the dashboard rather than being cut
      // off by the edge of the window.
      across: 0.5 + spread(i, 0.2) * 0.45,
      y: 8 + spread(i, 0.55) * 58,
      scale: 0.7 + spread(i, 0.9) * 0.5,
      delay: -spread(i, 0.41) * 40,
    }));
  });
}
