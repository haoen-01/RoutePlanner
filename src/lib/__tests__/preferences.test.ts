import { describe, expect, it } from "vitest";
import { summarizeChoiceSignals } from "../preferences";

describe("summarizeChoiceSignals", () => {
  it("returns nothing without enough samples", () => {
    expect(summarizeChoiceSignals({ shade: { sum: 40, n: 1 } })).toEqual([]);
    expect(summarizeChoiceSignals(null)).toEqual([]);
  });

  it("detects a positive tendency", () => {
    const lines = summarizeChoiceSignals({ shade: { sum: 30, n: 3 } });
    expect(lines[0]).toContain("shadier");
  });

  it("detects a negative tendency", () => {
    const lines = summarizeChoiceSignals({ elevationGain: { sum: -60, n: 3 } });
    expect(lines[0]).toContain("flatter");
  });

  it("ignores weak signals below the threshold", () => {
    expect(summarizeChoiceSignals({ scenery: { sum: 6, n: 3 } })).toEqual([]);
  });
});
