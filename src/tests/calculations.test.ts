import { describe, expect, it } from "vitest";
import {
  calculateBoreStrokeRatio,
  calculateCylinderDisplacementCc,
  calculateMeanPistonSpeedMps,
  calculateRodStrokeRatio,
} from "../engine/calculations";

describe("calculateCylinderDisplacementCc", () => {
  it("matches the hand-computed default-config displacement", () => {
    // pi * 86^2 * 86 / 4000, computed independently.
    expect(calculateCylinderDisplacementCc(86, 86)).toBeCloseTo(
      499.55721421792737,
      6,
    );
  });

  it("matches a second hand-computed displacement", () => {
    // pi * 100^2 * 80 / 4000, computed independently.
    expect(calculateCylinderDisplacementCc(100, 80)).toBeCloseTo(
      628.3185307179587,
      6,
    );
  });
});

describe("calculateMeanPistonSpeedMps", () => {
  it("matches a hand-computed value at 600 RPM", () => {
    // 2 * (86 / 1000) * 600 / 60 = 1.72
    expect(calculateMeanPistonSpeedMps(86, 600)).toBeCloseTo(1.72, 9);
  });

  it("matches a hand-computed value at 3000 RPM", () => {
    // 2 * (90 / 1000) * 3000 / 60 = 9
    expect(calculateMeanPistonSpeedMps(90, 3000)).toBeCloseTo(9, 9);
  });

  it("is zero at zero RPM", () => {
    expect(calculateMeanPistonSpeedMps(86, 0)).toBe(0);
  });
});

describe("calculateRodStrokeRatio", () => {
  it("matches a hand-computed ratio", () => {
    // 143 / 86, computed independently.
    expect(calculateRodStrokeRatio(143, 86)).toBeCloseTo(
      1.6627906976744187,
      12,
    );
  });

  it("is 1 when rod length equals stroke", () => {
    expect(calculateRodStrokeRatio(100, 100)).toBe(1);
  });
});

describe("calculateBoreStrokeRatio", () => {
  it("is 1 for a square engine", () => {
    expect(calculateBoreStrokeRatio(86, 86)).toBe(1);
  });

  it("matches a hand-computed ratio for an undersquare engine", () => {
    // 80 / 100 = 0.8
    expect(calculateBoreStrokeRatio(80, 100)).toBeCloseTo(0.8, 12);
  });

  it("matches a hand-computed ratio for an oversquare engine", () => {
    // 100 / 80 = 1.25
    expect(calculateBoreStrokeRatio(100, 80)).toBeCloseTo(1.25, 12);
  });
});
