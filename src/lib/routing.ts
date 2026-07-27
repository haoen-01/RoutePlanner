import * as turf from "@turf/turf";
import { bearingBetween, destinationPoint, distanceKm as distBetween, hashString, lineLengthKm, seededRandom, smoothNoise } from "./geo";
import type { CreateRunRequest, Environment, LatLng, RouteCandidate } from "./types";
import type { RouteAttributes } from "./scoring";
import { scoreRoute } from "./scoring";
import { analyzeTerrain, sampleElevationProfile } from "./elevation";
import { findFacilitiesAlongRoute } from "./facilities";
import { getWeatherSummary } from "./weather";
import { deriveRouteAttributes, fetchCorridorFeatures } from "./osmAttributes";
import { applyExplanations } from "./ai";

interface CandidateTheme {
  name: string;
  bearingOffsetDeg: number;
  attributes: RouteAttributes;
}

/** Fallback "characters" for the 3 route options, used only when live OSM
 * corridor data is unreachable (offline demo). When OSM data is available,
 * attributes are derived from real map features instead — see
 * `deriveRouteAttributes` in osmAttributes.ts. */
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

/** Point-to-point synthetic path. If the user picked a destination, the
 * path genuinely starts at `start` and ends at `end`, adding perpendicular
 * "wobble" that is scaled until total length matches the target distance.
 * Without a destination it heads off on `bearingDeg` as before. */
