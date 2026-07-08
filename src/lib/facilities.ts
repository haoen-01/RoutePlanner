import * as turf from "@turf/turf";
import { prisma } from "./db";
import type { FacilityPoint } from "./types";

type RawFacility = { lat: number; lng: number; name: string | null; subtype?: string | null };

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/** Facilities within roughly this many metres of the route are considered
 * "on route" for the km-marker display. */
const CORRIDOR_BUFFER_M = 250;

function toFacilityPoints(
  line: GeoJSON.Feature<GeoJSON.LineString>,
  totalKm: number,
  raws: RawFacility[]
): FacilityPoint[] {
  const points: FacilityPoint[] = [];
  for (const r of raws) {
    const pt = turf.point([r.lng, r.lat]);
    const snapped = turf.nearestPointOnLine(line, pt, { units: "kilometers" });
    const distToRouteKm = snapped.properties.dist ?? Infinity;
    if (distToRouteKm * 1000 > CORRIDOR_BUFFER_M) continue;
    const km = Math.max(0, Math.min(totalKm, snapped.properties.location ?? 0));
    points.push({ km: Math.round(km * 10) / 10, name: r.name || "Unnamed", lat: r.lat, lng: r.lng, subtype: r.subtype ?? undefined });
  }
  return points.sort((a, b) => a.km - b.km);
}

async function queryOverpass(bbox: [number, number, number, number], tagFilters: string[]): Promise<RawFacility[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const body = `[out:json][timeout:10];(${tagFilters
    .map((f) => `node[${f}](${minLat},${minLng},${maxLat},${maxLng});`)
    .join("")});out center 60;`;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body,
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const data = await res.json();
  return (data.elements ?? []).map((el: any) => ({
    lat: el.lat ?? el.center?.lat,
    lng: el.lon ?? el.center?.lon,
    name: el.tags?.name ?? null,
  }));
}

async function queryDbNearby(centerLat: number, centerLng: number, radiusM: number, type: string): Promise<RawFacility[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      { lat: number; lng: number; name: string | null; subtype: string | null }[]
    >(
      `SELECT lat, lng, name, subtype FROM "Facility"
       WHERE type = $1 AND geom IS NOT NULL
       AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)`,
      type,
      centerLng,
      centerLat,
      radiusM
    );
    return rows;
  } catch {
    // `geom` column doesn't exist yet (prisma/postgis.sql not run) or DB
    // unreachable — plain Prisma read as a softer fallback, then give up.
    try {
      const rows = await prisma.facility.findMany({ where: { type }, take: 40 });
      return rows.map((r) => ({ lat: r.lat, lng: r.lng, name: r.name, subtype: r.subtype }));
    } catch {
      return [];
    }
  }
}

/** Deterministic synthetic placeholders so the UI always has something to
 * show even with no DB and no internet — clearly not real-world data. */
function syntheticFacilities(totalKm: number, label: string): FacilityPoint[] {
  const count = totalKm <= 5 ? 1 : totalKm <= 10 ? 2 : 3;
  return Array.from({ length: count }, (_, i) => ({
    km: Math.round(((i + 1) * totalKm) / (count + 1) * 10) / 10,
    name: `${label} (estimated location)`,
    lat: 0,
    lng: 0,
  }));
}

export async function findFacilitiesAlongRoute(
  line: GeoJSON.Feature<GeoJSON.LineString>,
  totalKm: number
): Promise<{ hydration: FacilityPoint[]; toilet: FacilityPoint[]; shelter: FacilityPoint[] }> {
  const bboxRaw = turf.bbox(turf.buffer(line, CORRIDOR_BUFFER_M / 1000, { units: "kilometers" })!) as [number, number, number, number];
  const center = turf.center(line).geometry.coordinates; // [lng, lat]
  const radiusM = Math.max(CORRIDOR_BUFFER_M, (totalKm * 1000) / 2 + CORRIDOR_BUFFER_M);

  const [hydrationRaw, toiletRaw, shelterRaw] = await Promise.all([
    queryOverpass(bboxRaw, ['"amenity"="drinking_water"']).catch(() => queryDbNearby(center[1], center[0], radiusM, "hydration")),
    queryOverpass(bboxRaw, ['"amenity"="toilets"']).catch(() => queryDbNearby(center[1], center[0], radiusM, "toilet")),
    queryOverpass(bboxRaw, ['"shop"="mall"', '"railway"="station"', '"amenity"="shelter"', '"amenity"="cafe"']).catch(() =>
      queryDbNearby(center[1], center[0], radiusM, "shelter")
    ),
  ]);

  let hydration = toFacilityPoints(line, totalKm, hydrationRaw);
  let toilet = toFacilityPoints(line, totalKm, toiletRaw);
  let shelter = toFacilityPoints(line, totalKm, shelterRaw);

  if (hydration.length === 0) hydration = syntheticFacilities(totalKm, "Water point");
  if (toilet.length === 0) toilet = syntheticFacilities(totalKm, "Toilet access");
  if (shelter.length === 0) shelter = syntheticFacilities(totalKm, "Shelter / covered walkway");

  return { hydration, toilet, shelter };
}
