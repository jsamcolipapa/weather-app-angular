import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  describeUvIndex,
  formatPrecipitation,
  WeatherCondition,
} from '../../../models/weather.models';
import { PreferencesService } from '../../../services/preferences.service';

export interface DayDetailsData {
  label: Date;
  condition: WeatherCondition;
  high: number;
  low: number;
  rainChance: number | null;
  /** Millimetres. */
  rainTotal: number;
  windMax: number;
  gustMax: number;
  uvMax: number;
  sunrise: Date;
  sunset: Date;
  /** 3-hourly steps through the day. */
  hours: { key: string; label: Date; condition: WeatherCondition; temperature: number }[];
}

/** Expanded view of one forecast day: hourly steps plus the day's totals. */
@Component({
  selector: 'app-day-details',
  imports: [DatePipe, DecimalPipe, MatIconModule],
  templateUrl: './day-details.html',
  styleUrl: './day-details.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class DayDetails {
  private readonly preferences = inject(PreferencesService);

  readonly day = input.required<DayDetailsData>();
  readonly windUnit = input('km/h');

  readonly closed = output<void>();

  protected readonly timeFormat = this.preferences.timeFormat;
  protected readonly describeUv = describeUvIndex;
  protected readonly rainTotal = computed(() =>
    formatPrecipitation(this.day().rainTotal, this.preferences.prefs().precipUnit),
  );
}
