import * as turf from "@turf/turf";
import { destinationPoint, hashString, lineLengthKm, seededRandom, smoothNoise } from "./geo";
import type { CreateRunRequest, Environment, LatLng, RouteCandidate } from "./types";
import type { RouteAttributes } from "./scoring";
import { explainRoute, recommendationLine, scoreRoute } from "./scoring";
import { analyzeTerrain, sampleElevationProfile } from "./elevation";
import { findFacilitiesAlongRoute } from "./facilities";
import { getWeatherSummary } from "./weather";

interface CandidateTheme {
  name: string;
  bearingOffsetDeg: number;
  attributes: RouteAttributes;
}

/** Builds 3 differentiated "characters" for the route options so they read
 * like genuinely different routes (not 3 copies of the same line), themed
 * around whichever environment(s) the user picked. This is the piece a
 * real routing engine + land-use data would otherwise produce. */
function buildCandidateThemes(environment: Environment[]): CandidateTheme[] {
  const has = (e: Environment) => environment.includes(e);

  const themes: CandidateTheme[] = [
    {
      name: "Balanced Route",
      bearingOffsetDeg: 0,
      attributes: { trafficExposure: 40, isolationRisk: 25, lightingQuality: 65, sceneryValue: 55, shadeCoverage: 45, environmentTags: environment.length ? environment : ["running_paths"] },
    },
    {
      name: has("waterfront") ? "Waterfront Loop" : has("nature_parks") ? "Park & Nature Route" : "Scenic Alternate",
      bearingOffsetDeg: 130,
      attributes: {
        trafficExposure: has("city_streets") ? 45 : 18,
        isolationRisk: has("waterfront") || has("nature_parks") ? 35 : 20,
        lightingQuality: 55,
        sceneryValue: has("waterfront") || has("nature_parks") || has("landmarks") ? 85 : 65,
        shadeCoverage: has("nature_parks") ? 80 : 55,
        environmentTags: environment.length ? environment : ["nature_parks", "waterfront"],
      },
    },
    {
      name: has("city_streets") ? "City Streets Route" : has("running_paths") ? "Dedicated Path Route" : "Efficient Route",
      bearingOffsetDeg: 250,
      attributes: {
        trafficExposure: has("city_streets") ? 65 : 30,
        isolationRisk: has("city_streets") || has("landmarks") ? 10 : 20,
        lightingQuality: has("city_streets") || has("landmarks") ? 85 : 60,
        sceneryValue: has("landmarks") ? 75 : 45,
        shadeCoverage: has("running_paths") ? 70 : 35,
        environmentTags: environment.length ? environment : ["city_streets"],
      },
    },
  ];
  return themes;
}

function buildLoopCoords(start: LatLng, targetKm: number, bearingDeg: number, seed: number): [number, number][] {
  const rand = seededRandom(seed);
  const vertexCount = 20;
  let radiusKm = targetKm / (2 * Math.PI);
  let coords: [number, number][] = [];

  for (let iter = 0; iter < 3; iter++) {
    const center = destinationPoint(start, bearingDeg, radiusKm);
    coords = [];
    for (let i = 0; i <= vertexCount; i++) {
      const angle = (360 * i) / vertexCount;
      const jitter = 1 + smoothNoise(i + seed * 0.01, seed) * 0.18 * rand();
      const p = destinationPoint(center, (bearingDeg + 180 + angle) % 360, radiusKm * jitter);
      coords.push([p.lng, p.lat]);
    }
    // force an exact closed loop starting/ending at the real start point
    coords[0] = [start.lng, start.lat];
    coords[coords.length - 1] = [start.lng, start.lat];

    const actualKm = lineLengthKm(coords);
    if (actualKm === 0) break;
    radiusKm *= targetKm / actualKm;
  }
  return coords;
}

function buildPointToPointCoords(start: LatLng, targetKm: number, bearingDeg: number, seed: number): [number, number][] {
  const rand = seededRandom(seed);
  const legCount = 6;
  let coords: [number, number][] = [];
  let scale = targetKm / legCount;

  for (let iter = 0; iter < 3; iter++) {
    coords = [[start.lng, start.lat]];
    let current = start;
    for (let i = 0; i < legCount; i++) {
      const wobble = (rand() - 0.5) * 50;
      const legBearing = bearingDeg + wobble * Math.sin(i);
      current = destinationPoint(current, legBearing, scale);
      coords.push([current.lng, current.lat]);
    }
    const actualKm = lineLengthKm(coords);
    if (actualKm === 0) break;
    scale *= targetKm / actualKm;
  }
  return coords;
}

