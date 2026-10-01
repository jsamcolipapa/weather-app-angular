import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { WeatherCondition } from '../../../models/weather.models';
import { ForecastView, PreferencesService } from '../../../services/preferences.service';

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

  protected readonly timeFormat = inject(PreferencesService).timeFormat;

  /** Weekday names repeat over 14 days, so that tab adds the day of the month. */
  protected readonly dayFormat = computed(() => (this.view() === 'fortnight' ? 'EEE d' : 'EEE'));

  /** Placeholder cards while loading: one per day, or one per 3 hours. */
  protected readonly skeletonSlots = computed(() =>
    Array.from({ length: { today: 8, week: 7, fortnight: 14 }[this.view()] }),
  );
}
