import { describe, expect, it } from "vitest";
import {
  degToRad,
  inToMm,
  mmToIn,
  normalizeAngleRad,
  radToDeg,
} from "../engine/units";
import { TWO_PI } from "../engine/constants";

describe("mmToIn / inToMm", () => {
  it("converts millimeters to inches", () => {
    expect(mmToIn(25.4)).toBeCloseTo(1, 12);
    expect(mmToIn(100)).toBeCloseTo(3.937007874015748, 12);
  });

  it("converts inches to millimeters", () => {
    expect(inToMm(1)).toBeCloseTo(25.4, 12);
    expect(inToMm(4)).toBeCloseTo(101.6, 12);
  });

  it("round-trips mm -> in -> mm", () => {
    for (const mm of [1, 20, 86, 143, 200, 400]) {
      expect(inToMm(mmToIn(mm))).toBeCloseTo(mm, 9);
    }
  });

  it("round-trips in -> mm -> in", () => {
    for (const inches of [0.5, 1, 3.375, 10, 15.75]) {
      expect(mmToIn(inToMm(inches))).toBeCloseTo(inches, 9);
    }
  });
});

describe("radToDeg / degToRad", () => {
  it("converts radians to degrees at known points", () => {
    expect(radToDeg(0)).toBe(0);
    expect(radToDeg(Math.PI)).toBeCloseTo(180, 12);
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90, 12);
    expect(radToDeg(TWO_PI)).toBeCloseTo(360, 12);
  });

  it("converts degrees to radians at known points", () => {
    expect(degToRad(0)).toBe(0);
    expect(degToRad(180)).toBeCloseTo(Math.PI, 12);
    expect(degToRad(90)).toBeCloseTo(Math.PI / 2, 12);
    expect(degToRad(360)).toBeCloseTo(TWO_PI, 12);
  });

  it("round-trips deg -> rad -> deg", () => {
    for (const deg of [0, 45, 90, 180, 270, 359]) {
      expect(radToDeg(degToRad(deg))).toBeCloseTo(deg, 9);
    }
  });
});

describe("normalizeAngleRad", () => {
  it("leaves angles already within [0, 2*PI) unchanged", () => {
    expect(normalizeAngleRad(0)).toBeCloseTo(0, 12);
    expect(normalizeAngleRad(Math.PI)).toBeCloseTo(Math.PI, 12);
  });

  it("wraps angles at or beyond 2*PI", () => {
    expect(normalizeAngleRad(TWO_PI)).toBeCloseTo(0, 12);
    expect(normalizeAngleRad(TWO_PI + Math.PI / 2)).toBeCloseTo(
      Math.PI / 2,
      12,
    );
    expect(normalizeAngleRad(4 * TWO_PI + 1)).toBeCloseTo(1, 9);
  });

  it("wraps negative angles into [0, 2*PI)", () => {
    expect(normalizeAngleRad(-Math.PI / 2)).toBeCloseTo(
      TWO_PI - Math.PI / 2,
      12,
    );
    expect(normalizeAngleRad(-TWO_PI)).toBeCloseTo(0, 12);
  });

  it("always returns a value in [0, 2*PI)", () => {
    for (let deg = -1080; deg <= 1080; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const normalized = normalizeAngleRad(rad);
      expect(normalized).toBeGreaterThanOrEqual(0);
      expect(normalized).toBeLessThan(TWO_PI);
    }
  });
});
