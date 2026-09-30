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
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { CircleMarker, Map as LeafletMap, TileLayer } from 'leaflet';
import { Place, RainViewerMaps } from '../../../models/weather.models';
import { MAP_TILE_URL, RAINVIEWER_URL } from '../../../services/weather.service';

const ZOOM = 7;
/** RainViewer only serves radar tiles up to this zoom; Leaflet scales them beyond it. */
const RADAR_MAX_ZOOM = 7;
const RADAR_OPACITY = 0.7;
/** Time each frame stays on screen while playing. */
const FRAME_MS = 600;

/**
 * Map around `place` with RainViewer radar on top: the latest frame by default, or the last
 * ~2 hours played back as an animation. Loads Leaflet on demand.
 */
@Component({
  selector: 'app-rain-map',
  imports: [DatePipe, MatIconModule],
  templateUrl: './rain-map.html',
  styleUrl: './rain-map.scss',
})
export class RainMap {
  readonly place = input.required<Place>();

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly maps = httpResource<RainViewerMaps>(() => RAINVIEWER_URL);

  private map?: LeafletMap;
  private marker?: CircleMarker;
  /** One tile layer per frame, all added up front so playback doesn't wait on tiles. */
  private radarLayers: TileLayer[] = [];
  private leaflet?: typeof import('leaflet');
  private timer?: ReturnType<typeof setInterval>;
  /** Set once Leaflet has loaded and the map exists, so effects below can use it. */
  private readonly ready = signal(false);

  /** Radar frames, oldest first (RainViewer keeps about 2 hours at 10-minute steps). */
  protected readonly frames = computed(() => {
    const maps = this.maps.hasValue() ? this.maps.value() : undefined;
    return (maps?.radar.past ?? []).map((frame) => ({
      url: `${maps!.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
      time: new Date(frame.time * 1000),
    }));
  });

  /** Frame on screen; starts on (and resets to) the latest when new frames arrive. */
  protected readonly frameIndex = linkedSignal(() => this.frames().length - 1);
  protected readonly frame = computed(() => this.frames()[this.frameIndex()]);
  protected readonly isLatest = computed(() => this.frameIndex() === this.frames().length - 1);
  protected readonly playing = signal(false);
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

    // (Re)build one layer per frame whenever the frame list changes. Only the latest starts
    // visible, matching `frameIndex`, which resets to it at the same time.
    effect(() => {
      const frames = this.frames();
      if (!this.ready()) {
        return;
      }
      this.radarLayers.forEach((layer) => layer.remove());
      this.radarLayers = frames.map((frame, i) =>
        this.leaflet!.tileLayer(frame.url, {
          opacity: i === frames.length - 1 ? RADAR_OPACITY : 0,
          maxNativeZoom: RADAR_MAX_ZOOM,
          attribution: '<a href="https://www.rainviewer.com/">RainViewer</a>',
        }).addTo(this.map!),
      );
    });

    // Show only the selected frame.
    effect(() => {
      const index = this.frameIndex();
      if (this.ready()) {
        this.radarLayers.forEach((layer, i) => layer.setOpacity(i === index ? RADAR_OPACITY : 0));
      }
    });

    inject(DestroyRef).onDestroy(() => {
      this.stop();
      this.map?.remove();
    });
  }

  protected togglePlay() {
    if (this.playing()) {
      this.stop();
      return;
    }
    // Start from the oldest frame when playing from the end, so the whole loop is shown.
    if (this.isLatest()) {
      this.frameIndex.set(0);
    }
    this.playing.set(true);
    this.timer = setInterval(() => {
      const count = this.frames().length;
      this.frameIndex.update((i) => (i + 1) % count);
    }, FRAME_MS);
  }

  protected scrub(event: Event) {
    this.stop();
    this.frameIndex.set(Number((event.target as HTMLInputElement).value));
  }

  private stop() {
    clearInterval(this.timer);
    this.playing.set(false);
  }
}
