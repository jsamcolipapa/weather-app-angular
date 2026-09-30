# Weather

A weather dashboard built with Angular 22 and Angular Material. Live at
**https://jsamcolipapa.github.io/weather-app-angular/**.

## Features

- **Now:** current conditions, feels-like, comparison with yesterday, what to wear and the best
  2-hour window to be outside.
- **Forecast:** next 24 hours (with a temperature and rain-chance chart) or 7 days; click a day
  for its hourly breakdown, rain total, wind and UV.
- **Highlights:** UV, wind (km/h, mph or m/s), sunrise and sunset, humidity, visibility, air
  quality with pollutants, day length, golden hour and moon phase.
- **Rain:** a heads-up when rain starts or stops within the hour, optional browser notifications,
  and an animated radar map.
- **Places:** search, device location, saved places with live temperatures, and sharing.
- **Look:** the sky, panels and an animated backdrop follow the time of day and the weather.
- **App:** installable, works offline with the last forecast, remembers your settings.

Weather data comes from free, key-less services: [Open-Meteo](https://open-meteo.com/) (forecast,
air quality), [Photon](https://photon.komoot.io/) (search),
[BigDataCloud](https://www.bigdatacloud.com/) (place names),
[RainViewer](https://www.rainviewer.com/) (radar) and
[OpenStreetMap](https://www.openstreetmap.org/) (map tiles).

## Getting started

Requires **Node.js 22.22.3 or newer** (Node 24 recommended).

```bash
npm install
npm start          # http://localhost:4200
```

### Endpoints (`.env`)

API URLs are read from a `.env` file in the project root, which `scripts/set-env.mjs` turns into
`src/environments/environment.ts` before every start, build and test. Real environment variables
override the file. `.env` is not committed; create it with:

```env
FORECAST_URL=https://api.open-meteo.com/v1/forecast
AIR_QUALITY_URL=https://air-quality-api.open-meteo.com/v1/air-quality
SEARCH_URL=https://photon.komoot.io/api/
REVERSE_GEOCODE_URL=https://api.bigdatacloud.net/data/reverse-geocode-client
RAINVIEWER_URL=https://api.rainviewer.com/public/weather-maps.json
MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

These URLs end up in the browser bundle, so don't put secrets in `.env`.

## Scripts

| Command         | What it does                                                        |
| --------------- | ------------------------------------------------------------------- |
| `npm start`     | Dev server with reload on http://localhost:4200                     |
| `npm test`      | Unit tests (Vitest, jsdom); add `-- --watch=false` for a single run |
| `npm run build` | Production build into `dist/weather-app-angular/browser`            |
| `npm run env`   | Regenerate `environment.ts` from `.env`                             |

The service worker only runs in production builds. To try offline mode or installing, serve the
build output, e.g. `npx http-server dist/weather-app-angular/browser`.

## Project structure

```
src/app/
├── models/     # API response types and pure helpers (formatting, rain, outfit, moon…)
├── services/   # WeatherService (API calls), PreferencesService (localStorage), notify
└── pages/home/ # Home page and its sections: current-conditions, forecast-strip,
                # highlights, hourly-chart, day-details, rain-map, saved-places,
                # place-search, weather-backdrop
```

## Deployment

`.github/workflows/deploy.yml` runs the tests and a build on every pull request. On pushes to
`main` it also publishes the build to GitHub Pages (only if the tests pass). The endpoint URLs
above are the workflow's defaults; set a repository variable with the same name to override one.

One-time setup: **Settings → Pages → Source: GitHub Actions**.
