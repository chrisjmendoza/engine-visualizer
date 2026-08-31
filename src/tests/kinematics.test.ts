import { describe, expect, it } from "vitest";
import {
  calculateMechanismState,
  calculatePistonAccelerationMmPerRad2,
  calculatePistonVelocityMmPerRad,
} from "../engine/kinematics";
import type { CrankMechanismConfig } from "../engine/types";
import { TWO_PI } from "../engine/constants";

const DEFAULT: CrankMechanismConfig = {
  boreMm: 86,
  strokeMm: 86,
  rodLengthMm: 143,
  compressionRatio: 10.5,
  redlineRpm: 7000,
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
    {
      boreMm: 86,
      strokeMm: 86,
      rodLengthMm: 143,
      compressionRatio: 10.5,
      redlineRpm: 7000,
    },
    {
      boreMm: 70,
      strokeMm: 60,
      rodLengthMm: 120,
      compressionRatio: 10.5,
      redlineRpm: 7000,
    },
    {
      boreMm: 150,
      strokeMm: 100,
      rodLengthMm: 180,
      compressionRatio: 10.5,
      redlineRpm: 7000,
    },
    {
      boreMm: 200,
      strokeMm: 200,
      rodLengthMm: 101,
      compressionRatio: 10.5,
      redlineRpm: 7000,
    },
    {
      boreMm: 20,
      strokeMm: 20,
      rodLengthMm: 30,
      compressionRatio: 10.5,
      redlineRpm: 7000,
    },
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

/**
 * Slider-crank motion depends on stroke and rod length alone; bore,
 * compression ratio, and redline are carried only to satisfy the config
 * type. Fixing them here keeps each derivative case down to the two numbers
 * that actually matter.
 */
function geometry(strokeMm: number, rodLengthMm: number): CrankMechanismConfig {
  return {
    boreMm: 86,
    strokeMm,
    rodLengthMm,
    compressionRatio: 10.5,
    redlineRpm: 7000,
  };
}

/**
 * Configurations spanning the legal rod-ratio range, from near-sinusoidal
 * to barely-legal. The last one (l/r = 1.01, just past validation's
 * `rodLength > stroke / 2` rule) is the important one: its radical
 * s = sqrt(l^2 - r^2 sin^2(theta)) nearly collapses around 90 degrees, which
 * is where a mis-transcribed term does the most damage and where a lazily
 * chosen finite-difference step stops being trustworthy.
 */
const DERIVATIVE_CONFIGS: CrankMechanismConfig[] = [
  geometry(86, 143), // l/r = 3.33, the default
  geometry(60, 120), // l/r = 4.00, long rod
  geometry(100, 180), // l/r = 3.60
  geometry(200, 101), // l/r = 1.01, near-degenerate
  geometry(20, 30), // l/r = 3.00, smallest legal engine
];

/** The displacement the two derivatives are supposed to be derivatives of. */
function displacementAt(config: CrankMechanismConfig, theta: number): number {
  return calculateMechanismState(config, theta).pistonDisplacementMm;
}

/**
 * Step sizes differ between the two orders, deliberately. A first central
 * difference divides by 2h and so amplifies double-precision roundoff by
 * ~1/h; a second central difference divides by h^2 and amplifies it by
 * ~1/h^2. At h = 1e-5 the first derivative agrees to ~1e-9 relative, but the
 * second is already swamped by roundoff (~2e-5 relative — it would pass a
 * carelessly loose tolerance while proving nothing). h = 1e-4 sits near the
 * second difference's optimum, where roundoff and O(h^2) truncation balance,
 * and holds every configuration above below ~2e-7 — including the
 * near-degenerate one, whose large higher derivatives are what rule out a
 * still-larger step.
 */
const VELOCITY_STEP_RAD = 1e-5;
const ACCELERATION_STEP_RAD = 1e-4;

const DERIVATIVE_TOLERANCE = 1e-6;

/**
 * Relative error, but scaled by the crank radius wherever the exact value
 * passes through zero (both derivatives do, twice a revolution), where a
 * pure relative comparison would be meaningless rather than merely strict.
 */
function relativeError(
  numerical: number,
  exact: number,
  crankRadiusMm: number,
): number {
  return Math.abs(numerical - exact) / Math.max(Math.abs(exact), crankRadiusMm);
}

/**
 * Numerical-differentiation guard for the closed forms.
 *
 * `calculatePistonVelocityMmPerRad` and
 * `calculatePistonAccelerationMmPerRad2` are hand-differentiated algebra,
 * so the failure they actually risk is a transcription slip — a dropped
 * chain-rule term, a sign, an exponent — that still draws plausible-looking
 * curves. Restating the same algebra in a test would reproduce the slip, so
 * these compare against central differences of the already-tested §9.4
 * displacement instead.
 */
describe("calculatePistonVelocityMmPerRad - versus numerical differentiation", () => {
  for (const config of DERIVATIVE_CONFIGS) {
    it(`matches a central difference of piston displacement for stroke=${config.strokeMm} rod=${config.rodLengthMm}`, () => {
      const crankRadiusMm = config.strokeMm / 2;
      const h = VELOCITY_STEP_RAD;

      for (let deg = 0; deg <= 360; deg++) {
        const theta = (deg / 360) * TWO_PI;
        const numerical =
          (displacementAt(config, theta + h) -
            displacementAt(config, theta - h)) /
          (2 * h);
        const exact = calculatePistonVelocityMmPerRad(config, theta);

        expect(relativeError(numerical, exact, crankRadiusMm)).toBeLessThan(
          DERIVATIVE_TOLERANCE,
        );
      }
    });
  }
});

describe("calculatePistonAccelerationMmPerRad2 - versus numerical differentiation", () => {
  for (const config of DERIVATIVE_CONFIGS) {
    it(`matches a second central difference of piston displacement for stroke=${config.strokeMm} rod=${config.rodLengthMm}`, () => {
      const crankRadiusMm = config.strokeMm / 2;
      const h = ACCELERATION_STEP_RAD;

      for (let deg = 0; deg <= 360; deg++) {
        const theta = (deg / 360) * TWO_PI;
        const numerical =
          (displacementAt(config, theta + h) -
            2 * displacementAt(config, theta) +
            displacementAt(config, theta - h)) /
          (h * h);
        const exact = calculatePistonAccelerationMmPerRad2(config, theta);

        expect(relativeError(numerical, exact, crankRadiusMm)).toBeLessThan(
          DERIVATIVE_TOLERANCE,
        );
      }
    });
  }
});

/** Crank angle (degrees) of maximum outward velocity, by a fine sweep. */
function peakVelocityAngleDeg(config: CrankMechanismConfig): number {
  let bestDeg = 0;
  let bestVelocity = -Infinity;
  for (let step = 0; step <= 18_000; step++) {
    const deg = step / 100;
    const velocity = calculatePistonVelocityMmPerRad(
      config,
      (deg / 360) * TWO_PI,
    );
    if (velocity > bestVelocity) {
      bestVelocity = velocity;
      bestDeg = deg;
    }
  }
  return bestDeg;
}

describe("calculatePistonVelocityMmPerRad - known values and shape", () => {
  it("is zero at both dead centers, for every configuration", () => {
    for (const config of DERIVATIVE_CONFIGS) {
      expect(calculatePistonVelocityMmPerRad(config, 0)).toBeCloseTo(0, 9);
      expect(calculatePistonVelocityMmPerRad(config, Math.PI)).toBeCloseTo(
        0,
        9,
      );
      expect(calculatePistonVelocityMmPerRad(config, TWO_PI)).toBeCloseTo(0, 9);
    }
  });

  it("is positive descending from TDC and negative returning to it", () => {
    // Velocity here is d(displacement from TDC)/d(theta): 0-180 degrees is
    // TDC toward BDC, so displacement grows; 180-360 degrees returns.
    expect(
      calculatePistonVelocityMmPerRad(DEFAULT, Math.PI / 2),
    ).toBeGreaterThan(0);
    expect(
      calculatePistonVelocityMmPerRad(DEFAULT, (3 * Math.PI) / 2),
    ).toBeLessThan(0);
  });

  it("treats theta and theta + 2*PI as equivalent", () => {
    for (let i = 0; i < 12; i++) {
      const theta = (i / 12) * TWO_PI - Math.PI;
      expect(
        calculatePistonVelocityMmPerRad(DEFAULT, theta + TWO_PI),
      ).toBeCloseTo(calculatePistonVelocityMmPerRad(DEFAULT, theta), 9);
    }
  });

  it("peaks before 90 degrees, and earlier the shorter the rod", () => {
    // Rod angularity, the whole reason piston motion is not sinusoidal:
    // maximum speed arrives before the crank reaches 90 degrees, and an
    // infinitely long rod would peak exactly at 90. Assert the ordering
    // only — the peak angle is a continuous function of the rod ratio and
    // not worth pinning to decimals.
    const byDescendingRodRatio = [300, 200, 143, 100, 60].map((rodLengthMm) =>
      geometry(86, rodLengthMm),
    );
    const peakAnglesDeg = byDescendingRodRatio.map(peakVelocityAngleDeg);

    for (const angle of peakAnglesDeg) {
      expect(angle).toBeGreaterThan(0);
      expect(angle).toBeLessThan(90);
    }

    // Strictly earlier with each shorter rod: the asymmetry grows.
    for (let i = 1; i < peakAnglesDeg.length; i++) {
      expect(peakAnglesDeg[i]).toBeLessThan(peakAnglesDeg[i - 1]);
    }

    // The longest rod here (l/r = 6.98) is already near the sinusoidal ideal.
    expect(peakAnglesDeg[0]).toBeGreaterThan(80);
  });
});

describe("calculatePistonAccelerationMmPerRad2 - known dead-center values", () => {
  it("equals r(1 + r/l) at TDC and -r(1 - r/l) at BDC", () => {
    // sin(theta) = 0 at both dead centers, so the radical collapses to l and
    // the closed form reduces to these two textbook expressions — the pair
    // that makes TDC the harder end for the rod and its bearings.
    for (const config of DERIVATIVE_CONFIGS) {
      const r = config.strokeMm / 2;
      const l = config.rodLengthMm;

      expect(calculatePistonAccelerationMmPerRad2(config, 0)).toBeCloseTo(
        r * (1 + r / l),
        9,
      );
      expect(calculatePistonAccelerationMmPerRad2(config, Math.PI)).toBeCloseTo(
        -r * (1 - r / l),
        9,
      );
      expect(calculatePistonAccelerationMmPerRad2(config, TWO_PI)).toBeCloseTo(
        r * (1 + r / l),
        9,
      );
    }
  });

  it("makes the TDC peak exceed the BDC peak, by more as the rod shortens", () => {
    // |a_TDC| / |a_BDC| = (1 + r/l) / (1 - r/l), growing without bound as l
    // approaches r. Ordering only, for the same reason as the velocity peak.
    const ratios = [300, 200, 143, 100, 60]
      .map((rodLengthMm) => geometry(86, rodLengthMm))
      .map((config) => {
        const atTdc = calculatePistonAccelerationMmPerRad2(config, 0);
        const atBdc = calculatePistonAccelerationMmPerRad2(config, Math.PI);
        return Math.abs(atTdc) / Math.abs(atBdc);
      });

    for (const ratio of ratios) {
      expect(ratio).toBeGreaterThan(1);
    }
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i]).toBeGreaterThan(ratios[i - 1]);
    }
  });

  it("is symmetric about TDC and about BDC", () => {
    // Acceleration is an even function of theta about both dead centers,
    // where velocity is odd — a second, cheap check on the sign structure.
    for (let deg = 5; deg < 180; deg += 5) {
      const theta = (deg / 360) * TWO_PI;
      expect(calculatePistonAccelerationMmPerRad2(DEFAULT, -theta)).toBeCloseTo(
        calculatePistonAccelerationMmPerRad2(DEFAULT, theta),
        9,
      );
      expect(
        calculatePistonAccelerationMmPerRad2(DEFAULT, Math.PI - theta),
      ).toBeCloseTo(
        calculatePistonAccelerationMmPerRad2(DEFAULT, Math.PI + theta),
        9,
      );
    }
  });
});
