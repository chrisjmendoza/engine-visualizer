import { describe, expect, it } from "vitest";
import { TWO_PI } from "../engine/constants";
import {
  DEFAULT_ROTARY_CONFIG,
  ROTOR_FACE_COUNT,
  SHAFT_REVS_PER_ROTOR_REV,
} from "../engine/rotaryConstants";
import {
  CHAMBER_ARC_RAD,
  calculateRotaryMechanismState,
  chamberArcStartRad,
  chamberAreaMm2,
  housingMaxRadiusMm,
  housingMinRadiusMm,
  housingPointMm,
  housingRadiusMm,
  rotorAngleRad,
  rotorApexAngleRad,
  rotorApexMm,
  rotorCenterMm,
  sampleHousingOutline,
} from "../engine/rotaryGeometry";
import type { RotaryConfig, RotaryPointMm } from "../engine/rotaryTypes";
import { degToRad } from "../engine/units";

/**
 * A spread of geometries, not just the 13B: the identity and the invariants
 * below are claims about the peritrochoid family, so a bug that happened to
 * cancel at K = 7 would go unnoticed if that were the only case tested.
 */
const CONFIGS: { label: string; config: RotaryConfig }[] = [
  { label: "13B (K = 7)", config: DEFAULT_ROTARY_CONFIG },
  {
    label: "wide-waist (K = 4)",
    config: {
      ...DEFAULT_ROTARY_CONFIG,
      generatingRadiusMm: 80,
      eccentricityMm: 20,
    },
  },
  {
    label: "near-circular (K = 13)",
    config: {
      ...DEFAULT_ROTARY_CONFIG,
      generatingRadiusMm: 130,
      eccentricityMm: 10,
    },
  },
];

function distance(a: RotaryPointMm, b: RotaryPointMm): number {
  return Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm);
}

describe("apex-on-housing identity", () => {
  /*
   * The rotary's loop closure. Proved algebraically in `rotaryGeometry.ts`'s
   * header (3·(θ/3 + 2πk/3) = θ + 2πk, so the housing's `e·cos3α` term
   * collapses to the rotor center's `e·cosθ`); asserted here numerically,
   * because a proof in a comment cannot catch a typo in the code under it.
   */
  for (const { label, config } of CONFIGS) {
    it(`places every apex exactly on the housing at every shaft angle - ${label}`, () => {
      let worstErrorMm = 0;

      // A dense sweep well past one 1080° cycle and into negative angles, so
      // that neither the 3:1 reduction nor the modulo behavior can hide.
      const steps = 4001;
      for (let i = 0; i < steps; i += 1) {
        const shaftAngleRad = -4 * Math.PI + (i / steps) * 20 * Math.PI;
        for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
          const apex = rotorApexMm(config, shaftAngleRad, k);
          const onHousing = housingPointMm(
            config,
            rotorApexAngleRad(shaftAngleRad, k),
          );
          worstErrorMm = Math.max(worstErrorMm, distance(apex, onHousing));
        }
      }

      expect(worstErrorMm).toBeLessThan(1e-12);
    });
  }

  it("holds for a phased rotor too", () => {
    // A phased rotor is an unphased one evaluated at theta + phase, so the
    // identity must survive the substitution untouched.
    const config = DEFAULT_ROTARY_CONFIG;
    let worstErrorMm = 0;

    for (const rotorPhaseRad of [Math.PI, TWO_PI / 3, -degToRad(37)]) {
      for (let i = 0; i < 720; i += 1) {
        const shaftAngleRad = degToRad(i * 1.5);
        for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
          const apex = rotorApexMm(config, shaftAngleRad, k, rotorPhaseRad);
          const onHousing = housingPointMm(
            config,
            rotorApexAngleRad(shaftAngleRad, k, rotorPhaseRad),
          );
          worstErrorMm = Math.max(worstErrorMm, distance(apex, onHousing));
        }
      }
    }

    expect(worstErrorMm).toBeLessThan(1e-12);
  });

  it("is not vacuous: a rotor turning at the wrong ratio leaves the housing", () => {
    // Guards the test above against passing because both sides call the same
    // formula. At any ratio but 3:1 the apex must come off the curve.
    const config = DEFAULT_ROTARY_CONFIG;
    const theta = degToRad(137);
    const wrongPhi = theta / 2;
    const apex = {
      xMm:
        config.eccentricityMm * Math.cos(theta) +
        config.generatingRadiusMm * Math.cos(wrongPhi),
      yMm:
        config.eccentricityMm * Math.sin(theta) +
        config.generatingRadiusMm * Math.sin(wrongPhi),
    };
    expect(distance(apex, housingPointMm(config, wrongPhi))).toBeGreaterThan(1);
  });
});

