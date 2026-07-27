import * as turf from "@turf/turf";
import type { Environment } from "./types";
import type { RouteAttributes } from "./scoring";
import { overpassQuery, roundBbox } from "./overpass";

/** Categorised OpenStreetMap features for the whole generation area,
 * fetched once per (rounded) bbox and then filtered per candidate route.
 * Every feature is reduced to a representative point (node coords or way
 * `center`) which is plenty for corridor-coverage estimates at demo scale. */
export interface CorridorFeatures {
  majorRoads: [number, number][]; // [lng, lat]
  quietPaths: [number, number][]; // footway/cycleway/track/pedestrian
  litWays: [number, number][];
  parks: [number, number][];
  water: [number, number][];
  trees: [number, number][];
  amenities: [number, number][]; // shops/cafes/etc → "eyes on the street"
  landmarks: [number, number][]; // tourism attractions/monuments
  drinkingWater: { lat: number; lng: number; name: string | null }[];
  toilets: { lat: number; lng: number; name: string | null }[];
  shelters: { lat: number; lng: number; name: string | null }[];
}

const CORRIDOR_M = 250;

/** One combined Overpass query for everything route scoring + facility
 * lookup needs. Returns null on any failure so callers can fall back. */
export async function fetchCorridorFeatures(bboxIn: [number, number, number, number]): Promise<CorridorFeatures | null> {
  const [minLng, minLat, maxLng, maxLat] = roundBbox(bboxIn);
  const bb = `(${minLat},${minLng},${maxLat},${maxLng})`;
  const query = `[out:json][timeout:15];(
way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"]${bb};
way["highway"~"^(footway|cycleway|track|pedestrian|path)$"]${bb};
way["lit"="yes"]${bb};
way["leisure"~"^(park|garden|nature_reserve)$"]${bb};
way["landuse"~"^(forest|grass|recreation_ground)$"]${bb};
way["natural"~"^(water|wood|coastline)$"]${bb};
way["waterway"~"^(river|canal)$"]${bb};
node["natural"="tree"]${bb};
node["amenity"~"^(cafe|restaurant|shop|convenience|pharmacy|bank)$"]${bb};
node["shop"]${bb};
node["tourism"~"^(attraction|monument|viewpoint|artwork)$"]${bb};
node["historic"]${bb};
node["amenity"="drinking_water"]${bb};
node["amenity"="toilets"]${bb};
node["amenity"="shelter"]${bb};
node["railway"="station"]${bb};
way["shop"="mall"]${bb};
);out center 800;`;

  try {
    const data = await overpassQuery(query);
    const f: CorridorFeatures = {
      majorRoads: [], quietPaths: [], litWays: [], parks: [], water: [], trees: [],
      amenities: [], landmarks: [], drinkingWater: [], toilets: [], shelters: [],
    };
    for (const el of data.elements ?? []) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (typeof lat !== "number" || typeof lng !== "number") continue;
      const t = el.tags ?? {};
      const pt: [number, number] = [lng, lat];
      const name = t.name ?? null;

      if (t.amenity === "drinking_water") { f.drinkingWater.push({ lat, lng, name }); continue; }
      if (t.amenity === "toilets") { f.toilets.push({ lat, lng, name }); continue; }
      if (t.amenity === "shelter" || t.railway === "station" || t.shop === "mall") { f.shelters.push({ lat, lng, name }); continue; }

      if (/^(motorway|trunk|primary|secondary|tertiary)$/.test(t.highway ?? "")) f.majorRoads.push(pt);
      if (/^(footway|cycleway|track|pedestrian|path)$/.test(t.highway ?? "")) f.quietPaths.push(pt);
      if (t.lit === "yes") f.litWays.push(pt);
      if (/^(park|garden|nature_reserve)$/.test(t.leisure ?? "") || /^(forest|grass|recreation_ground)$/.test(t.landuse ?? "") || t.natural === "wood") f.parks.push(pt);
      if (t.natural === "water" || t.natural === "coastline" || /^(river|canal)$/.test(t.waterway ?? "")) f.water.push(pt);
      if (t.natural === "tree") f.trees.push(pt);
      if (t.amenity || t.shop) f.amenities.push(pt);
      if (t.tourism || t.historic) f.landmarks.push(pt);
    }
    return f;
  } catch {
    return null;
  }
}

