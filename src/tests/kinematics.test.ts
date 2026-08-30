import { describe, expect, it } from "vitest";
import { calculateMechanismState } from "../engine/kinematics";
import type { CrankMechanismConfig } from "../engine/types";
import { TWO_PI } from "../engine/constants";

const DEFAULT: CrankMechanismConfig = {
  boreMm: 86,
  strokeMm: 86,
  rodLengthMm: 143,
};

const CRANK_RADIUS_MM = DEFAULT.strokeMm / 2; // 43

describe("calculateMechanismState - known crank positions (default config)", () => {
  it("top dead center (0 deg)", () => {
    const state = calculateMechanismState(DEFAULT, 0);
    expect(state.crankPinXmm).toBeCloseTo(0, 9);
    expect(state.crankPinYmm).toBeCloseTo(CRANK_RADIUS_MM, 9);
    expect(state.pistonPinYmm).toBeCloseTo(
      CRANK_RADIUS_MM + DEFAULT.rodLengthMm,
      9,
    );
    expect(state.pistonDisplacementMm).toBeCloseTo(0, 9);
    expect(state.rodAngleRad).toBeCloseTo(0, 9);
  });

  it("mid-stroke (90 deg) matches the slider-crank formula and shows rod angularity", () => {
    const state = calculateMechanismState(DEFAULT, Math.PI / 2);

    // Crankpin X equals the crank radius at 90 degrees.
    expect(state.crankPinXmm).toBeCloseTo(CRANK_RADIUS_MM, 9);

    // Independently computed via r*cos(theta) + sqrt(l^2 - r^2*sin^2(theta))
    // with r=43, l=143, theta=90deg: sqrt(143^2 - 43^2) = sqrt(18600).
    expect(state.pistonPinYmm).toBeCloseTo(136.38181696985856, 9);
    expect(state.pistonDisplacementMm).toBeCloseTo(49.61818303014144, 9);
    expect(state.rodAngleRad).toBeCloseTo(0.30542580492003557, 9);

    // Rod angularity: at 90 degrees the piston has traveled further than the
    // crank radius, unlike a pure sinusoidal (infinite-rod) approximation
    // where displacement at 90 degrees would equal the crank radius exactly.
    expect(state.pistonDisplacementMm).toBeGreaterThan(CRANK_RADIUS_MM);
  });

  it("bottom dead center (180 deg)", () => {
    const state = calculateMechanismState(DEFAULT, Math.PI);
    expect(state.crankPinXmm).toBeCloseTo(0, 9);
    expect(state.pistonDisplacementMm).toBeCloseTo(DEFAULT.strokeMm, 9);
    expect(state.rodAngleRad).toBeCloseTo(0, 9);
  });

  it("full revolution (360 deg) matches 0 deg", () => {
    const zero = calculateMechanismState(DEFAULT, 0);
    const full = calculateMechanismState(DEFAULT, TWO_PI);
    expect(full.crankPinXmm).toBeCloseTo(zero.crankPinXmm, 9);
    expect(full.crankPinYmm).toBeCloseTo(zero.crankPinYmm, 9);
    expect(full.pistonPinYmm).toBeCloseTo(zero.pistonPinYmm, 9);
    expect(full.pistonDisplacementMm).toBeCloseTo(zero.pistonDisplacementMm, 9);
    expect(full.rodAngleRad).toBeCloseTo(zero.rodAngleRad, 9);
  });

  it("rod-angle sign convention: positive when the crankpin swings toward +X", () => {
    // Just past TDC, in the first quarter turn, the crankpin has swung
    // toward +X (crankPinXmm > 0), so the rod angle must also be positive.
    const state = calculateMechanismState(DEFAULT, Math.PI / 4);
    expect(state.crankPinXmm).toBeGreaterThan(0);
    expect(state.rodAngleRad).toBeGreaterThan(0);

    // In the second quarter turn (past 90 deg but before 180 deg), the
    // crankpin is still on the +X side (sin stays positive through 180 deg),
    // so the rod angle stays positive too.
    const state2 = calculateMechanismState(DEFAULT, (3 * Math.PI) / 4);
    expect(state2.crankPinXmm).toBeGreaterThan(0);
    expect(state2.rodAngleRad).toBeGreaterThan(0);

    // Past 180 deg, the crankpin swings to the -X side, and the rod angle
    // follows it negative.
    const state3 = calculateMechanismState(DEFAULT, Math.PI + Math.PI / 4);
    expect(state3.crankPinXmm).toBeLessThan(0);
    expect(state3.rodAngleRad).toBeLessThan(0);
  });
});

describe("calculateMechanismState - invariants across configurations", () => {
  const configs: CrankMechanismConfig[] = [
    { boreMm: 86, strokeMm: 86, rodLengthMm: 143 },
    { boreMm: 70, strokeMm: 60, rodLengthMm: 120 },
    { boreMm: 150, strokeMm: 100, rodLengthMm: 180 },
    { boreMm: 200, strokeMm: 200, rodLengthMm: 101 },
    { boreMm: 20, strokeMm: 20, rodLengthMm: 30 },
  ];

  const ANGLE_STEPS = 73; // includes 0, 5, 10, ... 360 degrees

  for (const config of configs) {
    const r = config.strokeMm / 2;
    const l = config.rodLengthMm;

    it(`produces finite, bounded values for stroke=${config.strokeMm} rod=${config.rodLengthMm}`, () => {
      for (let i = 0; i < ANGLE_STEPS; i++) {
        const theta = (i / (ANGLE_STEPS - 1)) * TWO_PI;
        const state = calculateMechanismState(config, theta);

        for (const value of [
          state.crankPinXmm,
          state.crankPinYmm,
          state.pistonPinYmm,
          state.pistonDisplacementMm,
          state.rodAngleRad,
        ]) {
          expect(Number.isFinite(value)).toBe(true);
        }

        expect(state.pistonDisplacementMm).toBeGreaterThanOrEqual(-1e-9);
        expect(state.pistonDisplacementMm).toBeLessThanOrEqual(
          config.strokeMm + 1e-9,
        );

        // The sqrt argument must never be negative for a valid configuration
        // (rodLength > crank radius guarantees l^2 >= r^2*sin^2(theta)).
        const sqrtArg = l * l - r * r * Math.sin(theta) * Math.sin(theta);
        expect(sqrtArg).toBeGreaterThanOrEqual(0);

        // Distance between crankpin and piston pin must equal rod length
        // (piston pin lies on the cylinder centerline, x=0).
        const dx = state.crankPinXmm - 0;
        const dy = state.crankPinYmm - state.pistonPinYmm;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const relativeError = Math.abs(distance - l) / l;
        expect(relativeError).toBeLessThan(1e-9);
      }
    });

    it(`treats theta and theta + 2*PI as equivalent for stroke=${config.strokeMm} rod=${config.rodLengthMm}`, () => {
      for (let i = 0; i < 12; i++) {
        const theta = (i / 12) * TWO_PI - Math.PI;
        const a = calculateMechanismState(config, theta);
        const b = calculateMechanismState(config, theta + TWO_PI);

        expect(b.crankPinXmm).toBeCloseTo(a.crankPinXmm, 9);
        expect(b.crankPinYmm).toBeCloseTo(a.crankPinYmm, 9);
        expect(b.pistonPinYmm).toBeCloseTo(a.pistonPinYmm, 9);
        expect(b.pistonDisplacementMm).toBeCloseTo(a.pistonDisplacementMm, 9);
        expect(b.rodAngleRad).toBeCloseTo(a.rodAngleRad, 9);
      }
    });
  }
});
