import { describe, expect, it } from "vitest";
import { cycleAngleRad, strokePhaseAt } from "../engine/cycle";
import type { StrokePhase } from "../engine/cycle";
import { TWO_PI } from "../engine/constants";

describe("cycleAngleRad", () => {
  it("returns the crank angle unchanged at parity 0", () => {
    expect(cycleAngleRad(0, 0)).toBeCloseTo(0, 12);
    expect(cycleAngleRad(Math.PI, 0)).toBeCloseTo(Math.PI, 12);
  });

  it("adds a full revolution at parity 1", () => {
    expect(cycleAngleRad(0, 1)).toBeCloseTo(TWO_PI, 12);
    expect(cycleAngleRad(Math.PI, 1)).toBeCloseTo(Math.PI + TWO_PI, 12);
  });

  it("wraps a crank angle outside [0, 2*PI) before combining with parity", () => {
    // Exactly one revolution past zero should read the same as zero itself.
    expect(cycleAngleRad(TWO_PI, 0)).toBeCloseTo(0, 9);
    expect(cycleAngleRad(TWO_PI, 1)).toBeCloseTo(TWO_PI, 9);

    // A negative angle (defensive input) wraps the same way.
    expect(cycleAngleRad(-Math.PI / 2, 0)).toBeCloseTo((3 * Math.PI) / 2, 9);
  });

  it("stays within [0, 4*PI) for any crank angle and either parity", () => {
    for (let deg = -720; deg <= 720; deg += 15) {
      const theta = (deg / 180) * Math.PI;
      for (const parity of [0, 1] as const) {
        const value = cycleAngleRad(theta, parity);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(2 * TWO_PI);
      }
    }
  });
});

describe("strokePhaseAt - quarter boundaries", () => {
  const cases: { cycleAngle: number; phase: StrokePhase; label: string }[] = [
    { cycleAngle: 0, phase: "intake", label: "0 (TDC, cycle start)" },
    { cycleAngle: Math.PI - 1e-9, phase: "intake", label: "just under PI" },
    { cycleAngle: Math.PI, phase: "compression", label: "PI exactly" },
    {
      cycleAngle: TWO_PI - 1e-9,
      phase: "compression",
      label: "just under 2*PI",
    },
    { cycleAngle: TWO_PI, phase: "power", label: "2*PI exactly" },
    {
      cycleAngle: 3 * Math.PI - 1e-9,
      phase: "power",
      label: "just under 3*PI",
    },
    { cycleAngle: 3 * Math.PI, phase: "exhaust", label: "3*PI exactly" },
    {
      cycleAngle: 4 * Math.PI - 1e-9,
      phase: "exhaust",
      label: "just under 4*PI",
    },
  ];

  for (const { cycleAngle, phase, label } of cases) {
    it(`reports "${phase}" at ${label}`, () => {
      expect(strokePhaseAt(cycleAngle)).toBe(phase);
    });
  }
});

describe("strokePhaseAt - wrap at 4*PI", () => {
  it("treats exactly 4*PI as the start of the next cycle's intake stroke", () => {
    expect(strokePhaseAt(4 * Math.PI)).toBe("intake");
  });

  it("treats 4*PI plus an angle the same as that angle alone", () => {
    for (const cycleAngle of [
      0,
      Math.PI / 2,
      Math.PI,
      2.5 * Math.PI,
      3.9 * Math.PI,
    ]) {
      expect(strokePhaseAt(4 * Math.PI + cycleAngle)).toBe(
        strokePhaseAt(cycleAngle),
      );
    }
  });

  it("treats a negative cycle angle by wrapping into [0, 4*PI) as well", () => {
    // -0.1 rad should read as just before the end of the cycle: exhaust.
    expect(strokePhaseAt(-0.1)).toBe("exhaust");
  });
});

describe("strokePhaseAt - full cycle sweep matches the quarter definition", () => {
  it("agrees with a direct quarter computation at every sampled angle", () => {
    for (let deg = 0; deg < 720; deg += 1) {
      const cycleAngle = (deg / 180) * Math.PI;
      const quarter = Math.floor(deg / 180);
      const expected: StrokePhase = (
        ["intake", "compression", "power", "exhaust"] as const
      )[quarter];

      expect(strokePhaseAt(cycleAngle)).toBe(expected);
    }
  });
});

describe("cycleAngleRad + strokePhaseAt - parity flips the reported stroke", () => {
  it("the same wrapped crank angle reports the opposite stroke pair under each parity", () => {
    // At the crank angle where parity 0 reads intake, parity 1 must read
    // power - the phase four quarters ahead, i.e. the same point one full
    // crank revolution into the cycle.
    const crankAngleRad = Math.PI / 4; // well inside intake at parity 0
    expect(strokePhaseAt(cycleAngleRad(crankAngleRad, 0))).toBe("intake");
    expect(strokePhaseAt(cycleAngleRad(crankAngleRad, 1))).toBe("power");
  });

  it("a parity flip at the same wrapped angle moves compression to exhaust", () => {
    const crankAngleRad = Math.PI + Math.PI / 4; // inside compression at parity 0
    expect(strokePhaseAt(cycleAngleRad(crankAngleRad, 0))).toBe("compression");
    expect(strokePhaseAt(cycleAngleRad(crankAngleRad, 1))).toBe("exhaust");
  });
});
