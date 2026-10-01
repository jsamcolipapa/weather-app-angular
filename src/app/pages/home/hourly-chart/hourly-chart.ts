import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { PreferencesService } from '../../../services/preferences.service';

export interface HourlyPoint {
  key: string;
  label: Date;
  temperature: number;
  /** Percent, or null where the model has no value. */
  rainChance: number | null;
  /** In the unit named by the chart's `windUnit`. */
  wind: number;
  uv: number;
}

/** What the line plots; the bars are always the chance of rain. */
export type ChartMetric = 'temperature' | 'wind' | 'uv';

const METRICS: { value: ChartMetric; label: string }[] = [
  { value: 'temperature', label: 'Temperature' },
  { value: 'wind', label: 'Wind' },
  { value: 'uv', label: 'UV' },
];

// SVG layout, in viewBox units.
const WIDTH = 480;
const PAD_X = 16;
const TEMP_TOP = 30;
const TEMP_BOTTOM = 96;
const BAR_BOTTOM = 150;
const BAR_MAX = 36;

/**
 * Temperature, wind or UV line with rain-chance bars for the next 24 hours; labels every
 * 3 hours.
 */
@Component({
  selector: 'app-hourly-chart',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './hourly-chart.html',
  styleUrl: './hourly-chart.scss',
})
export class HourlyChart {
  readonly points = input.required<HourlyPoint[]>();
  /** e.g. "km/h", for the wind line's description. */
  readonly windUnit = input('km/h');

  protected readonly timeFormat = inject(PreferencesService).timeFormat;
  protected readonly width = WIDTH;
  protected readonly barBottom = BAR_BOTTOM;
  protected readonly metrics = METRICS;
  protected readonly metric = signal<ChartMetric>('temperature');

  protected readonly chart = computed(() => {
    const points = this.points();
    if (points.length < 2) {
      return undefined;
    }
    const metric = this.metric();
    const values = points.map((p) => p[metric]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = (WIDTH - 2 * PAD_X) / (points.length - 1);
    const y = (value: number) =>
      max === min
        ? (TEMP_TOP + TEMP_BOTTOM) / 2
        : TEMP_BOTTOM - ((value - min) / (max - min)) * (TEMP_BOTTOM - TEMP_TOP);

    const plotted = points.map((p, i) => {
      const rain = p.rainChance ?? 0;
      return {
        ...p,
        x: PAD_X + i * step,
        y: y(p[metric]),
        value: p[metric],
        barHeight: (rain / 100) * BAR_MAX,
        labelled: i % 3 === 0,
      };
    });
    const line = plotted.map((p) => `${p.x},${p.y}`).join(' ');
    const rainMax = Math.max(...points.map((p) => p.rainChance ?? 0));
    const range = {
      temperature: `Temperature between ${Math.round(min)}° and ${Math.round(max)}°`,
      wind: `Wind between ${Math.round(min)} and ${Math.round(max)} ${this.windUnit()}`,
      uv: `UV index between ${Math.round(min)} and ${Math.round(max)}`,
    }[metric];
    return {
      points: plotted,
      line,
      // Close the line down to the baseline for a soft fill underneath.
      area: `${PAD_X},${TEMP_BOTTOM + 8} ${line} ${WIDTH - PAD_X},${TEMP_BOTTOM + 8}`,
      barWidth: step * 0.6,
      suffix: metric === 'temperature' ? '°' : '',
      legend: METRICS.find((m) => m.value === metric)!.label,
      summary: `${range}, rain chance up to ${rainMax}%, over the next 24 hours`,
    };
  });
}
