import * as turf from "@turf/turf";
import { prisma } from "./db";
import type { FacilityPoint } from "./types";
import type { CorridorFeatures } from "./osmAttributes";

type RawFacility = { lat: number; lng: number; name: string | null; subtype?: string | null };

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
      return rows.map((r: any) => ({ lat: r.lat, lng: r.lng, name: r.name, subtype: r.subtype }));
    } catch {
      return [];
    }
  }
}

/** Facility lookup along a specific candidate route. Prefers the shared
 * corridor feature set (one Overpass query per generation, see routing.ts);
 * falls back to seeded PostGIS data. Returns honest empty arrays when
 * nothing is verifiable — no fabricated placeholder points. */
export async function findFacilitiesAlongRoute(
  line: GeoJSON.Feature<GeoJSON.LineString>,
  totalKm: number,
  features: CorridorFeatures | null
): Promise<{ hydration: FacilityPoint[]; toilet: FacilityPoint[]; shelter: FacilityPoint[] }> {
  let hydrationRaw: RawFacility[];
  let toiletRaw: RawFacility[];
  let shelterRaw: RawFacility[];

  if (features) {
    hydrationRaw = features.drinkingWater;
    toiletRaw = features.toilets;
    shelterRaw = features.shelters;
  } else {
    const center = turf.center(line).geometry.coordinates; // [lng, lat]
    const radiusM = Math.max(CORRIDOR_BUFFER_M, (totalKm * 1000) / 2 + CORRIDOR_BUFFER_M);
    [hydrationRaw, toiletRaw, shelterRaw] = await Promise.all([
      queryDbNearby(center[1], center[0], radiusM, "hydration"),
      queryDbNearby(center[1], center[0], radiusM, "toilet"),
      queryDbNearby(center[1], center[0], radiusM, "shelter"),
    ]);
  }

  return {
    hydration: toFacilityPoints(line, totalKm, hydrationRaw),
    toilet: toFacilityPoints(line, totalKm, toiletRaw),
    shelter: toFacilityPoints(line, totalKm, shelterRaw),
  };
}
