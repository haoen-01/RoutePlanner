import { smoothNoise } from "./geo";
import type { Terrain, TerrainProfile } from "./types";

const TERRAIN_AMPLITUDE_M: Record<Terrain, number> = {
  flat: 3,
  slightly_hilly: 12,
  hilly: 30,
};

/**
 * Samples elevation for a set of [lng, lat] points, one every ~200m.
 * Tries the free Open-Elevation public API first; if it's unreachable
 * (rate-limited, offline demo, etc.) falls back to a deterministic
 * synthetic elevation profile shaped by the route's terrain preference,
 * clearly flagged via `isEstimated` wherever it's surfaced in the UI.
 */
export async function sampleElevationProfile(
  points: [number, number][],
  opts: { terrain: Terrain; seed: number }
): Promise<{ elevationsM: number[]; isEstimated: boolean }> {
  try {
    if (points.length === 0) throw new Error("no points");
    // Open-Meteo's elevation endpoint first — same provider as our weather
    // data, no key, and far more reliable than open-elevation.com.
    try {
      const capped = points.slice(0, 100); // API limit
      const lats = capped.map(([, lat]) => lat.toFixed(5)).join(",");
      const lngs = capped.map(([lng]) => lng.toFixed(5)).join(",");
      const res = await fetch(
        `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (!res.ok) throw new Error(`open-meteo elevation ${res.status}`);
      const data = (await res.json()) as { elevation: number[] };
      if (!data.elevation?.length) throw new Error("empty result");
      return { elevationsM: data.elevation, isEstimated: false };
    } catch {
      // fall through to open-elevation
    }
    const locations = points
      .map(([lng, lat]) => `${lat.toFixed(5)},${lng.toFixed(5)}`)
      .join("|");
    const res = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${encodeURIComponent(locations)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) throw new Error(`open-elevation ${res.status}`);
    const data = (await res.json()) as { results: { elevation: number }[] };
    if (!data.results?.length) throw new Error("empty result");
    return { elevationsM: data.results.map((r) => r.elevation), isEstimated: false };
  } catch {
    const amplitude = TERRAIN_AMPLITUDE_M[opts.terrain];
    const elevationsM = points.map((_, i) => 20 + smoothNoise(i * 0.4, opts.seed) * amplitude);
    return { elevationsM, isEstimated: true };
  }
}

export function analyzeTerrain(elevationsM: number[], isEstimated: boolean): TerrainProfile {
  if (elevationsM.length < 2) {
    return { elevationGainM: 0, highestPointM: elevationsM[0] ?? 0, maxInclinePct: 0, difficulty: "easy", isEstimated };
  }
  let gain = 0;
  let maxIncline = 0;
  const stepM = 200; // matches ~200m sampling interval used to build the profile
  for (let i = 1; i < elevationsM.length; i++) {
    const delta = elevationsM[i] - elevationsM[i - 1];
    if (delta > 0) gain += delta;
    const inclinePct = Math.abs(delta) / stepM * 100;
    if (inclinePct > maxIncline) maxIncline = inclinePct;
  }
  const highest = Math.max(...elevationsM);
  const difficulty: TerrainProfile["difficulty"] = gain > 150 || maxIncline > 8 ? "hard" : gain > 60 || maxIncline > 4 ? "moderate" : "easy";
  return {
    elevationGainM: Math.round(gain),
    highestPointM: Math.round(highest),
    maxInclinePct: Math.round(maxIncline * 10) / 10,
    difficulty,
    isEstimated,
  };
}
