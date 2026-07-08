# AI Running Route Planner

A hackathon MVP of an AI-powered running route planner: tell it a starting point, a distance, and a set of fixed preferences (terrain, environment, traffic, safety, scenery, hydration, toilets, shade, timing), and it generates a few ranked, scored route options with an AI-style explanation, then lets you run and save them.

Built per the product spec in `hacks.md`: route intelligence first, tracker second.

## Stack

- **Frontend/Backend:** Next.js 14 (App Router) + TypeScript + Tailwind + hand-rolled shadcn-style UI primitives
- **DB:** PostgreSQL + PostGIS (via Docker Compose), Prisma ORM
- **Maps:** Leaflet + OpenStreetMap tiles (no API key required)
- **Routing:** OpenRouteService if you provide a free API key, otherwise a deterministic synthetic geometric route generator (so the app works with zero external keys)
- **Facilities:** OpenStreetMap Overpass API (hydration/toilets/shelter), with a PostGIS `ST_DWithin` fallback against seeded data
- **Weather:** Open-Meteo (free, no key)
- **Elevation:** Open-Elevation (free, no key), with a synthetic fallback shaped by your terrain preference if unreachable

## Quick start

```bash
npm install
docker compose up -d          # starts Postgres+PostGIS on localhost:5432
cp .env.example .env          # defaults already match docker-compose.yml
npx prisma migrate dev --name init
psql "$DATABASE_URL" -f prisma/postgis.sql   # enables PostGIS + spatial index
npm run db:seed               # seeds a handful of demo facilities (Singapore)
npm run dev
```

Open http://localhost:3000. No API keys are required for a full working demo — Mapbox/ORS/weather/elevation calls all have graceful fallbacks.

To unlock real road-snapped routing, add a free [OpenRouteService](https://openrouteservice.org/dev/#/signup) key to `.env` as `ORS_API_KEY`.

## What's implemented

- **Location setup:** current-location detection (browser geolocation), Home/Hotel/Custom presets, location-familiarity preference
- **Create run:** distance (fixed options + custom) and route type (loop / point-to-point)
- **Preferences:** all fixed dropdowns/multi-select (terrain, environment, traffic, safety, scenery, hydration, toilet, shade, timing) — no free text, converted into route scoring weights (`src/lib/scoring.ts`)
- **AI route generation:** 3 differentiated route candidates per request (`src/lib/routing.ts`), each scored on safety/scenery/traffic/convenience/shade/weather-protection + an overall preference-weighted match score
- **Route summary screen:** map preview, elevation/difficulty, all scores, hydration/toilet/shelter km-markers, weather warnings, AI explanation + recommendation
- **Route selection → running mode:** GPS-based live tracking (`src/components/RunTracker.tsx`) with a "simulate run" fallback for demoing indoors, distance/pace/elapsed/progress
- **Post-run analysis:** distance/pace/elevation summary, GPX export (Garmin/Apple Watch/Strava/Coros-compatible), and a naive but real preference-learning loop ("you usually prefer...") backed by `PreferenceProfile` tallies that update after every completed run
- **Route history:** `/history` page listing past runs and their status

## What's simplified for the MVP

- No auth — everything runs under a single shared `demo-user` (see `src/lib/preferences.ts`) so preference learning has somewhere to accumulate. Swap in real auth later; the schema already has a `User` model.
- Route geometry is stored as GeoJSON (`Json` column) rather than a native PostGIS `geometry` column, to keep Prisma simple. The `Facility` table does get a real PostGIS `geography(Point,4326)` column + GiST index (`prisma/postgis.sql`), and nearby-facility search genuinely uses `ST_DWithin` — see `GET /api/facilities` and `src/lib/facilities.ts`.
- Without an `ORS_API_KEY`, routes are synthetic geometric shapes (loops/out-and-back paths sized to your target distance) rather than real road-snapped paths — clearly labelled `source: "synthetic"` vs `"openrouteservice"` in the API response.
- Elevation is real (Open-Elevation) when reachable, otherwise a synthetic profile shaped by your terrain preference (flagged `isEstimated`).

## Project structure

```
src/
  app/                # pages + API routes (App Router)
  components/         # LocationPicker, PreferenceForm, RouteCard, RouteMap, RunTracker, ...
  lib/                # scoring engine, route generation, facilities, weather, elevation, gpx, db
  store/               # zustand store carrying the in-progress run flow across pages
prisma/
  schema.prisma        # data model
  postgis.sql          # PostGIS extension + spatial column/index + example query
  seed.ts               # demo facility seed data
```

## Roadmap (from the original spec, not yet built)

- FIT/TCX export (GPX is done)
- Adaptive/ML-based preference learning beyond simple tallies
- Real-time weather-triggered re-routing mid-run
