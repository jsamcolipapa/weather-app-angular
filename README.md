# Weather

A weather dashboard built with Angular 22 and Angular Material. Live at
**https://jsamcolipapa.github.io/weather-app-angular/**.

## Features

- **Now:** current conditions, feels-like, comparison with yesterday, what to wear and the best
  2-hour window to be outside.
- **Forecast:** next 24 hours (with a chart of temperature, wind or UV over the chance of rain),
  7 days or 14 days; click a day for its hourly breakdown, rain total, wind, gusts and UV.
- **Highlights:** UV, wind and gusts (km/h, mph or m/s), sunrise and sunset, humidity, visibility,
  air quality with pollutants, dew point, pressure, cloud cover, day length, golden hour and moon
  phase.
- **Alerts:** a heads-up when rain starts or stops within the hour, warnings for very high UV,
  strong gusts, frost, extreme heat and unhealthy air in the next 24 hours, and optional browser
  notifications for each (sent while the app is open in a background tab).
- **Rain radar:** an animated map of the last two hours.
- **Places:** search, device location, saved places with live temperatures, and sharing a link
  that opens the same place (`?lat=…&lon=…&name=…`).
- **Settings:** °C/°F, wind unit, 12- or 24-hour clock, rain in millimetres or inches.
- **Look:** the sky, panels and an animated backdrop follow the time of day and the weather. On
  wide screens the space around the dashboard shows the sun or the moon in its phase, clouds
  matching the cloud cover, and a horizon.
- **App:** installable, works offline with the last forecast (and says how old it is), remembers
  your settings.

## Getting started

Requires **Node.js 22.22.3 or newer** (Node 24 recommended).

```bash
npm install
npm start          # http://localhost:4200
```

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
├── models/     # API response types and pure helpers (formatting, rain, alerts, outfit, moon…)
├── services/   # WeatherService (API calls), PreferencesService (localStorage), notify
└── pages/home/ # Home page and its sections: current-conditions, forecast-strip,
                # highlights, hourly-chart, day-details, rain-map, saved-places,
                # place-search, settings-menu, weather-backdrop
```

## Deployment

`.github/workflows/deploy.yml` runs the tests and a build on every pull request. On pushes to
`main` it also publishes the build to GitHub Pages (only if the tests pass). The endpoint URLs
above are the workflow's defaults; set a repository variable with the same name to override one.

One-time setup: **Settings → Pages → Source: GitHub Actions**.
