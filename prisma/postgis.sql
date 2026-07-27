-- Run this once against your database AFTER your first
-- `npx prisma migrate dev --name init`:
--
--   psql "$DATABASE_URL" -f prisma/postgis.sql
--
-- (the postgis/postgis docker image already ships the extension binary,
-- this just enables it + adds the spatial column/index Prisma can't model.)

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "Facility"
  ADD COLUMN IF NOT EXISTS geom geography(Point, 4326);

UPDATE "Facility"
  SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  WHERE geom IS NULL;

CREATE INDEX IF NOT EXISTS facility_geom_gix ON "Facility" USING GIST (geom);

-- Keep geom in sync automatically whenever lat/lng are written.
CREATE OR REPLACE FUNCTION facility_sync_geom() RETURNS trigger AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS facility_sync_geom_trigger ON "Facility";
CREATE TRIGGER facility_sync_geom_trigger
  BEFORE INSERT OR UPDATE ON "Facility"
  FOR EACH ROW EXECUTE FUNCTION facility_sync_geom();

-- Example spatial query used by src/lib/facilities.ts
-- (facilities within `radius_m` metres of a point, nearest first):
--
-- SELECT id, type, subtype, name, lat, lng,
--        ST_Distance(geom, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography) AS distance_m
-- FROM "Facility"
-- WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography, $radius_m)
-- ORDER BY distance_m ASC;
