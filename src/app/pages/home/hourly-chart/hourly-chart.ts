import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

export interface HourlyPoint {
  key: string;
  label: Date;
  temperature: number;
  /** Percent, or null where the model has no value. */
  rainChance: number | null;
}

// SVG layout, in viewBox units.
const WIDTH = 480;
const PAD_X = 16;
const TEMP_TOP = 30;
const TEMP_BOTTOM = 96;
const BAR_BOTTOM = 150;
const BAR_MAX = 36;

/** Temperature line with rain-chance bars for the next 24 hours; labels every 3 hours. */
@Component({
  selector: 'app-hourly-chart',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './hourly-chart.html',
  styleUrl: './hourly-chart.scss',
})
export class HourlyChart {
  readonly points = input.required<HourlyPoint[]>();

  protected readonly width = WIDTH;
  protected readonly barBottom = BAR_BOTTOM;

  protected readonly chart = computed(() => {
    const points = this.points();
    if (points.length < 2) {
      return undefined;
    }
    const temps = points.map((p) => p.temperature);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const step = (WIDTH - 2 * PAD_X) / (points.length - 1);
    const y = (t: number) =>
      max === min
        ? (TEMP_TOP + TEMP_BOTTOM) / 2
        : TEMP_BOTTOM - ((t - min) / (max - min)) * (TEMP_BOTTOM - TEMP_TOP);

    const plotted = points.map((p, i) => {
      const rain = p.rainChance ?? 0;
      return {
        ...p,
        x: PAD_X + i * step,
        y: y(p.temperature),
        barHeight: (rain / 100) * BAR_MAX,
        labelled: i % 3 === 0,
      };
    });
    const line = plotted.map((p) => `${p.x},${p.y}`).join(' ');
    const rainMax = Math.max(...points.map((p) => p.rainChance ?? 0));
    return {
      points: plotted,
      line,
      // Close the line down to the baseline for a soft fill underneath.
      area: `${PAD_X},${TEMP_BOTTOM + 8} ${line} ${WIDTH - PAD_X},${TEMP_BOTTOM + 8}`,
      barWidth: step * 0.6,
      summary:
        `Temperature between ${Math.round(min)}° and ${Math.round(max)}°` +
        `, rain chance up to ${rainMax}%, over the next 24 hours`,
    };
  });
}
