import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Place, SearchResult, toSearchResult } from '../../../models/weather.models';
import { WeatherService } from '../../../services/weather.service';

/** How many suggestions to show after de-duplicating. */
const MAX_RESULTS = 6;

/** Search box that looks places up as you type, plus a "use my location" button. */
@Component({
  selector: 'app-place-search',
  imports: [MatAutocompleteModule, MatIconModule],
  templateUrl: './place-search.html',
  styleUrl: './place-search.scss',
})
export class PlaceSearch {
  private readonly weatherService = inject(WeatherService);

  /** Results close to this place are ranked first. */
  readonly near = input<Place>();

  readonly placeSelected = output<Place>();
  readonly locateRequested = output<void>();

  protected readonly query = signal('');
  private readonly debouncedQuery = toSignal(
    toObservable(this.query).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );
  private readonly search = this.weatherService.search(this.debouncedQuery, this.near);

  /** OpenStreetMap often has several entries for one place (e.g. both sides of a road). */
  protected readonly results = computed(() => {
    if (!this.search.hasValue()) {
      return [];
    }
    const seen = new Set<string>();
    const results: SearchResult[] = [];
    for (const feature of this.search.value().features) {
      const result = toSearchResult(feature);
      const key = result && `${result.name}|${result.detail}`;
      if (result && !seen.has(key!)) {
        seen.add(key!);
        results.push(result);
      }
    }
    return results.slice(0, MAX_RESULTS);
  });

  /** What the dropdown shows. The search service can take a few seconds, so say it's working. */
  protected readonly status = computed(() => {
    if (this.query().trim().length < 2) {
      return 'idle';
    }
    if (this.query() !== this.debouncedQuery() || this.search.isLoading()) {
      return 'searching';
    }
    if (this.search.error()) {
      return 'error';
    }
    return this.results().length ? 'done' : 'empty';
  });

  /** Clears the input once a place is picked. */
  protected readonly displayNothing = () => '';

  protected select(event: MatAutocompleteSelectedEvent) {
    const result: SearchResult = event.option.value;
    const area = result.detail.split(', ')[0];
    this.placeSelected.emit({
      name: area && area !== result.name ? `${result.name}, ${area}` : result.name,
      latitude: result.latitude,
      longitude: result.longitude,
    });
    this.query.set('');
  }
}