function buildPointToPointCoords(start: LatLng, targetKm: number, bearingDeg: number, seed: number, end?: LatLng | null): [number, number][] {
  const rand = seededRandom(seed);
  const legCount = 8;

  if (end) {
    const directKm = distBetween(start, end);
    const baseBearing = bearingBetween(start, end);
    let wobbleKm = Math.max(0, (targetKm - directKm) / legCount);
    let coords: [number, number][] = [];

    for (let iter = 0; iter < 4; iter++) {
      coords = [[start.lng, start.lat]];
      for (let i = 1; i < legCount; i++) {
        const f = i / legCount;
        // point along the direct line
        const along = destinationPoint(start, baseBearing, directKm * f);
        // perpendicular offset, alternating sides, zero at both ends
        const side = i % 2 === 0 ? 90 : -90;
        const offset = wobbleKm * Math.sin(Math.PI * f) * (0.6 + rand() * 0.8);
        const p = destinationPoint(along, baseBearing + side, offset);
        coords.push([p.lng, p.lat]);
      }
      coords.push([end.lng, end.lat]);
      const actualKm = lineLengthKm(coords);
      if (actualKm === 0 || Math.abs(actualKm - targetKm) / targetKm < 0.05) break;
      wobbleKm = Math.max(0, wobbleKm * (targetKm - directKm + 0.01) / Math.max(0.01, actualKm - directKm));
      wobbleKm = Math.min(wobbleKm, targetKm / 4);
    }
    return coords;
  }

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

/** Waypoints that stretch a point-to-point route to the target distance.
 * Routing engines return the SHORTEST path between two points, so a 5km
 * request with a 2.7km-apart endpoint would come back as 2.7km. We insert
 * perpendicular detour via-points along the direct line and solve their
 * offset (bisection on geometric length) so the polyline start -> vias ->
 * end measures ~targetKm; the road-snapped route then lands near it too.
 * Returns null when the target is barely longer than the direct path
 * (or unreachable), meaning: just route directly. */
export function p2pViaPoints(start: LatLng, end: LatLng, targetKm: number, seed: number): [number, number][] | null {
  const directKm = distBetween(start, end);
  if (directKm === 0 || targetKm <= directKm * 1.08) return null;

  const rand = seededRandom(seed);
  const baseBearing = bearingBetween(start, end);
  const viaCount = Math.min(3, Math.max(1, Math.round(targetKm / directKm)));
  const startSide = Math.abs(seed) % 2 === 0 ? 90 : -90; // per-candidate variety
  const jitters = Array.from({ length: viaCount }, () => (rand() - 0.5) * 0.25);

  const build = (w: number): [number, number][] => {
    const vias: [number, number][] = [];
    for (let i = 1; i <= viaCount; i++) {
      const f = Math.min(0.9, Math.max(0.1, (i + jitters[i - 1]) / (viaCount + 1)));
      const along = destinationPoint(start, baseBearing, directKm * f);
      const side = i % 2 === 1 ? startSide : -startSide;
      const p = destinationPoint(along, baseBearing + side, w * Math.sin(Math.PI * f));
      vias.push([p.lng, p.lat]);
    }
    return vias;
  };

  const lengthWith = (w: number) => lineLengthKm([[start.lng, start.lat], ...build(w), [end.lng, end.lat]]);

  // bisection on the perpendicular offset
  let lo = 0;
  let hi = targetKm;
  for (let i = 0; i < 25; i++) {
    const mid = (lo + hi) / 2;
    if (lengthWith(mid) < targetKm) lo = mid;
    else hi = mid;
  }
  const w = (lo + hi) / 2;
  return build(w);
}

/** Waypoints for a road-snapped loop headed in a specific compass
 * direction. ORS's round_trip "seed" option is only a weak randomiser and
 * frequently returns the SAME loop for different seeds, which made all 3
 * candidates identical. Instead we route start -> w1 -> w2 -> start with
 * the waypoints placed along `bearingDeg` (each candidate gets a different
 * bearing), radius solved by bisection so the geometric loop measures
 * ~targetKm. Guaranteed geographically distinct candidates. */
export function loopViaPoints(start: LatLng, targetKm: number, bearingDeg: number, seed: number): [number, number][] {
  const rand = seededRandom(seed);
  const spreadDeg = 35 + rand() * 20; // angular spread between the two waypoints

  const build = (r: number): [number, number][] => {
    const w1 = destinationPoint(start, (bearingDeg - spreadDeg + 360) % 360, r);
    const w2 = destinationPoint(start, (bearingDeg + spreadDeg) % 360, r);
    return [
      [w1.lng, w1.lat],
      [w2.lng, w2.lat],
    ];
  };

  const lengthWith = (r: number) =>
    lineLengthKm([[start.lng, start.lat], ...build(r), [start.lng, start.lat]]);

  let lo = 0.05;
  let hi = targetKm;
  for (let i = 0; i < 25; i++) {
    const mid = (lo + hi) / 2;
    if (lengthWith(mid) < targetKm) lo = mid;
    else hi = mid;
  }
  return build((lo + hi) / 2);
}

/** Best-effort OpenRouteService round-trip / directions call. Falls back
 * to the synthetic generator above on any error (missing key, rate limit,
 * network unavailable, unsupported profile, etc.) so the app always works. */
async function tryOpenRouteService(
  start: LatLng,
  targetKm: number,
  routeType: CreateRunRequest["routeType"],
  seed: number,
  bearingDeg: number,
  end?: LatLng | null
): Promise<[number, number][] | null> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return null;

  const directions = async (coords: [number, number][]) => {
    const res = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking/geojson", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      // 350m is the public API's maximum snapping radius (larger values,
      // including -1/unlimited, are REJECTED and would fail the request).
      // Waypoints are pre-snapped onto roads via snapToRoads() below, so
      // 350m of slack is enough.
      body: JSON.stringify({ coordinates: coords, radiuses: coords.map(() => 350) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`ORS directions failed: ${res.status} ${detail.slice(0, 200)}`);
      throw new Error(`ORS ${res.status}`);
    }
    const data = await res.json();
    return (data.features?.[0]?.geometry?.coordinates ?? null) as [number, number][] | null;
  };

  /** Pre-snap waypoints onto the road network with ORS's snap service
   * (up to ~5km search), so vias placed in parks/reservoirs/water by the
   * geometric solver become routable instead of failing the request.
   * Best-effort: on any error the original points are returned. */
  const snapToRoads = async (points: [number, number][]): Promise<[number, number][]> => {
    if (!points.length) return points;
    try {
      const res = await fetch("https://api.openrouteservice.org/v2/snap/foot-walking", {
        method: "POST",
        headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ locations: points, radius: 4900 }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`snap ${res.status}`);
      const data = await res.json();
      const snapped = (data?.locations ?? []) as ({ location: [number, number] } | null)[];
      return points.map((p, i) => snapped[i]?.location ?? p);
    } catch {
      return points;
    }
  };

  /** Runs `attempt(km)` then, if the result misses targetKm by >15%, one
   * corrected attempt with the km budget scaled by the observed error.
   * Returns whichever result lands closest to the target. */
  const withCorrection = async (
    attempt: (km: number) => Promise<[number, number][] | null>,
    minKm: number,
    maxKm: number
  ): Promise<[number, number][] | null> => {
    const clamp = (km: number) => Math.min(maxKm, Math.max(minKm, km));
    let best: [number, number][] | null = null;
    let bestErr = Infinity;
    let budget = targetKm;
    for (let i = 0; i < 2; i++) {
      const coords = await attempt(clamp(budget));
      if (coords && coords.length >= 2) {
        const actual = lineLengthKm(coords);
        const err = Math.abs(actual - targetKm) / targetKm;
        if (err < bestErr) {
          best = coords;
          bestErr = err;
        }
        if (err <= 0.15 || actual === 0) break;
        budget = clamp(budget * (targetKm / actual));
      } else {
        break;
      }
    }
    return best;
  };

  try {
    if (routeType === "loop") {
      const loopAttempt = async (km: number) => {
        const vias = await snapToRoads(loopViaPoints(start, km, bearingDeg, seed));
        return directions([[start.lng, start.lat], ...vias, [start.lng, start.lat]]);
      };
      let coords: [number, number][] | null = null;
      try {
        coords = await withCorrection(loopAttempt, targetKm * 0.3, targetKm * 3);
      } catch {
        coords = null;
      }
      // Sanity: a "loop" much shorter than half the target is useless —
      // prefer the round_trip fallback over returning nonsense.
      if (coords && lineLengthKm(coords) >= targetKm * 0.5) return coords;

      const res = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking/geojson", {
        method: "POST",
        headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: [[start.lng, start.lat]],
          options: { round_trip: { length: targetKm * 1000, points: 4 + (Math.abs(seed) % 3), seed: Math.abs(seed) % 1000 } },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`ORS ${res.status}`);
      const data = await res.json();
      return data.features?.[0]?.geometry?.coordinates ?? null;
    } else {
      const rand = seededRandom(seed);
      const target = end ?? destinationPoint(start, rand() * 360, targetKm);
      const directKm = distBetween(start, target);

      const p2pAttempt = async (km: number) => {
        const vias = await snapToRoads(p2pViaPoints(start, target, km, seed) ?? []);
        return directions([[start.lng, start.lat], ...vias, [target.lng, target.lat]]);
      };
      let coords: [number, number][] | null = null;
      try {
        coords = await withCorrection(p2pAttempt, Math.max(directKm * 1.05, targetKm * 0.3), targetKm * 3);
      } catch {
        // vias unroutable even with unlimited snapping — try direct
        coords = await directions([[start.lng, start.lat], [target.lng, target.lat]]);
      }
      // Sanity: judge against the TARGET distance. The old check compared
      // against the direct distance, which the direct-fallback route always
      // passes by definition — that let a 1.5km shortest-path masquerade as
      // a 15km run. If we needed detours (target well beyond direct) and
      // still came back far short, reject: an honest "Estimated shape" at
      // the right distance beats a real road route at the wrong distance.
      if (coords && targetKm > directKm * 1.2 && lineLengthKm(coords) < targetKm * 0.6) {
        console.warn(`ORS p2p route too short (${lineLengthKm(coords).toFixed(1)}km vs ${targetKm}km target) — using synthetic fallback`);
        return null;
      }
      return coords;
    }
  } catch {
    return null;
  }
}

