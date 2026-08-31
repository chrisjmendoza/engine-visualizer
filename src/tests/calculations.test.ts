import { describe, expect, it } from "vitest";
import {
  calculateBoreStrokeRatio,
  calculateClearanceHeightMm,
  calculateClearanceVolumeCc,
  calculateCylinderDisplacementCc,
  calculateMeanPistonSpeedMps,
  calculatePistonToHeadDistanceMm,
  calculateRodStrokeRatio,
} from "../engine/calculations";

describe("calculateClearanceVolumeCc", () => {
  it("matches a hand-computed clearance volume", () => {
    // Swept 499.557 cc at 10.5:1 -> 499.55721421792737 / 9.5, computed
    // independently.
    expect(calculateClearanceVolumeCc(86, 86, 10.5)).toBeCloseTo(
      52.5849699177,
      6,
    );
  });

  it("halves when (CR - 1) doubles", () => {
    // 628.3185307179587 / 9 vs / 18, computed independently.
    expect(calculateClearanceVolumeCc(100, 80, 10)).toBeCloseTo(
      69.8131700798,
      6,
    );
    expect(calculateClearanceVolumeCc(100, 80, 19)).toBeCloseTo(
      34.9065850399,
      6,
    );
  });
});

describe("calculatePistonToHeadDistanceMm", () => {
  it("equals the clearance height at TDC", () => {
    // 86 / 9.5, computed independently.
    expect(calculatePistonToHeadDistanceMm(86, 10.5, 0)).toBeCloseTo(
      9.052631578947368,
      9,
    );
  });

  it("equals clearance height plus stroke at BDC", () => {
    // 86 / 9.5 + 86, computed independently.
    expect(calculatePistonToHeadDistanceMm(86, 10.5, 86)).toBeCloseTo(
      95.05263157894737,
      9,
    );
  });

  it("tracks displacement linearly in between", () => {
    // 86 / 9.5 + 40, computed independently.
    expect(calculatePistonToHeadDistanceMm(86, 10.5, 40)).toBeCloseTo(
      49.05263157894737,
      9,
    );
  });
});

describe("calculateClearanceHeightMm", () => {
  it("matches stroke / (CR - 1)", () => {
    // 86 / 9.5, computed independently.
    expect(calculateClearanceHeightMm(86, 10.5)).toBeCloseTo(
      9.052631578947368,
      9,
    );
  });

  it("is consistent with clearance volume over the bore area", () => {
    // height = volume / area must equal stroke / (CR - 1): the two exported
    // functions must agree with each other for any bore.
    const boreAreaMm2 = (Math.PI / 4) * 103.25 * 103.25;
    const volumeMm3 = calculateClearanceVolumeCc(103.25, 92, 10.7) * 1000;
    expect(calculateClearanceHeightMm(92, 10.7)).toBeCloseTo(
      volumeMm3 / boreAreaMm2,
      9,
    );
  });
});

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