describe("housing shape", () => {
  it("runs between R - e at the waist and R + e at the lobe tips", () => {
    for (const { config } of CONFIGS) {
      let minRadiusMm = Infinity;
      let maxRadiusMm = -Infinity;
      for (let i = 0; i < 20000; i += 1) {
        const radiusMm = housingRadiusMm(config, (TWO_PI * i) / 20000);
        minRadiusMm = Math.min(minRadiusMm, radiusMm);
        maxRadiusMm = Math.max(maxRadiusMm, radiusMm);
      }
      expect(maxRadiusMm).toBeCloseTo(housingMaxRadiusMm(config), 9);
      expect(minRadiusMm).toBeCloseTo(housingMinRadiusMm(config), 9);
      expect(housingMaxRadiusMm(config)).toBeCloseTo(
        config.generatingRadiusMm + config.eccentricityMm,
        12,
      );
    }
  });

  it("puts the lobe tips on the X axis and the waist on the Y axis", () => {
    const config = DEFAULT_ROTARY_CONFIG;
    expect(housingRadiusMm(config, 0)).toBeCloseTo(
      housingMaxRadiusMm(config),
      12,
    );
    expect(housingRadiusMm(config, Math.PI)).toBeCloseTo(
      housingMaxRadiusMm(config),
      12,
    );
    expect(housingRadiusMm(config, Math.PI / 2)).toBeCloseTo(
      housingMinRadiusMm(config),
      12,
    );
  });

  it("agrees with the magnitude of housingPointMm", () => {
    const config = DEFAULT_ROTARY_CONFIG;
    for (let i = 0; i < 500; i += 1) {
      const alphaRad = (TWO_PI * i) / 500;
      const point = housingPointMm(config, alphaRad);
      expect(Math.hypot(point.xMm, point.yMm)).toBeCloseTo(
        housingRadiusMm(config, alphaRad),
        9,
      );
    }
  });

  it("is centrally symmetric: P(alpha + PI) = -P(alpha)", () => {
    // The two-lobe peanut. This is why the housing has exactly two lobes and
    // why the chamber-area period is 540 degrees of shaft rather than 1080.
    const config = DEFAULT_ROTARY_CONFIG;
    for (let i = 0; i < 360; i += 1) {
      const alphaRad = degToRad(i);
      const a = housingPointMm(config, alphaRad);
      const b = housingPointMm(config, alphaRad + Math.PI);
      expect(b.xMm).toBeCloseTo(-a.xMm, 9);
      expect(b.yMm).toBeCloseTo(-a.yMm, 9);
    }
  });
});

describe("sampleHousingOutline", () => {
  it("returns the requested number of points, all on the housing", () => {
    const config = DEFAULT_ROTARY_CONFIG;
    const outline = sampleHousingOutline(config, 256);
    expect(outline).toHaveLength(256);
    for (const point of outline) {
      const radiusMm = Math.hypot(point.xMm, point.yMm);
      expect(radiusMm).toBeGreaterThanOrEqual(
        housingMinRadiusMm(config) - 1e-9,
      );
      expect(radiusMm).toBeLessThanOrEqual(housingMaxRadiusMm(config) + 1e-9);
    }
  });

  it("does not duplicate the closing point", () => {
    const outline = sampleHousingOutline(DEFAULT_ROTARY_CONFIG, 64);
    const first = outline[0] as RotaryPointMm;
    const last = outline[outline.length - 1] as RotaryPointMm;
    expect(distance(first, last)).toBeGreaterThan(1);
  });

  it("floors at three points rather than returning a degenerate outline", () => {
    expect(sampleHousingOutline(DEFAULT_ROTARY_CONFIG, 0)).toHaveLength(3);
    expect(sampleHousingOutline(DEFAULT_ROTARY_CONFIG, -10)).toHaveLength(3);
  });
});

