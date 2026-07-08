import * as turf from "@turf/turf";
import type { LatLng } from "./types";

/** Deterministic PRNG (mulberry32) so the same run inputs always produce
 * the same route candidates instead of a different result every request. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function lineLengthKm(coords: [number, number][]): number {
  if (coords.length < 2) return 0;
  const line = turf.lineString(coords);
  return turf.length(line, { units: "kilometers" });
}

export function destinationPoint(from: LatLng, bearingDeg: number, distanceKm: number): LatLng {
  const pt = turf.destination([from.lng, from.lat], distanceKm, bearingDeg, { units: "kilometers" });
  const [lng, lat] = pt.geometry.coordinates;
  return { lat, lng };
}

export function bearingBetween(a: LatLng, b: LatLng): number {
  return turf.bearing([a.lng, a.lat], [b.lng, b.lat]);
}

export function distanceKm(a: LatLng, b: LatLng): number {
  return turf.distance([a.lng, a.lat], [b.lng, b.lat], { units: "kilometers" });
}

/** Point at `fraction` (0-1) along the total length of a coordinate path. */
export function pointAlongFraction(coords: [number, number][], fraction: number): [number, number] {
  const line = turf.lineString(coords);
  const total = turf.length(line, { units: "kilometers" });
  const along = turf.along(line, Math.max(0, Math.min(1, fraction)) * total, { units: "kilometers" });
  return along.geometry.coordinates as [number, number];
}

/** Cheap smooth pseudo-noise (sum of sines) — good enough to synthesize a
 * plausible elevation profile shaped by a seed + terrain preference when no
 * real elevation API is reachable. Deterministic for a given seed. */
export function smoothNoise(x: number, seed: number): number {
  const s = seed % 1000;
  return (
    Math.sin(x * 0.9 + s) * 0.5 +
    Math.sin(x * 2.3 + s * 1.7) * 0.3 +
    Math.sin(x * 5.1 + s * 0.4) * 0.2
  );
}
