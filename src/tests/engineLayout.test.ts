import { describe, expect, it } from "vitest";
import {
  SUPPORTED_CYLINDER_COUNTS,
  createEngineLayout,
  cylinderCrankAngleRad,
  isSupportedCylinderCount,
  type CylinderDefinition,
} from "../engine/engineLayout";
import { TWO_PI } from "../engine/constants";

/** Expected crank-throw phase tables (radians), per §24a. */
const EXPECTED_PHASES_RAD: Record<number, readonly number[]> = {
  1: [0],
  3: [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3],
  4: [0, Math.PI, Math.PI, 0],
  6: [
    0,
    (2 * Math.PI) / 3,
    (4 * Math.PI) / 3,
    (4 * Math.PI) / 3,
    (2 * Math.PI) / 3,
    0,
  ],
};

describe("createEngineLayout", () => {
  for (const count of SUPPORTED_CYLINDER_COUNTS) {
    it(`produces ${count} cylinder(s) with sequential indices`, () => {
      const layout = createEngineLayout(count);
      expect(layout.cylinders).toHaveLength(count);
      layout.cylinders.forEach((cylinder, i) => {
        expect(cylinder.index).toBe(i);
      });
    });

    it(`cylinder 0 has phase exactly 0 for count=${count}`, () => {
      const layout = createEngineLayout(count);
      expect(layout.cylinders[0]?.crankPhaseRad).toBe(0);
    });

    it(`matches the documented phase table for count=${count}`, () => {
      const layout = createEngineLayout(count);
      const phases = layout.cylinders.map((c) => c.crankPhaseRad);
      const expected = EXPECTED_PHASES_RAD[count] ?? [];
      expect(phases).toHaveLength(expected.length);
      phases.forEach((phase, i) => {
        expect(phase).toBeCloseTo(expected[i] as number, 12);
      });
    });

    it(`keeps every phase in [0, 2π) for count=${count}`, () => {
      const layout = createEngineLayout(count);
      for (const cylinder of layout.cylinders) {
        expect(cylinder.crankPhaseRad).toBeGreaterThanOrEqual(0);
        expect(cylinder.crankPhaseRad).toBeLessThan(TWO_PI);
      }
    });

    it(`sets bankIndex 0 and bankAngleRad 0 for count=${count}`, () => {
      const layout = createEngineLayout(count);
      expect(layout.bankAngleRad).toBe(0);
      for (const cylinder of layout.cylinders) {
        expect(cylinder.bankIndex).toBe(0);
      }
    });
  }

  it("kind is 'single' for count=1 and 'inline' for every other supported count", () => {
    expect(createEngineLayout(1).kind).toBe("single");
    for (const count of SUPPORTED_CYLINDER_COUNTS) {
      if (count === 1) continue;
      expect(createEngineLayout(count).kind).toBe("inline");
    }
  });

  it("returns a shared, frozen instance rather than rebuilding per call", () => {
    const a = createEngineLayout(4);
    const b = createEngineLayout(4);
    expect(a).toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.cylinders)).toBe(true);
  });
});

describe("isSupportedCylinderCount", () => {
  it("accepts every supported count", () => {
    for (const count of SUPPORTED_CYLINDER_COUNTS) {
      expect(isSupportedCylinderCount(count)).toBe(true);
    }
  });

  it("rejects unsupported cylinder counts", () => {
    for (const n of [0, 2, 5, 8, 4.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isSupportedCylinderCount(n)).toBe(false);
    }
  });
});

describe("cylinderCrankAngleRad", () => {
  const cylinderAt = (crankPhaseRad: number): CylinderDefinition => ({
    index: 0,
    bankIndex: 0,
    crankPhaseRad,
  });

  it("adds the cylinder's phase to the global crank angle", () => {
    const result = cylinderCrankAngleRad(Math.PI / 2, cylinderAt(Math.PI / 4));
    expect(result).toBeCloseTo(Math.PI / 2 + Math.PI / 4, 12);
  });

  it("wraps a sum past 2π back into [0, 2π)", () => {
    const result = cylinderCrankAngleRad(
      (3 * Math.PI) / 2,
      cylinderAt(Math.PI),
    );
    // (3π/2) + π = 5π/2, which wraps to π/2.
    expect(result).toBeCloseTo(Math.PI / 2, 12);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(TWO_PI);
  });

  it("normalizes even though a negative sum never occurs in practice", () => {
    const result = cylinderCrankAngleRad(-Math.PI / 2, cylinderAt(0));
    expect(result).toBeCloseTo((3 * Math.PI) / 2, 12);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(TWO_PI);
  });

  it("matches a real cylinder's phase from a full layout", () => {
    const layout = createEngineLayout(3);
    const secondCylinder = layout.cylinders[1] as CylinderDefinition;
    const result = cylinderCrankAngleRad(0, secondCylinder);
    expect(result).toBeCloseTo((2 * Math.PI) / 3, 12);
  });
});
