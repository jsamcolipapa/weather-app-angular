import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PreferencesService } from '../../../weather/preferences.service';
import {
  describeWeather,
  Place,
  samePlace,
  TemperatureUnit,
} from '../../../weather/weather.models';
import { WeatherService } from '../../../weather/weather.service';

/** Starred places as chips with their current temperature; click one to switch to it. */
@Component({
  selector: 'app-saved-places',
  imports: [DecimalPipe, MatIconModule],
  templateUrl: './saved-places.html',
  styleUrl: './saved-places.scss',
})
export class SavedPlaces {
  private readonly preferences = inject(PreferencesService);
  private readonly weatherService = inject(WeatherService);

  /** The place on screen, highlighted in the list. */
  readonly active = input<Place>();
  readonly unit = input<TemperatureUnit>('celsius');

  readonly placeSelected = output<Place>();

  private readonly favourites = computed(() => this.preferences.prefs().favourites);
  private readonly conditions = this.weatherService.currentFor(this.favourites, this.unit);

  protected readonly items = computed(() => {
    const results = this.conditions.hasValue() ? this.conditions.value() : [];
    return this.favourites().map((place, i) => {
      const result = results[i];
      return {
        key: `${place.latitude},${place.longitude}`,
        place,
        active: samePlace(place, this.active()),
        temperature: result?.current.temperature_2m,
        condition: result
          ? describeWeather(result.current.weather_code, result.current.is_day === 1)
          : undefined,
      };
    });
  });

  protected remove(place: Place) {
    this.preferences.update({
      favourites: this.favourites().filter((p) => !samePlace(p, place)),
    });
  }
}
