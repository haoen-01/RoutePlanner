import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Standalone nearby-facilities lookup, independent of any generated route.
 * Demonstrates the PostGIS ST_DWithin query directly:
 *   GET /api/facilities?lat=1.30&lng=103.83&radiusM=500&type=hydration
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radiusM = Number(searchParams.get("radiusM") ?? 500);
  const type = searchParams.get("type"); // "hydration" | "toilet" | "shelter" | null (=all)

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng query params are required" }, { status: 400 });
  }

  try {
    const rows = type
      ? await prisma.$queryRawUnsafe<any[]>(
          `SELECT id, type, subtype, name, lat, lng,
                  ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
           FROM "Facility"
           WHERE type = $3 AND geom IS NOT NULL
             AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $4)
           ORDER BY distance_m ASC LIMIT 50`,
          lng,
          lat,
          type,
          radiusM
        )
      : await prisma.$queryRawUnsafe<any[]>(
          `SELECT id, type, subtype, name, lat, lng,
                  ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
           FROM "Facility"
           WHERE geom IS NOT NULL
             AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
           ORDER BY distance_m ASC LIMIT 50`,
          lng,
          lat,
          radiusM
        );
    return NextResponse.json({ facilities: rows, source: "postgis" });
  } catch (err) {
    // geom column not migrated yet (run prisma/postgis.sql) — soft fallback.
    const rows = await prisma.facility.findMany({ where: type ? { type } : undefined, take: 50 });
    return NextResponse.json({ facilities: rows, source: "prisma-fallback" });
  }
}
