import type {
  Environment,
  FacilityPoint,
  RouteScores,
  RunPreferences,
  TerrainProfile,
  WeatherSummary,
} from "./types";

/** Per-candidate synthetic "character" attributes used as scoring inputs.
 * In synthetic-generation mode (see routing.ts) these are assigned per
 * route so that Route A/B/C are meaningfully different from each other,
 * the same way real road/traffic/tree-cover data would differ route to
 * route if we had a live routing engine wired in. */
export interface RouteAttributes {
  trafficExposure: number; // 0 (quiet) - 100 (heavy traffic)
  isolationRisk: number; // 0 (busy/overlooked) - 100 (isolated)
  lightingQuality: number; // 0 (poor) - 100 (well lit)
  sceneryValue: number; // 0 - 100
  shadeCoverage: number; // 0 - 100
  environmentTags: Environment[];
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

function convenienceScore(pref: "not_required" | "some" | "frequent", points: FacilityPoint[], distanceKm: number): number {
  const density = points.length / Math.max(1, distanceKm); // points per km
  if (pref === "not_required") return clamp(60 + density * 20); // mild bonus, never penalized
  if (pref === "some") return clamp(40 + density * 60);
  return clamp(20 + density * 90); // "frequent" demands more density to score well
}

function weatherProtectionScore(shelterPoints: FacilityPoint[], distanceKm: number, weather: WeatherSummary): number {
  const density = shelterPoints.length / Math.max(1, distanceKm);
  let score = clamp(30 + density * 70);
  if (weather.rainWarning || weather.heatWarning) {
    // when protection is actually needed, poor shelter coverage hurts more
    score = density < 0.3 ? clamp(score - 20) : clamp(score + 5);
  }
  return Math.round(score);
}

function terrainMatchScore(terrain: TerrainProfile, pref: RunPreferences["terrain"]): number {
  const bucket = terrain.elevationGainM > 150 || terrain.maxInclinePct > 8 ? "hilly" : terrain.elevationGainM > 60 || terrain.maxInclinePct > 4 ? "slightly_hilly" : "flat";
  if (bucket === pref) return 100;
  const order = ["flat", "slightly_hilly", "hilly"];
  const gap = Math.abs(order.indexOf(bucket) - order.indexOf(pref));
  return gap === 1 ? 60 : 25;
}

function environmentMatchScore(tags: Environment[], selected: Environment[]): number {
  if (selected.length === 0) return 70; // no preference expressed
  const overlap = tags.filter((t) => selected.includes(t)).length;
  return clamp(30 + (overlap / selected.length) * 70);
}

export interface ScoreRouteInput {
  attributes: RouteAttributes;
  terrain: TerrainProfile;
  distanceKm: number;
  targetDistanceKm: number;
  hydrationPoints: FacilityPoint[];
  toiletPoints: FacilityPoint[];
  shelterPoints: FacilityPoint[];
  weather: WeatherSummary;
  preferences: RunPreferences;
}

export function scoreRoute(input: ScoreRouteInput): RouteScores {
  const { attributes, terrain, preferences, weather } = input;

  const safetyBase = clamp(100 - attributes.isolationRisk * 0.6 + attributes.lightingQuality * 0.3 - (preferences.timing === "night" ? 15 : 0));
  const trafficBase = clamp(100 - attributes.trafficExposure);
  const sceneryBase = clamp(attributes.sceneryValue);
  const shadeBase = clamp(attributes.shadeCoverage);
  const convenience = Math.round(
    (convenienceScore(preferences.hydration, input.hydrationPoints, input.distanceKm) +
      convenienceScore(preferences.toilet, input.toiletPoints, input.distanceKm)) /
      2
  );
  const weatherProtection = weatherProtectionScore(input.shelterPoints, input.distanceKm, weather);

  const distanceMatch = clamp(100 - (Math.abs(input.distanceKm - input.targetDistanceKm) / input.targetDistanceKm) * 300);
  const terrainMatch = terrainMatchScore(terrain, preferences.terrain);
  const environmentMatch = environmentMatchScore(attributes.environmentTags, preferences.environment);

  // Preference -> weight tables (0-1). These are what make the "Overall
  // Match Score" a genuine preference-based weighting rather than a flat
  // average — e.g. picking "Prioritise safety" makes safety count for much
  // more of the total than "Lowest priority" does.
  const safetyWeight = { lowest: 0.04, balanced: 0.1, prioritise: 0.22 }[preferences.safety];
  const trafficWeight = { avoid: 0.18, balanced: 0.1, fastest: 0.05 }[preferences.traffic];
  const sceneryWeight = { scenery: 0.18, balanced: 0.1, efficiency: 0.04 }[preferences.scenery];
  const shadeWeight = { prioritise: 0.15, some: 0.08, no_preference: 0.03 }[preferences.shade];
  const weatherWeight = weather.rainWarning || weather.heatWarning ? 0.12 : 0.06;
  const convenienceWeight = 0.1;
  const distanceWeight = 0.15;
  const terrainWeight = 0.12;
  const environmentWeight = 0.1;

  const totalWeight =
    safetyWeight + trafficWeight + sceneryWeight + shadeWeight + weatherWeight + convenienceWeight + distanceWeight + terrainWeight + environmentWeight;

  const overallScore = Math.round(
    (safetyBase * safetyWeight +
      trafficBase * trafficWeight +
      sceneryBase * sceneryWeight +
      shadeBase * shadeWeight +
      weatherProtection * weatherWeight +
      convenience * convenienceWeight +
      distanceMatch * distanceWeight +
      terrainMatch * terrainWeight +
      environmentMatch * environmentWeight) /
      totalWeight
  );

  return {
    safetyScore: Math.round(safetyBase),
    sceneryScore: Math.round(sceneryBase),
    trafficScore: Math.round(trafficBase),
    convenienceScore: convenience,
    shadeScore: Math.round(shadeBase),
    weatherProtectionScore: weatherProtection,
    overallScore: clamp(overallScore),
  };
}

const ENV_LABEL: Record<Environment, string> = {
  nature_parks: "nature and parks",
  waterfront: "waterfront views",
  city_streets: "city streets",
  landmarks: "landmarks and sightseeing",
  running_paths: "dedicated running paths",
};

/** Template-based natural-language explanation — no LLM call required, so
 * this works with zero API keys. Swap in a real LLM call here if desired
 * (the scores + attributes above are already a clean structured prompt). */
export function explainRoute(scores: RouteScores, preferences: RunPreferences, attributes: RouteAttributes): string {
  const matched: string[] = [];
  if (preferences.terrain === "flat" && scores.overallScore > 0) matched.push("flat terrain");
  if (preferences.terrain === "hilly") matched.push("hillier terrain");
  if (preferences.environment.length) matched.push(attributes.environmentTags.map((t) => ENV_LABEL[t]).join(", "));
  if (preferences.traffic === "avoid" && scores.trafficScore >= 60) matched.push("low traffic");
  if (preferences.safety === "prioritise" && scores.safetyScore >= 60) matched.push("a strong safety profile");
  if (preferences.scenery === "scenery" && scores.sceneryScore >= 60) matched.push("scenic value");
  if (preferences.shade === "prioritise" && scores.shadeScore >= 60) matched.push("shaded coverage");
  if (preferences.hydration !== "not_required") matched.push("hydration access");
  if (preferences.toilet !== "not_required") matched.push("toilet access");

  const list = matched.length ? matched.slice(0, 4).join(", ") : "your selected distance and route type";
  return `This route was selected because it matches your preference for ${list}.`;
}

export function recommendationLine(routeName: string, scores: RouteScores): string {
  const strengths: string[] = [];
  if (scores.shadeScore >= 70) strengths.push("more shade");
  if (scores.weatherProtectionScore >= 70) strengths.push("better shelter coverage");
  if (scores.safetyScore >= 70) strengths.push("a safer path");
  if (scores.sceneryScore >= 70) strengths.push("better scenery");
  if (scores.trafficScore >= 70) strengths.push("less traffic");
  const reason = strengths.length ? strengths.slice(0, 2).join(" and ") : "the best overall balance of your preferences";
  return `Choose ${routeName} because it has ${reason}.`;
}