/** Fraction (0-1) of ~250m-spaced sample points along the route that have
 * at least one feature of the category within the corridor buffer. */
function coverage(samples: [number, number][], features: [number, number][], radiusM = CORRIDOR_M): number {
  if (!samples.length || !features.length) return 0;
  const radiusKm = radiusM / 1000;
  let covered = 0;
  for (const s of samples) {
    for (const f of features) {
      if (turf.distance(s, f, { units: "kilometers" }) <= radiusKm) { covered++; break; }
    }
  }
  return covered / samples.length;
}

function countNear(samples: [number, number][], features: [number, number][], radiusM = CORRIDOR_M): number {
  if (!samples.length || !features.length) return 0;
  const radiusKm = radiusM / 1000;
  let n = 0;
  for (const f of features) {
    for (const s of samples) {
      if (turf.distance(s, f, { units: "kilometers" }) <= radiusKm) { n++; break; }
    }
  }
  return n;
}

export function sampleRoutePoints(line: GeoJSON.Feature<GeoJSON.LineString>, everyKm = 0.25): [number, number][] {
  const totalKm = turf.length(line, { units: "kilometers" });
  const samples: [number, number][] = [];
  for (let d = 0; d <= totalKm; d += everyKm) {
    samples.push(turf.along(line, d, { units: "kilometers" }).geometry.coordinates as [number, number]);
  }
  return samples;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Derive the scoring attributes for a specific candidate route from real
 * map data (instead of the hard-coded per-theme values). `fallback` is the
 * old theme attribute set, used when OSM data was unavailable. */
export function deriveRouteAttributes(
  line: GeoJSON.Feature<GeoJSON.LineString>,
  features: CorridorFeatures | null,
  fallback: RouteAttributes
): { attributes: RouteAttributes; dataSource: "osm" | "theme" } {
  if (!features) return { attributes: fallback, dataSource: "theme" };

  const samples = sampleRoutePoints(line);
  const totalKm = turf.length(line, { units: "kilometers" });

  const road = coverage(samples, features.majorRoads);
  const path = coverage(samples, features.quietPaths);
  const lit = coverage(samples, features.litWays);
  const park = coverage(samples, features.parks);
  const water = coverage(samples, features.water);
  const amenity = coverage(samples, features.amenities);
  const treeDensity = countNear(samples, features.trees) / Math.max(1, totalKm); // trees per km
  const landmarkCount = countNear(samples, features.landmarks);

  const environmentTags: Environment[] = [];
  if (park >= 0.25) environmentTags.push("nature_parks");
  if (water >= 0.2) environmentTags.push("waterfront");
  if (road >= 0.4) environmentTags.push("city_streets");
  if (landmarkCount >= 3) environmentTags.push("landmarks");
  if (path >= 0.35) environmentTags.push("running_paths");
  if (!environmentTags.length) environmentTags.push(...fallback.environmentTags);

  const attributes: RouteAttributes = {
    trafficExposure: clamp(road * 90 - path * 20 + 10),
    isolationRisk: clamp(60 - amenity * 60 - road * 25 + park * 15),
    lightingQuality: clamp(25 + lit * 55 + road * 20 + amenity * 10),
    sceneryValue: clamp(25 + park * 40 + water * 45 + Math.min(15, landmarkCount * 3)),
    shadeCoverage: clamp(15 + park * 45 + Math.min(35, treeDensity * 2.5) + path * 10),
    environmentTags,
  };
  return { attributes, dataSource: "osm" };
}
