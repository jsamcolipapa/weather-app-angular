import { DatePipe, DecimalPipe, DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  OutfitTip,
  Place,
  placeToParams,
  samePlace,
  shareText,
  WeatherCondition,
} from '../../../models/weather.models';
import { PreferencesService } from '../../../services/preferences.service';

export interface CurrentWeather {
  temperature: number;
  /** e.g. "°C". */
  unit: string;
  feelsLike: number;
  time: Date;
  condition: WeatherCondition;
  rainChance: number | null;
}

/** Sidebar summary: big temperature, key facts, what to wear and the place card. */
@Component({
  selector: 'app-current-conditions',
  imports: [DatePipe, DecimalPipe, MatIconModule],
  templateUrl: './current-conditions.html',
  styleUrl: './current-conditions.scss',
})
export class CurrentConditions {
  private readonly preferences = inject(PreferencesService);
  private readonly document = inject(DOCUMENT);

  readonly place = input<Place>();
  /** Undefined while loading. */
  readonly now = input<CurrentWeather>();
  readonly error = input(false);
  readonly loading = input(false);
  readonly placeName = input('');
  /** e.g. "3° warmer than yesterday". */
  readonly comparison = input<string>();
  readonly wearTips = input<OutfitTip[]>();
  /** Best 2-hour window to be outside today, if any daylight is left. */
  readonly bestTime = input<{ start: Date; end: Date }>();
  /** e.g. "Offline · updated 2 h ago"; undefined while the forecast is live. */
  readonly dataAge = input<string>();

  readonly retry = output<void>();

  protected readonly timeFormat = this.preferences.timeFormat;

  /** Device locations come without a name; `placeName` is then looked up by reverse geocoding. */
  protected readonly isDeviceLocation = computed(() => !!this.place() && !this.place()?.name);

  protected readonly isFavourite = computed(() =>
    this.preferences.prefs().favourites.some((p) => samePlace(p, this.place())),
  );

  /** True for a moment after the share text was copied to the clipboard. */
  protected readonly copied = signal(false);

  protected toggleFavourite() {
    const place = this.place();
    if (!place) {
      return;
    }
    const { favourites } = this.preferences.prefs();
    this.preferences.update({
      favourites: this.isFavourite()
        ? favourites.filter((p) => !samePlace(p, place))
        : [...favourites, { ...place, name: this.placeName() }],
    });
  }

  protected async share() {
    const now = this.now();
    const place = this.place();
    if (!now || !place) {
      return;
    }
    const text = shareText(this.placeName(), now.temperature, now.unit, now.condition.label);
    // A link that opens this place, whether it was searched or is the device's location.
    const link = new URL(this.document.baseURI);
    link.search = placeToParams(place, this.placeName()).toString();
    const url = link.href;
    if (navigator.share) {
      // Rejects when the user closes the share sheet; nothing to do then.
      await navigator.share({ text, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(`${text} ${url}`);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
