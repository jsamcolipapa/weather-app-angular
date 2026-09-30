import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { CircleMarker, Map as LeafletMap, TileLayer } from 'leaflet';
import { Place, RainViewerMaps } from '../../../models/weather.models';
import { MAP_TILE_URL, RAINVIEWER_URL } from '../../../services/weather.service';

const ZOOM = 7;
/** RainViewer only serves radar tiles up to this zoom; Leaflet scales them beyond it. */
const RADAR_MAX_ZOOM = 7;

/** Map around `place` with the latest RainViewer radar frame on top. Loads Leaflet on demand. */
@Component({
  selector: 'app-rain-map',
  imports: [DatePipe],
  templateUrl: './rain-map.html',
  styleUrl: './rain-map.scss',
})
export class RainMap {
  readonly place = input.required<Place>();

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly maps = httpResource<RainViewerMaps>(() => RAINVIEWER_URL);

  private map?: LeafletMap;
  private marker?: CircleMarker;
  private radar?: TileLayer;
  private leaflet?: typeof import('leaflet');
  /** Set once Leaflet has loaded and the map exists, so effects below can use it. */
  private readonly ready = signal(false);

  /** Latest radar frame, newest last in RainViewer's list. */
  protected readonly frame = computed(() => {
    const maps = this.maps.hasValue() ? this.maps.value() : undefined;
    const latest = maps?.radar.past.at(-1);
    return latest && maps
      ? {
          url: `${maps.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`,
          time: new Date(latest.time * 1000),
        }
      : undefined;
  });
  protected readonly radarError = computed(() => !!this.maps.error());

  constructor() {
    afterNextRender(async () => {
      // Leaflet is a CommonJS/UMD package, so the whole library is its default export.
      const L = (await import('leaflet')).default;
      const { latitude, longitude } = this.place();
      const map = L.map(this.container().nativeElement).setView([latitude, longitude], ZOOM);
      L.tileLayer(MAP_TILE_URL, {
        maxZoom: 12,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      this.marker = L.circleMarker([latitude, longitude], {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: '#4b5fd6',
        fillOpacity: 1,
      }).addTo(map);
      this.leaflet = L;
      this.map = map;
      this.ready.set(true);
    });

    // Follow the selected place.
    effect(() => {
      const { latitude, longitude } = this.place();
      if (this.ready()) {
        this.map!.setView([latitude, longitude], ZOOM);
        this.marker!.setLatLng([latitude, longitude]);
      }
    });

    // Swap in the newest radar frame whenever it changes.
    effect(() => {
      const frame = this.frame();
      if (!this.ready() || !frame) {
        return;
      }
      this.radar?.remove();
      this.radar = this.leaflet!.tileLayer(frame.url, {
        opacity: 0.7,
        maxNativeZoom: RADAR_MAX_ZOOM,
        attribution: '<a href="https://www.rainviewer.com/">RainViewer</a>',
      }).addTo(this.map!);
    });

    inject(DestroyRef).onDestroy(() => this.map?.remove());
  }
}
