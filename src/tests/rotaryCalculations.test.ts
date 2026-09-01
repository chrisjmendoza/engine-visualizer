import { describe, expect, it } from "vitest";
import { TWO_PI } from "../engine/constants";
import {
  THREE_ROOT_THREE,
  calculateChamberDisplacementCc,
  calculateChamberVolumeCc,
  calculateFiringsPerShaftRevolution,
  calculateKFactor,
  calculateRotaryClearanceVolumeCc,
  calculateRotaryEngineDisplacementCc,
  calculateRotorSpeedRpm,
} from "../engine/rotaryCalculations";
import { DEFAULT_ROTARY_CONFIG } from "../engine/rotaryConstants";
import {
  ROTARY_CYCLE_SPAN_RAD,
  ROTARY_PHASE_SPAN_RAD,
  rotorFaceCycleAngleRad,
} from "../engine/rotaryCycle";
import { chamberAreaMm2 } from "../engine/rotaryGeometry";
import type { RotaryConfig } from "../engine/rotaryTypes";
import { degToRad } from "../engine/units";

/** The Mazda 13B: e = 15 mm, R = 105 mm, b = 80 mm. */
const THIRTEEN_B = DEFAULT_ROTARY_CONFIG;

describe("calculateChamberDisplacementCc - the reality check", () => {
  it("gives the 13B's published chamber displacement from 3*sqrt(3)*e*R*b", () => {
    const displacementCc = calculateChamberDisplacementCc(THIRTEEN_B);

    // 3*sqrt(3) * 15 * 105 * 80 = 654,715.2 mm^3.
    //
    // Mazda publishes 654 cc per chamber and 1,308 cc for the two-rotor
    // engine. The 0.11% gap is rounding in the published dimensions, not a
    // modeling error -- note that the spec this was built from quoted 654.5,
    // which the arithmetic does not support; 654.7 is what 3*sqrt(3)*e*R*b
    // returns and what the numerical area sweep below independently confirms.
    expect(displacementCc).toBeCloseTo(654.715, 3);
    expect(Math.abs(displacementCc - 654) / 654).toBeLessThan(0.002);
  });

  it("rates a two-rotor 13B at Mazda's 1,308 cc", () => {
    const engineCc = calculateRotaryEngineDisplacementCc(THIRTEEN_B, 2);
    expect(engineCc).toBeCloseTo(1309.43, 2);
    expect(Math.abs(engineCc - 1308) / 1308).toBeLessThan(0.002);
  });

  it("matches the 12A's published 573 cc on the same formula with b = 70", () => {
    // Same rotor and housing radii, a narrower housing. The published figure
    // is 573 cc per chamber / 1,146 cc for the engine; sourcing the width
    // itself belongs to the preset roster, this only checks that one formula
    // covers both engines.
    const twelveA: RotaryConfig = { ...THIRTEEN_B, rotorWidthMm: 70 };
    expect(calculateChamberDisplacementCc(twelveA)).toBeCloseTo(572.876, 3);
    expect(calculateRotaryEngineDisplacementCc(twelveA, 2)).toBeCloseTo(
      1145.75,
      2,
    );
  });

  it("scales linearly in every dimension", () => {
    const doubledWidth: RotaryConfig = { ...THIRTEEN_B, rotorWidthMm: 160 };
    expect(calculateChamberDisplacementCc(doubledWidth)).toBeCloseTo(
      2 * calculateChamberDisplacementCc(THIRTEEN_B),
      9,
    );
    const doubledEccentricity: RotaryConfig = {
      ...THIRTEEN_B,
      eccentricityMm: 30,
    };
    expect(calculateChamberDisplacementCc(doubledEccentricity)).toBeCloseTo(
      2 * calculateChamberDisplacementCc(THIRTEEN_B),
      9,
    );
  });

  it("uses 3*sqrt(3), not an approximation of it", () => {
    expect(THREE_ROOT_THREE).toBeCloseTo(5.196152422706632, 15);
    // Math.SQRT3 does not exist; a typo reaching for it would yield NaN.
    expect(Number.isFinite(THREE_ROOT_THREE)).toBe(true);
  });

  it("multiplies by the rotor count, per the industry convention", () => {
    for (const rotorCount of [1, 2, 3] as const) {
      expect(
        calculateRotaryEngineDisplacementCc(THIRTEEN_B, rotorCount),
      ).toBeCloseTo(rotorCount * calculateChamberDisplacementCc(THIRTEEN_B), 9);
    }
  });
});

