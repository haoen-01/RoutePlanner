import { describe, expect, it } from "vitest";
import { loopViaPoints, p2pViaPoints } from "../routing";
import { lineLengthKm, distanceKm } from "../geo";
import type { LatLng } from "../types";

const start: LatLng = { lat: 1.3048, lng: 103.8318 };
const nearEnd: LatLng = { lat: 1.3235, lng: 103.8442 }; // ~2.5km away

describe("p2pViaPoints", () => {
  it("stretches a short endpoint pair to the target distance", () => {
    const targetKm = 5;
    const vias = p2pViaPoints(start, nearEnd, targetKm, 42);
    expect(vias).not.toBeNull();
    const total = lineLengthKm([[start.lng, start.lat], ...(vias as [number, number][]), [nearEnd.lng, nearEnd.lat]]);
    expect(Math.abs(total - targetKm) / targetKm).toBeLessThan(0.05);
  });

  it("returns null when target barely exceeds the direct distance", () => {
    const direct = distanceKm(start, nearEnd);
    expect(p2pViaPoints(start, nearEnd, direct * 1.02, 42)).toBeNull();
  });

  it("returns null for unreachable targets (endpoint farther than target)", () => {
    expect(p2pViaPoints(start, nearEnd, 1, 42)).toBeNull();
  });

  it("varies detour side by seed for route differentiation", () => {
    const a = p2pViaPoints(start, nearEnd, 6, 1);
    const b = p2pViaPoints(start, nearEnd, 6, 2);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});

describe("loopViaPoints", () => {
  it("produces a geometric loop close to the target distance", () => {
    const vias = loopViaPoints(start, 5, 45, 7);
    const total = lineLengthKm([[start.lng, start.lat], ...vias, [start.lng, start.lat]]);
    expect(Math.abs(total - 5) / 5).toBeLessThan(0.05);
  });

  it("sends different bearings into different territory", () => {
    const north = loopViaPoints(start, 5, 0, 7);
    const south = loopViaPoints(start, 5, 180, 7);
    expect(JSON.stringify(north)).not.toEqual(JSON.stringify(south));
    // northbound waypoints should sit above the start, southbound below
    expect(north[0][1]).toBeGreaterThan(start.lat);
    expect(south[0][1]).toBeLessThan(start.lat);
  });

  it("keeps distinct candidate bearings distinct (the identical-loops bug)", () => {
    const a = loopViaPoints(start, 5, 10, 100);
    const b = loopViaPoints(start, 5, 139, 8019);
    const c = loopViaPoints(start, 5, 259, 15938);
    const set = new Set([JSON.stringify(a), JSON.stringify(b), JSON.stringify(c)]);
    expect(set.size).toBe(3);
  });
});