/** Best-effort OpenRouteService round-trip / directions call. Falls back
 * to the synthetic generator above on any error (missing key, rate limit,
 * network unavailable, unsupported profile, etc.) so the app always works. */
async function tryOpenRouteService(
  start: LatLng,
  targetKm: number,
  routeType: CreateRunRequest["routeType"],
  seed: number
): Promise<[number, number][] | null> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return null;

  try {
    if (routeType === "loop") {
      const res = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking/geojson", {
        method: "POST",
        headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: [[start.lng, start.lat]],
          options: { round_trip: { length: targetKm * 1000, points: 5, seed } },
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`ORS ${res.status}`);
      const data = await res.json();
      return data.features?.[0]?.geometry?.coordinates ?? null;
    } else {
      const rand = seededRandom(seed);
      const end = destinationPoint(start, rand() * 360, targetKm);
      const res = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking/geojson", {
        method: "POST",
        headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: [[start.lng, start.lat], [end.lng, end.lat]] }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`ORS ${res.status}`);
      const data = await res.json();
      return data.features?.[0]?.geometry?.coordinates ?? null;
    }
  } catch {
    return null;
  }
}

export async function generateRouteCandidates(req: CreateRunRequest): Promise<RouteCandidate[]> {
  const start: LatLng = { lat: req.startLat, lng: req.startLng };
  const baseSeed = hashString(
    `${req.startLat.toFixed(3)}:${req.startLng.toFixed(3)}:${req.distanceKm}:${req.routeType}:${JSON.stringify(req.preferences)}`
  );

  const weather = await getWeatherSummary(start);
  const themes = buildCandidateThemes(req.preferences.environment);

  const candidates = await Promise.all(
    themes.map(async (theme, idx) => {
      const seed = baseSeed + idx * 7919;
      const bearing = (theme.bearingOffsetDeg + (seed % 360)) % 360;

      let coords: [number, number][] | null = await tryOpenRouteService(start, req.distanceKm, req.routeType, seed);
      let source: RouteCandidate["source"] = "openrouteservice";
      if (!coords || coords.length < 2) {
        coords = req.routeType === "loop" ? buildLoopCoords(start, req.distanceKm, bearing, seed) : buildPointToPointCoords(start, req.distanceKm, bearing, seed);
        source = "synthetic";
      }

      const line = turf.lineString(coords) as GeoJSON.Feature<GeoJSON.LineString>;
      const actualDistanceKm = lineLengthKm(coords);

      const sampleEvery = Math.max(1, Math.floor(coords.length / Math.max(8, Math.round(actualDistanceKm * 5))));
      const sampledCoords = coords.filter((_, i) => i % sampleEvery === 0);
      const { elevationsM, isEstimated } = await sampleElevationProfile(sampledCoords, { terrain: req.preferences.terrain, seed });
      const terrain = analyzeTerrain(elevationsM, isEstimated);

      const { hydration, toilet, shelter } = await findFacilitiesAlongRoute(line, actualDistanceKm);

      const scores = scoreRoute({
        attributes: theme.attributes,
        terrain,
        distanceKm: actualDistanceKm,
        targetDistanceKm: req.distanceKm,
        hydrationPoints: hydration,
        toiletPoints: toilet,
        shelterPoints: shelter,
        weather,
        preferences: req.preferences,
      });

      const explanation = explainRoute(scores, req.preferences, theme.attributes);
      // walking/running pace estimate: ~6:00 min/km base, slower for hillier terrain
      const paceMinPerKm = 6 + terrain.elevationGainM / 400;

      const candidate: RouteCandidate = {
        id: `${seed}`,
        name: theme.name,
        geojson: line,
        distanceKm: Math.round(actualDistanceKm * 100) / 100,
        estimatedDurationMin: Math.round(actualDistanceKm * paceMinPerKm),
        routeType: req.routeType,
        terrain,
        scores,
        hydrationPoints: hydration,
        toiletPoints: toilet,
        shelterPoints: shelter,
        weatherSummary: weather,
        explanation,
        recommendation: null,
        source,
      };
      return candidate;
    })
  );

  candidates.sort((a, b) => b.scores.overallScore - a.scores.overallScore);
  if (candidates[0]) {
    candidates[0].recommendation = recommendationLine(candidates[0].name, candidates[0].scores);
  }
  return candidates;
}