describe("the displacement formula against a numerical area sweep", () => {
  it("swept area max - min equals 3*sqrt(3)*e*R, i.e. Vd/b", () => {
    /*
     * The independent confirmation: `calculateChamberDisplacementCc` is a
     * closed form, `chamberAreaMm2` is a shoelace over a sampled outline, and
     * they were derived by different routes. If the formula were wrong this is
     * where it would show.
     */
    const configs: RotaryConfig[] = [
      THIRTEEN_B,
      { ...THIRTEEN_B, generatingRadiusMm: 80, eccentricityMm: 20 },
      { ...THIRTEEN_B, generatingRadiusMm: 130, eccentricityMm: 10 },
    ];

    for (const config of configs) {
      let minAreaMm2 = Infinity;
      let maxAreaMm2 = -Infinity;
      // One-degree steps across a full 1080-degree cycle. The extrema fall at
      // multiples of 90 degrees of shaft (see `rotaryCycle.test.ts`), so this
      // grid lands on them exactly and the only error left is the shoelace's.
      for (let i = 0; i < 1080; i += 1) {
        const areaMm2 = chamberAreaMm2(config, degToRad(i), 0, 0, 1024);
        minAreaMm2 = Math.min(minAreaMm2, areaMm2);
        maxAreaMm2 = Math.max(maxAreaMm2, areaMm2);
      }

      const sweptAreaMm2 =
        (calculateChamberDisplacementCc(config) * 1000) / config.rotorWidthMm;
      expect(maxAreaMm2 - minAreaMm2).toBeCloseTo(sweptAreaMm2, 0);
      expect(
        Math.abs(maxAreaMm2 - minAreaMm2 - sweptAreaMm2) / sweptAreaMm2,
      ).toBeLessThan(1e-4);
      expect(sweptAreaMm2).toBeCloseTo(
        THREE_ROOT_THREE * config.eccentricityMm * config.generatingRadiusMm,
        9,
      );
    }
  });

  it("matches the closed-form chamber area at every angle", () => {
    // Area(alpha0) = (3e^2 + R^2)*PI/3 - (sqrt(3)/4)*R^2
    //                - (3*sqrt(3)/2)*e*R*cos(2*alpha0 - PI/3)
    const { eccentricityMm: e, generatingRadiusMm: r } = THIRTEEN_B;
    const constantMm2 =
      ((3 * e * e + r * r) * Math.PI) / 3 - (Math.sqrt(3) / 4) * r * r;
    const amplitudeMm2 = (THREE_ROOT_THREE / 2) * e * r;

    let worstMm2 = 0;
    for (let i = 0; i < 720; i += 1) {
      const alpha0 = (TWO_PI * i) / 720;
      const closedForm =
        constantMm2 - amplitudeMm2 * Math.cos(2 * alpha0 - Math.PI / 3);
      // Face 0's arc starts at alpha0 when theta = 3*alpha0.
      const sampled = chamberAreaMm2(THIRTEEN_B, 3 * alpha0, 0, 0, 1024);
      worstMm2 = Math.max(worstMm2, Math.abs(sampled - closedForm));
    }
    expect(worstMm2).toBeLessThan(0.05);
  });
});

describe("calculateKFactor", () => {
  it("is 7.0 for the 13B", () => {
    expect(calculateKFactor(THIRTEEN_B)).toBeCloseTo(7, 12);
  });

  it("is scale-invariant, like a rod-to-stroke ratio", () => {
    const scaled: RotaryConfig = {
      ...THIRTEEN_B,
      generatingRadiusMm: THIRTEEN_B.generatingRadiusMm * 1.37,
      eccentricityMm: THIRTEEN_B.eccentricityMm * 1.37,
    };
    expect(calculateKFactor(scaled)).toBeCloseTo(
      calculateKFactor(THIRTEEN_B),
      12,
    );
  });
});

