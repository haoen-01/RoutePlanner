import { describe, expect, it } from "vitest";
import { scoreRoute, type ScoreRouteInput } from "../scoring";
import type { RunPreferences, TerrainProfile, WeatherSummary, FacilityPoint } from "../types";

const flatTerrain: TerrainProfile = { elevationGainM: 10, highestPointM: 25, maxInclinePct: 1, difficulty: "easy", isEstimated: false };
const hillyTerrain: TerrainProfile = { elevationGainM: 220, highestPointM: 180, maxInclinePct: 10, difficulty: "hard", isEstimated: false };
const neutralWeather: WeatherSummary = { tempC: 24, rainProbability: 10, heatWarning: false, rainWarning: false, source: "open-meteo" };

const basePrefs: RunPreferences = {
  terrain: "flat",
  environment: [],
  traffic: "balanced",
  safety: "balanced",
  scenery: "balanced",
  hydration: "some",
  toilet: "some",
  shade: "no_preference",
  timing: "morning",
};

function facility(km: number): FacilityPoint {
  return { km, name: "Test", lat: 1.3, lng: 103.8 };
}

function input(overrides: Partial<ScoreRouteInput> = {}): ScoreRouteInput {
  return {
    attributes: { trafficExposure: 40, isolationRisk: 25, lightingQuality: 60, sceneryValue: 55, shadeCoverage: 45, environmentTags: ["running_paths"] },
    terrain: flatTerrain,
    distanceKm: 5,
    targetDistanceKm: 5,
    hydrationPoints: [facility(1), facility(3)],
    toiletPoints: [facility(2)],
    shelterPoints: [facility(2.5)],
    weather: neutralWeather,
    preferences: basePrefs,
    ...overrides,
  };
}

describe("scoreRoute", () => {
  it("keeps all scores within 0-100", () => {
    const s = scoreRoute(input());
    for (const v of Object.values(s)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("rewards terrain that matches the preference", () => {
    const flatOnFlat = scoreRoute(input({ terrain: flatTerrain, preferences: { ...basePrefs, terrain: "flat" } }));
    const hillyOnFlat = scoreRoute(input({ terrain: hillyTerrain, preferences: { ...basePrefs, terrain: "flat" } }));
    expect(flatOnFlat.overallScore).toBeGreaterThan(hillyOnFlat.overallScore);
  });

  it("weights safety more when the user prioritises it", () => {
    const safeAttrs = { trafficExposure: 20, isolationRisk: 5, lightingQuality: 90, sceneryValue: 40, shadeCoverage: 40, environmentTags: ["city_streets"] as any };
    const riskyAttrs = { trafficExposure: 20, isolationRisk: 90, lightingQuality: 20, sceneryValue: 40, shadeCoverage: 40, environmentTags: ["city_streets"] as any };

    const gapWhenPrioritised =
      scoreRoute(input({ attributes: safeAttrs, preferences: { ...basePrefs, safety: "prioritise" } })).overallScore -
      scoreRoute(input({ attributes: riskyAttrs, preferences: { ...basePrefs, safety: "prioritise" } })).overallScore;
    const gapWhenLowest =
      scoreRoute(input({ attributes: safeAttrs, preferences: { ...basePrefs, safety: "lowest" } })).overallScore -
      scoreRoute(input({ attributes: riskyAttrs, preferences: { ...basePrefs, safety: "lowest" } })).overallScore;

    expect(gapWhenPrioritised).toBeGreaterThan(gapWhenLowest);
  });

  it("scores convenience higher with denser facilities when demanded", () => {
    const sparse = scoreRoute(input({ hydrationPoints: [], toiletPoints: [], preferences: { ...basePrefs, hydration: "frequent", toilet: "frequent" } }));
    const dense = scoreRoute(
      input({ hydrationPoints: [facility(1), facility(2), facility(3), facility(4)], toiletPoints: [facility(1.5), facility(3.5)], preferences: { ...basePrefs, hydration: "frequent", toilet: "frequent" } })
    );
    expect(dense.convenienceScore).toBeGreaterThan(sparse.convenienceScore);
  });

  it("penalises routes that miss the target distance", () => {
    const onTarget = scoreRoute(input({ distanceKm: 5, targetDistanceKm: 5 }));
    const wayOff = scoreRoute(input({ distanceKm: 8, targetDistanceKm: 5 }));
    expect(onTarget.overallScore).toBeGreaterThan(wayOff.overallScore);
  });
});
