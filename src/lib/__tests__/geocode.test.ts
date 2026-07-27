import { describe, expect, it } from "vitest";
import { parseNominatim, parseOneMap } from "../geocode";

describe("parseOneMap", () => {
  it("parses OneMap results", () => {
    const out = parseOneMap({
      results: [
        { SEARCHVAL: "MARINA BAY SANDS", BUILDING: "MARINA BAY SANDS", ADDRESS: "10 BAYFRONT AVENUE MARINA BAY SANDS SINGAPORE 018956", LATITUDE: "1.28368", LONGITUDE: "103.86072" },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].lat).toBeCloseTo(1.28368);
    expect(out[0].lng).toBeCloseTo(103.86072);
    expect(out[0].source).toBe("onemap");
  });

  it("drops entries without coordinates and caps at 5", () => {
    const good = { ADDRESS: "X", LATITUDE: "1.3", LONGITUDE: "103.8" };
    const out = parseOneMap({ results: [{ ADDRESS: "bad" }, good, good, good, good, good, good] });
    expect(out).toHaveLength(5);
  });

  it("handles empty/malformed payloads", () => {
    expect(parseOneMap(null)).toEqual([]);
    expect(parseOneMap({})).toEqual([]);
  });
});

describe("parseNominatim", () => {
  it("parses Nominatim results", () => {
    const out = parseNominatim([{ display_name: "Big Ben, London", lat: "51.5007", lon: "-0.1246" }]);
    expect(out).toHaveLength(1);
    expect(out[0].label).toContain("Big Ben");
    expect(out[0].source).toBe("nominatim");
  });

  it("handles empty/malformed payloads", () => {
    expect(parseNominatim(null)).toEqual([]);
    expect(parseNominatim([{ lat: "x", lon: "y" }])).toEqual([]);
  });
});