describe("rotor placement", () => {
  it("turns the rotor once per three shaft revolutions", () => {
    expect(rotorAngleRad(0)).toBeCloseTo(0, 12);
    expect(rotorAngleRad(SHAFT_REVS_PER_ROTOR_REV * TWO_PI)).toBeCloseTo(
      TWO_PI,
      12,
    );
    // One shaft revolution advances the rotor by exactly one apex pitch, which
    // is why a rotary fires once per shaft revolution per rotor.
    expect(rotorAngleRad(TWO_PI)).toBeCloseTo(TWO_PI / 3, 12);
  });

  it("divides a rotor phase by three along with the shaft angle", () => {
    expect(rotorAngleRad(0, Math.PI)).toBeCloseTo(Math.PI / 3, 12);
    // The defining property the cycle math leans on: phase psi at theta is the
    // same rotor as no phase at theta + psi.
    for (let i = 0; i < 100; i += 1) {
      const theta = degToRad(i * 7);
      expect(rotorAngleRad(theta, Math.PI)).toBeCloseTo(
        rotorAngleRad(theta + Math.PI),
        12,
      );
    }
  });

  it("keeps the rotor center on a circle of radius e", () => {
    const config = DEFAULT_ROTARY_CONFIG;
    for (let i = 0; i < 360; i += 1) {
      const center = rotorCenterMm(config, degToRad(i));
      expect(Math.hypot(center.xMm, center.yMm)).toBeCloseTo(
        config.eccentricityMm,
        9,
      );
    }
  });

  it("keeps all three apexes at radius R from the rotor center, 120 degrees apart", () => {
    const config = DEFAULT_ROTARY_CONFIG;
    for (let i = 0; i < 200; i += 1) {
      const theta = degToRad(i * 5.4);
      const center = rotorCenterMm(config, theta);
      const apexes = [0, 1, 2].map((k) => rotorApexMm(config, theta, k));

      for (const apex of apexes) {
        expect(distance(apex, center)).toBeCloseTo(
          config.generatingRadiusMm,
          9,
        );
      }
      // Equilateral: every apex-to-apex chord is R*sqrt(3).
      const side = config.generatingRadiusMm * Math.sqrt(3);
      expect(
        distance(apexes[0] as RotaryPointMm, apexes[1] as RotaryPointMm),
      ).toBeCloseTo(side, 9);
      expect(
        distance(apexes[1] as RotaryPointMm, apexes[2] as RotaryPointMm),
      ).toBeCloseTo(side, 9);
      expect(
        distance(apexes[2] as RotaryPointMm, apexes[0] as RotaryPointMm),
      ).toBeCloseTo(side, 9);
    }
  });

  it("treats apex indices cyclically", () => {
    const config = DEFAULT_ROTARY_CONFIG;
    const theta = degToRad(211);
    expect(
      distance(rotorApexMm(config, theta, 3), rotorApexMm(config, theta, 0)),
    ).toBeLessThan(1e-9);
  });

  it("writes into a caller-supplied target instead of allocating", () => {
    const config = DEFAULT_ROTARY_CONFIG;
    const target: RotaryPointMm = { xMm: 0, yMm: 0 };
    const returned = rotorApexMm(config, degToRad(45), 1, 0, target);
    expect(returned).toBe(target);
    expect(target).toEqual(rotorApexMm(config, degToRad(45), 1));

    const housingTarget: RotaryPointMm = { xMm: 0, yMm: 0 };
    expect(housingPointMm(config, 1.2, housingTarget)).toBe(housingTarget);
    const centerTarget: RotaryPointMm = { xMm: 0, yMm: 0 };
    expect(rotorCenterMm(config, 1.2, 0, centerTarget)).toBe(centerTarget);
  });
});

describe("chamberArcStartRad", () => {
  it("is the housing parameter of the apex that opens the face", () => {
    const config = DEFAULT_ROTARY_CONFIG;
    for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
      const theta = degToRad(97);
      const alphaStart = chamberArcStartRad(theta, k);
      expect(
        distance(
          housingPointMm(config, alphaStart),
          rotorApexMm(config, theta, k),
        ),
      ).toBeLessThan(1e-9);
      // ...and the arc ends on the next apex, 120 degrees of trochoid later.
      expect(
        distance(
          housingPointMm(config, alphaStart + CHAMBER_ARC_RAD),
          rotorApexMm(config, theta, k + 1),
        ),
      ).toBeLessThan(1e-9);
    }
  });
});

