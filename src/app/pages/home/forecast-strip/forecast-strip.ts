import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { WeatherCondition } from '../../../models/weather.models';
import { ForecastView } from '../../../services/preferences.service';

export interface ForecastDay {
  key: string;
  label: Date;
  condition: WeatherCondition;
  high: number;
  low: number;
}

export interface ForecastHour {
  key: string;
  label: Date;
  condition: WeatherCondition;
  temperature: number;
}

/** Row of forecast cards: one per day (clickable for details) or one per 3 hours. */
@Component({
  selector: 'app-forecast-strip',
  imports: [DatePipe, DecimalPipe, MatIconModule],
  templateUrl: './forecast-strip.html',
  styleUrl: './forecast-strip.scss',
})
export class ForecastStrip {
  readonly view = input<ForecastView>('week');
  readonly loading = input(false);
  readonly days = input<ForecastDay[]>([]);
  readonly hours = input<ForecastHour[]>([]);
  /** Index into `days` whose details are open. */
  readonly selectedDay = input<number>();

  readonly daySelected = output<number>();

  /** Placeholder cards while loading: one per day, or one per 3 hours. */
  protected readonly skeletonSlots = computed(() =>
    Array.from({ length: this.view() === 'week' ? 7 : 8 }),
  );
}
