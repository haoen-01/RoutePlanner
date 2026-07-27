import { describe, expect, it } from "vitest";
import * as turf from "@turf/turf";
import { deriveRouteAttributes, type CorridorFeatures } from "../osmAttributes";
import type { RouteAttributes } from "../scoring";

const fallback: RouteAttributes = { trafficExposure: 40, isolationRisk: 25, lightingQuality: 65, sceneryValue: 55, shadeCoverage: 45, environmentTags: ["running_paths"] };

const line = turf.lineString([
  [103.8, 1.3],
  [103.81, 1.3],
  [103.82, 1.3],
]) as GeoJSON.Feature<GeoJSON.LineString>;

function emptyFeatures(): CorridorFeatures {
  return { majorRoads: [], quietPaths: [], litWays: [], parks: [], water: [], trees: [], amenities: [], landmarks: [], drinkingWater: [], toilets: [], shelters: [] };
}

describe("deriveRouteAttributes", () => {
  it("falls back to theme attributes without OSM data", () => {
    const r = deriveRouteAttributes(line, null, fallback);
    expect(r.dataSource).toBe("theme");
    expect(r.attributes).toEqual(fallback);
  });

  it("derives higher traffic exposure near major roads", () => {
    const roads = emptyFeatures();
    roads.majorRoads = [[103.8, 1.3], [103.81, 1.3], [103.82, 1.3]];
    const quiet = deriveRouteAttributes(line, emptyFeatures(), fallback).attributes;
    const busy = deriveRouteAttributes(line, roads, fallback).attributes;
    expect(busy.trafficExposure).toBeGreaterThan(quiet.trafficExposure);
    expect(busy.environmentTags).toContain("city_streets");
  });

  it("derives higher scenery and shade near parks and water", () => {
    const green = emptyFeatures();
    green.parks = [[103.8, 1.3], [103.81, 1.3], [103.82, 1.3]];
    green.water = [[103.805, 1.3], [103.815, 1.3]];
    const plain = deriveRouteAttributes(line, emptyFeatures(), fallback).attributes;
    const scenic = deriveRouteAttributes(line, green, fallback).attributes;
    expect(scenic.sceneryValue).toBeGreaterThan(plain.sceneryValue);
    expect(scenic.shadeCoverage).toBeGreaterThan(plain.shadeCoverage);
    expect(scenic.environmentTags).toContain("nature_parks");
  });

  it("keeps every attribute in 0-100", () => {
    const f = emptyFeatures();
    f.majorRoads = Array.from({ length: 50 }, (_, i) => [103.8 + i * 0.0004, 1.3] as [number, number]);
    f.trees = Array.from({ length: 500 }, (_, i) => [103.8 + i * 0.00004, 1.3001] as [number, number]);
    const { attributes } = deriveRouteAttributes(line, f, fallback);
    for (const v of [attributes.trafficExposure, attributes.isolationRisk, attributes.lightingQuality, attributes.sceneryValue, attributes.shadeCoverage]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});