/** Bounding box covering everywhere a candidate could plausibly go, used
 * for the single shared OSM corridor query per generation. */
function generationBbox(start: LatLng, targetKm: number, end?: LatLng | null): [number, number, number, number] {
  const pts: [number, number][] = [];
  const reachKm = end ? Math.max(targetKm * 0.75, distBetween(start, end)) : targetKm * 0.75;
  for (const b of [0, 90, 180, 270]) {
    const p = destinationPoint(start, b, reachKm);
    pts.push([p.lng, p.lat]);
  }
  if (end) pts.push([end.lng, end.lat]);
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

export async function generateRouteCandidates(req: CreateRunRequest): Promise<RouteCandidate[]> {
  const start: LatLng = { lat: req.startLat, lng: req.startLng };
  const end: LatLng | null =
    req.routeType === "point_to_point" && typeof req.endLat === "number" && typeof req.endLng === "number"
      ? { lat: req.endLat, lng: req.endLng }
      : null;

  const baseSeed = hashString(
    `${req.startLat.toFixed(3)}:${req.startLng.toFixed(3)}:${req.distanceKm}:${req.routeType}:${JSON.stringify(req.preferences)}`
  );

  // One weather call + one OSM corridor query shared by all 3 candidates.
  const [weather, corridorFeatures] = await Promise.all([
    getWeatherSummary(start),
    fetchCorridorFeatures(generationBbox(start, req.distanceKm, end)),
  ]);
  const themes = buildCandidateThemes(req.preferences.environment);
  const attributesById = new Map<string, RouteAttributes>();

  const candidates = await Promise.all(
    themes.map(async (theme, idx) => {
      const seed = baseSeed + idx * 7919;
      const bearing = (theme.bearingOffsetDeg + (seed % 360)) % 360;

      // Stagger concurrent ORS calls slightly — burst rate-limiting is a
      // common cause of candidates degrading to synthetic shapes.
      if (idx > 0) await new Promise((r) => setTimeout(r, idx * 400));
      let coords: [number, number][] | null = await tryOpenRouteService(start, req.distanceKm, req.routeType, seed, bearing, end);
      let source: RouteCandidate["source"] = "openrouteservice";
      if (!coords || coords.length < 2) {
        coords = req.routeType === "loop" ? buildLoopCoords(start, req.distanceKm, bearing, seed) : buildPointToPointCoords(start, req.distanceKm, bearing, seed, end);
        source = "synthetic";
      }

      const line = turf.lineString(coords) as GeoJSON.Feature<GeoJSON.LineString>;
      const actualDistanceKm = lineLengthKm(coords);

      // Real map-derived attributes when OSM data is available; per-theme
      // fallback values otherwise.
      const { attributes, dataSource } = deriveRouteAttributes(line, corridorFeatures, theme.attributes);

      const sampleEvery = Math.max(1, Math.floor(coords.length / Math.max(8, Math.round(actualDistanceKm * 5))));
      const sampledCoords = coords.filter((_, i) => i % sampleEvery === 0);
      const { elevationsM, isEstimated } = await sampleElevationProfile(sampledCoords, { terrain: req.preferences.terrain, seed });
      const terrain = analyzeTerrain(elevationsM, isEstimated);

      const { hydration, toilet, shelter } = await findFacilitiesAlongRoute(line, actualDistanceKm, corridorFeatures);

      const scores = scoreRoute({
        attributes,
        terrain,
        distanceKm: actualDistanceKm,
        targetDistanceKm: req.distanceKm,
        hydrationPoints: hydration,
        toiletPoints: toilet,
        shelterPoints: shelter,
        weather,
        preferences: req.preferences,
      });

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
        explanation: "",
        recommendation: null,
        source,
        attributeSource: dataSource,
      };
      attributesById.set(candidate.id, attributes);
      return candidate;
    })
  );

  candidates.sort((a, b) => b.scores.overallScore - a.scores.overallScore);
  // Real LLM explanations when ANTHROPIC_API_KEY is set, templates otherwise.
  await applyExplanations(candidates, req.preferences, attributesById);
  return candidates;
}