describe("chamber volume", () => {
  it("puts the clearance volume at Vd / (CR - 1)", () => {
    const clearanceCc = calculateRotaryClearanceVolumeCc(THIRTEEN_B);
    expect(clearanceCc).toBeCloseTo(
      calculateChamberDisplacementCc(THIRTEEN_B) /
        (THIRTEEN_B.compressionRatio - 1),
      9,
    );
    // ...and therefore recovers the compression ratio it came from.
    const sweptCc = calculateChamberDisplacementCc(THIRTEEN_B);
    expect((clearanceCc + sweptCc) / clearanceCc).toBeCloseTo(
      THIRTEEN_B.compressionRatio,
      9,
    );
  });

  it("is minimum at the cycle start and at firing, maximum a quarter-cycle after each", () => {
    const clearanceCc = calculateRotaryClearanceVolumeCc(THIRTEEN_B);
    const sweptCc = calculateChamberDisplacementCc(THIRTEEN_B);

    // The four phase boundaries, in face cycle angle.
    expect(calculateChamberVolumeCc(THIRTEEN_B, 0)).toBeCloseTo(clearanceCc, 9);
    expect(
      calculateChamberVolumeCc(THIRTEEN_B, ROTARY_PHASE_SPAN_RAD),
    ).toBeCloseTo(clearanceCc + sweptCc, 9);
    expect(
      calculateChamberVolumeCc(THIRTEEN_B, 2 * ROTARY_PHASE_SPAN_RAD),
    ).toBeCloseTo(clearanceCc, 9);
    expect(
      calculateChamberVolumeCc(THIRTEEN_B, 3 * ROTARY_PHASE_SPAN_RAD),
    ).toBeCloseTo(clearanceCc + sweptCc, 9);
  });

  it("never leaves [clearance, clearance + swept]", () => {
    const clearanceCc = calculateRotaryClearanceVolumeCc(THIRTEEN_B);
    const sweptCc = calculateChamberDisplacementCc(THIRTEEN_B);
    for (let i = -2000; i < 2000; i += 1) {
      const volume = calculateChamberVolumeCc(THIRTEEN_B, degToRad(i * 3));
      expect(volume).toBeGreaterThanOrEqual(clearanceCc - 1e-9);
      expect(volume).toBeLessThanOrEqual(clearanceCc + sweptCc + 1e-9);
    }
  });

  it("repeats every 1080 degrees of face cycle angle", () => {
    for (let i = 0; i < 200; i += 1) {
      const gamma = degToRad(i * 5.4);
      expect(
        calculateChamberVolumeCc(THIRTEEN_B, gamma + ROTARY_CYCLE_SPAN_RAD),
      ).toBeCloseTo(calculateChamberVolumeCc(THIRTEEN_B, gamma), 9);
      expect(
        calculateChamberVolumeCc(THIRTEEN_B, gamma - ROTARY_CYCLE_SPAN_RAD),
      ).toBeCloseTo(calculateChamberVolumeCc(THIRTEEN_B, gamma), 9);
    }
  });

  it("tracks the numerically swept chamber area, offset by the rotor flank", () => {
    /*
     * Ties the closed form back to the geometry module: chamber volume and
     * shoelace area must differ by a *constant* (the rigid rotor's flank
     * bulge, times width). Checking that the difference has no variation is a
     * stronger statement than checking either curve alone -- it would catch a
     * phase error, a sign error, or a wrong 2/3 factor.
     */
    let minDiffCc = Infinity;
    let maxDiffCc = -Infinity;
    for (let i = 0; i < 540; i += 1) {
      const shaftAngleRad = degToRad(i * 2);
      const areaVolumeCc =
        (chamberAreaMm2(THIRTEEN_B, shaftAngleRad, 0, 0, 1024) *
          THIRTEEN_B.rotorWidthMm) /
        1000;
      const modelVolumeCc = calculateChamberVolumeCc(
        THIRTEEN_B,
        rotorFaceCycleAngleRad(0, shaftAngleRad),
      );
      const diffCc = areaVolumeCc - modelVolumeCc;
      minDiffCc = Math.min(minDiffCc, diffCc);
      maxDiffCc = Math.max(maxDiffCc, diffCc);
    }
    // The swept volume itself is 654.7 cc, so a 0.005 cc spread is eight
    // parts per million of it -- and it is shoelace noise, not physics.
    expect(maxDiffCc - minDiffCc).toBeLessThan(5e-3);
  });
});

describe("speeds and firing counts", () => {
  it("spins the rotor at a third of shaft speed", () => {
    expect(calculateRotorSpeedRpm(9000)).toBeCloseTo(3000, 9);
    expect(calculateRotorSpeedRpm(0)).toBe(0);
  });

  it("fires once per shaft revolution per rotor", () => {
    expect(calculateFiringsPerShaftRevolution(1)).toBeCloseTo(1, 12);
    expect(calculateFiringsPerShaftRevolution(2)).toBeCloseTo(2, 12);
    expect(calculateFiringsPerShaftRevolution(3)).toBeCloseTo(3, 12);
  });
});