describe("chamberAreaMm2", () => {
  it("is positive and bounded by the whole housing area", () => {
    const config = DEFAULT_ROTARY_CONFIG;
    const housingAreaMm2 =
      Math.PI *
      (3 * config.eccentricityMm * config.eccentricityMm +
        config.generatingRadiusMm * config.generatingRadiusMm);
    for (let i = 0; i < 200; i += 1) {
      const area = chamberAreaMm2(config, degToRad(i * 5.4), 0);
      expect(area).toBeGreaterThan(0);
      expect(area).toBeLessThan(housingAreaMm2);
    }
  });

  it("keeps the three chambers summing to a constant", () => {
    /*
     * A rigid rotor inside a fixed housing: whatever one chamber gains the
     * other two lose. Analytically the three cosine terms are 120 degrees
     * apart and cancel, leaving
     *
     *     sum = PI*(3e^2 + R^2) - (3*sqrt(3)/4)*R^2
     *
     * i.e. the housing's own area minus the inscribed equilateral triangle's.
     * This catches an indexing or sign error that a single-chamber test would
     * not.
     */
    for (const { config } of CONFIGS) {
      const expectedMm2 =
        Math.PI *
          (3 * config.eccentricityMm * config.eccentricityMm +
            config.generatingRadiusMm * config.generatingRadiusMm) -
        ((3 * Math.sqrt(3)) / 4) *
          config.generatingRadiusMm *
          config.generatingRadiusMm;

      for (let i = 0; i < 120; i += 1) {
        const theta = degToRad(i * 9);
        const sum =
          chamberAreaMm2(config, theta, 0, 0, 2048) +
          chamberAreaMm2(config, theta, 1, 0, 2048) +
          chamberAreaMm2(config, theta, 2, 0, 2048);
        expect(sum).toBeCloseTo(expectedMm2, 1);
      }
    }
  });

  it("floors its sample count rather than dividing by zero", () => {
    const config = DEFAULT_ROTARY_CONFIG;
    expect(Number.isFinite(chamberAreaMm2(config, 1, 0, 0, 0))).toBe(true);
    expect(Number.isFinite(chamberAreaMm2(config, 1, 0, 0, -5))).toBe(true);
  });

  it("converges as the sample count rises", () => {
    const config = DEFAULT_ROTARY_CONFIG;
    const theta = degToRad(200);
    const coarse = chamberAreaMm2(config, theta, 0, 0, 64);
    const fine = chamberAreaMm2(config, theta, 0, 0, 8192);
    const finer = chamberAreaMm2(config, theta, 0, 0, 32768);
    expect(Math.abs(finer - fine)).toBeLessThan(Math.abs(fine - coarse));
  });
});

describe("calculateRotaryMechanismState", () => {
  it("agrees with the individual accessors", () => {
    const config = DEFAULT_ROTARY_CONFIG;
    const theta = degToRad(311);
    const phase = Math.PI;
    const state = calculateRotaryMechanismState(config, theta, phase);

    expect(state.shaftAngleRad).toBe(theta);
    expect(state.rotorAngleRad).toBeCloseTo(rotorAngleRad(theta, phase), 12);
    expect(state.rotorCenterMm).toEqual(rotorCenterMm(config, theta, phase));
    expect(state.apexesMm).toHaveLength(ROTOR_FACE_COUNT);
    state.apexesMm.forEach((apex, k) => {
      expect(distance(apex, rotorApexMm(config, theta, k, phase))).toBeLessThan(
        1e-12,
      );
    });
  });

  it("does not normalize the shaft angle, because the 3:1 reduction needs it", () => {
    // theta and theta + 2*PI put the rotor 120 degrees apart. A state that
    // wrapped its input would draw the rotor in the wrong place on two shaft
    // revolutions out of every three.
    const config = DEFAULT_ROTARY_CONFIG;
    const a = calculateRotaryMechanismState(config, degToRad(30));
    const b = calculateRotaryMechanismState(config, degToRad(30) + TWO_PI);
    expect(b.rotorAngleRad - a.rotorAngleRad).toBeCloseTo(TWO_PI / 3, 12);
    // The rotor *center*, riding the shaft lobe, does repeat every revolution.
    expect(distance(a.rotorCenterMm, b.rotorCenterMm)).toBeLessThan(1e-9);
  });
});
