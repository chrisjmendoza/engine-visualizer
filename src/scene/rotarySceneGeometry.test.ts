/**
 * The rotary family's drawn proportions (§27).
 *
 * Two kinds of claim are checked here. The first is that what the scene draws
 * as the housing *is* the engine layer's peritrochoid, sample for sample —
 * `rotaryGeometry.test.ts` proves the curve is right, and this proves the
 * renderer did not quietly re-derive it. The second is the one genuinely new
 * decision this module makes: how deep the stylized rotor flank arc bulges,
 * which is pinned to a geometric limit rather than chosen, and must leave the
 * drawn rotor strictly inside its housing at every shaft angle and everywhere
 * in the validated input range.
 *
 * Pure arithmetic, so no WebGL is needed.
 */

import { describe, expect, it } from "vitest";
import { TWO_PI } from "../engine/constants";
import { ROTARY_INPUT_RANGES } from "../engine/rotaryConstants";
import {
  housingMaxRadiusMm,
  housingPointMm,
  rotorAngleRad,
  rotorCenterMm,
} from "../engine/rotaryGeometry";
import type { RotaryConfig, RotaryPointMm } from "../engine/rotaryTypes";
import {
  HOUSING_OUTLINE_SAMPLES,
  HOUSING_WALL_FRACTION,
  ROTOR_FLANK_CLEARANCE_FRACTION,
  ROTOR_FLANK_SAMPLES,
  ROTOR_SKIN_FRACTION,
  deriveRotaryProportions,
  drawnHousingMaxRadiusMm,
} from "./rotarySceneGeometry";

/** The canonical 13B geometry every derivation in the tree is checked against. */
const THIRTEEN_B: RotaryConfig = {
  generatingRadiusMm: 105,
  eccentricityMm: 15,
  rotorWidthMm: 80,
  compressionRatio: 9,
  redlineRpm: 8000,
};

function config(
  generatingRadiusMm: number,
  eccentricityMm: number,
  rotorWidthMm = 80,
): RotaryConfig {
  return {
    generatingRadiusMm,
    eccentricityMm,
    rotorWidthMm,
    compressionRatio: 9,
    redlineRpm: 8000,
  };
}

/**
 * Corners of the validated input range, plus the interesting interior points.
 *
 * `ROTARY_INPUT_RANGES` allows R = 60 with e = 25, which K > 3 forbids, so the
 * grid below takes only the combinations validation would actually let
 * through — including ones right against the K = 3 floor, where the housing is
 * nearly cusped and the flank has least room.
 */
const RANGE_CORNERS: readonly RotaryConfig[] = [
  THIRTEEN_B,
  config(
    ROTARY_INPUT_RANGES.generatingRadiusMm.min,
    ROTARY_INPUT_RANGES.eccentricityMm.min,
  ),
  config(
    ROTARY_INPUT_RANGES.generatingRadiusMm.max,
    ROTARY_INPUT_RANGES.eccentricityMm.min,
  ),
  config(
    ROTARY_INPUT_RANGES.generatingRadiusMm.max,
    ROTARY_INPUT_RANGES.eccentricityMm.max,
  ),
  // K = 4 exactly: the sagitta's theoretical limit is zero here, the case the
  // arc sampler must degenerate through without dividing by it.
  config(100, 25),
  // Just above the K = 3 cusp, at both ends of the radius range.
  config(76, 25),
  config(60, 19.9),
];

/**
 * The housing sampled far more finely than the renderer does, as flat arrays.
 *
 * Finer so a containment failure cannot be an artifact of the drawn polygon
 * cutting corners: every chord of this polygon lies inside the true curve, so
 * anything it contains the real housing contains too. Flat because the sweep
 * below runs it hundreds of thousands of times.
 */
const DENSE_HOUSING_SAMPLES = 1200;

interface DenseHousing {
  xs: Float64Array;
  ys: Float64Array;
}

function denseHousing(c: RotaryConfig): DenseHousing {
  const xs = new Float64Array(DENSE_HOUSING_SAMPLES);
  const ys = new Float64Array(DENSE_HOUSING_SAMPLES);
  for (let i = 0; i < DENSE_HOUSING_SAMPLES; i += 1) {
    const point = housingPointMm(c, (TWO_PI * i) / DENSE_HOUSING_SAMPLES);
    xs[i] = point.xMm;
    ys[i] = point.yMm;
  }
  return { xs, ys };
}

/** Ray-crossing containment against a densely sampled housing. */
function isInsideHousing(point: RotaryPointMm, housing: DenseHousing): boolean {
  const { xs, ys } = housing;
  let inside = false;
  for (let i = 0, j = xs.length - 1; i < xs.length; j = i, i += 1) {
    if (
      ys[i] > point.yMm !== ys[j] > point.yMm &&
      point.xMm <
        ((xs[j] - xs[i]) * (point.yMm - ys[i])) / (ys[j] - ys[i]) + xs[i]
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Rotor-frame point moved onto the stage at one shaft angle. */
function toWorld(
  c: RotaryConfig,
  shaftAngleRad: number,
  local: RotaryPointMm,
  faceIndex: number,
): RotaryPointMm {
  const center = rotorCenterMm(c, shaftAngleRad);
  const angle = rotorAngleRad(shaftAngleRad) + (TWO_PI * faceIndex) / 3;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    xMm: center.xMm + local.xMm * cos - local.yMm * sin,
    yMm: center.yMm + local.xMm * sin + local.yMm * cos,
  };
}

describe("deriveRotaryProportions - the housing", () => {
  it("draws the engine layer's peritrochoid, sample for sample", () => {
    const p = deriveRotaryProportions(THIRTEEN_B);

    expect(p.housingInnerMm).toHaveLength(HOUSING_OUTLINE_SAMPLES);
    p.housingInnerMm.forEach((point, i) => {
      const expected = housingPointMm(
        THIRTEEN_B,
        (TWO_PI * i) / HOUSING_OUTLINE_SAMPLES,
      );
      expect(point.xMm).toBeCloseTo(expected.xMm, 12);
      expect(point.yMm).toBeCloseTo(expected.yMm, 12);
    });
  });

  it("puts the wall outside the working surface by a fixed fraction", () => {
    const p = deriveRotaryProportions(THIRTEEN_B);

    p.housingOuterMm.forEach((outer, i) => {
      const inner = p.housingInnerMm[i];
      expect(Math.hypot(outer.xMm, outer.yMm)).toBeCloseTo(
        Math.hypot(inner.xMm, inner.yMm) * (1 + HOUSING_WALL_FRACTION),
        9,
      );
    });
  });

  it("reaches R + e horizontally, plus the wall", () => {
    for (const c of RANGE_CORNERS) {
      const p = deriveRotaryProportions(c);
      // The lobe tips sit exactly on the X axis, so a sampled outline hits
      // them exactly whenever the sample count is even.
      expect(p.bounds.maxX).toBeCloseTo(drawnHousingMaxRadiusMm(c), 9);
      expect(p.bounds.minX).toBeCloseTo(-drawnHousingMaxRadiusMm(c), 9);
      expect(drawnHousingMaxRadiusMm(c)).toBeCloseTo(
        housingMaxRadiusMm(c) * (1 + HOUSING_WALL_FRACTION),
        12,
      );
    }
  });

  it("stands at least as tall as the waist, and taller below K = 9", () => {
    // R - e is the housing's least *radius*, at the waist on the Y axis, and
    // it is only sometimes the housing's height. Differentiating
    // P_y(α) = e·sin 3α + R·sin α at α = π/2 gives a turning point whose
    // second derivative changes sign at R = 9e: above K = 9 the waist really
    // is the top of the curve, and below it the curve bulges past the waist on
    // either side. So the vertical extent has to be measured from the samples,
    // and this is why — a closed form taken from R - e would clip every
    // housing a real rotary has ever used (a 13B is K = 7).
    for (const c of RANGE_CORNERS) {
      const p = deriveRotaryProportions(c);
      const waist =
        (c.generatingRadiusMm - c.eccentricityMm) * (1 + HOUSING_WALL_FRACTION);
      const kFactor = c.generatingRadiusMm / c.eccentricityMm;

      if (kFactor < 9) {
        expect(p.bounds.maxY).toBeGreaterThan(waist);
      } else {
        expect(p.bounds.maxY).toBeCloseTo(waist, 6);
      }
      // Never past the greatest radius, which no point of the curve exceeds.
      expect(p.bounds.maxY).toBeLessThan(drawnHousingMaxRadiusMm(c));
      expect(p.bounds.minY).toBeCloseTo(-p.bounds.maxY, 9);
    }
  });

  it("is 1.4% taller than the waist for a 13B, a gap a closed form would have missed", () => {
    // Spelled out once with real numbers so the inequality above is not
    // vacuously true: 91.29 mm against the waist's 90.
    const p = deriveRotaryProportions(THIRTEEN_B);
    expect(p.bounds.maxY / (1 + HOUSING_WALL_FRACTION)).toBeCloseTo(91.2871, 3);
  });
});

describe("deriveRotaryProportions - the rotor flank", () => {
  it("starts and ends exactly on apexes 0 and 1", () => {
    const p = deriveRotaryProportions(THIRTEEN_B);
    const first = p.rotorFlankMm[0];
    const last = p.rotorFlankMm[p.rotorFlankMm.length - 1];

    expect(p.rotorFlankMm).toHaveLength(ROTOR_FLANK_SAMPLES + 1);
    expect(first.xMm).toBeCloseTo(THIRTEEN_B.generatingRadiusMm, 9);
    expect(first.yMm).toBeCloseTo(0, 9);
    expect(last.xMm).toBeCloseTo(
      THIRTEEN_B.generatingRadiusMm * Math.cos(TWO_PI / 3),
      9,
    );
    expect(last.yMm).toBeCloseTo(
      THIRTEEN_B.generatingRadiusMm * Math.sin(TWO_PI / 3),
      9,
    );
  });

  it("bulges by exactly the sagitta at mid-flank", () => {
    for (const c of RANGE_CORNERS) {
      const p = deriveRotaryProportions(c);
      const mid = p.rotorFlankMm[ROTOR_FLANK_SAMPLES / 2];
      // Mid-flank lies along the 60° ray, at R/2 plus the bulge.
      expect(Math.atan2(mid.yMm, mid.xMm)).toBeCloseTo(Math.PI / 3, 9);
      expect(Math.hypot(mid.xMm, mid.yMm)).toBeCloseTo(
        c.generatingRadiusMm / 2 + p.flankSagittaMm,
        9,
      );
    }
  });

  it("takes its depth from the theoretical limit R/2 - 2e, less a clearance", () => {
    for (const c of RANGE_CORNERS) {
      const p = deriveRotaryProportions(c);
      expect(p.flankSagittaMm).toBeCloseTo(
        c.generatingRadiusMm / 2 -
          2 * c.eccentricityMm -
          ROTOR_FLANK_CLEARANCE_FRACTION * c.generatingRadiusMm,
        9,
      );
    }
  });

  it("bows inward below K = 4, where the theoretical flank is concave", () => {
    // Not a degenerate case to guard against — a low-K rotor really does have
    // concave flanks, and the formula produces that with no special handling.
    expect(deriveRotaryProportions(config(76, 25)).flankSagittaMm).toBeLessThan(
      0,
    );
    expect(deriveRotaryProportions(THIRTEEN_B).flankSagittaMm).toBeGreaterThan(
      0,
    );
  });

  it("is a genuine circular arc: every sample is equidistant from one center", () => {
    // The sampler solves the circle for y over the chord coordinate rather
    // than sweeping an angle, so this checks the rearrangement is still a
    // circle and not a parabola.
    const p = deriveRotaryProportions(THIRTEEN_B);
    const halfChord = (THIRTEEN_B.generatingRadiusMm * Math.sqrt(3)) / 2;
    const s = p.flankSagittaMm;
    const arcRadius = (halfChord * halfChord + s * s) / (2 * s);
    // Center lies on the 60° ray, `arcRadius - s` inside the mid-flank point.
    const midRadius = THIRTEEN_B.generatingRadiusMm / 2 + s;
    const centerRadius = midRadius - arcRadius;
    const cx = centerRadius * Math.cos(Math.PI / 3);
    const cy = centerRadius * Math.sin(Math.PI / 3);

    for (const point of p.rotorFlankMm) {
      expect(Math.hypot(point.xMm - cx, point.yMm - cy)).toBeCloseTo(
        Math.abs(arcRadius),
        7,
      );
    }
  });

  it("degenerates to a straight chord at zero sagitta, without dividing by zero", () => {
    // R(1/2 - clearance) = 2e is where the sagitta vanishes exactly — the one
    // input the "find the arc's center and sweep an angle" parametrization
    // could not survive, and the reason the sampler solves for y over the
    // chord instead.
    const eccentricityMm = 25;
    const zeroSagitta = config(
      (2 * eccentricityMm) / (0.5 - ROTOR_FLANK_CLEARANCE_FRACTION),
      eccentricityMm,
    );
    const p = deriveRotaryProportions(zeroSagitta);

    expect(p.flankSagittaMm).toBeCloseTo(0, 9);
    for (const point of p.rotorFlankMm) {
      expect(Number.isFinite(point.xMm)).toBe(true);
      expect(Number.isFinite(point.yMm)).toBe(true);
    }
    // A zero sagitta is the straight chord: mid-flank sits at exactly R/2.
    const mid = p.rotorFlankMm[ROTOR_FLANK_SAMPLES / 2];
    expect(Math.hypot(mid.xMm, mid.yMm)).toBeCloseTo(
      zeroSagitta.generatingRadiusMm / 2,
      9,
    );
  });
});

describe("deriveRotaryProportions - the rotor stays inside its housing", () => {
  it("keeps every flank point of every face inside the housing at every shaft angle", () => {
    // The claim the sagitta rule exists to make good on. A flank that pokes
    // through would be an interference the mechanism could not survive, and it
    // is worst exactly where the housing is tightest — which is why this
    // sweeps the whole validated range rather than the default alone.
    //
    // Failures are collected rather than asserted point by point: a per-point
    // `expect` across a sweep this size costs far more than the geometry does.
    const escapes: string[] = [];

    for (const c of RANGE_CORNERS) {
      const p = deriveRotaryProportions(c);
      const housing = denseHousing(c);

      for (let step = 0; step < 120; step += 1) {
        const shaftAngleRad = (TWO_PI * step) / 120;
        for (let face = 0; face < 3; face += 1) {
          // Endpoints are the apexes, which ride *on* the housing by
          // construction; the interior is what has to clear it.
          for (let i = 1; i < p.rotorFlankMm.length - 1; i += 2) {
            const world = toWorld(c, shaftAngleRad, p.rotorFlankMm[i], face);
            if (!isInsideHousing(world, housing)) {
              escapes.push(
                `R=${c.generatingRadiusMm} e=${c.eccentricityMm} theta=${step} face=${face} i=${i}`,
              );
            }
          }
        }
      }
    }

    expect(escapes).toEqual([]);
  }, 30_000);

  it("would fail if the flank were drawn at its theoretical depth", () => {
    // The control for the test above: at the untrimmed limit the flank touches
    // the housing at minimum volume, so a hair past it is outside. This pins
    // R/2 - 2e as the real limit rather than a number that happened to work.
    const c = THIRTEEN_B;
    const housing = denseHousing(c);
    // Mid-flank of an over-bulged arc, at the minimum-volume shaft angle (90°,
    // `ROTOR_FACE_ANCHOR_SHAFT_ANGLE_RAD`) where the clearance is least.
    const overshoot = c.generatingRadiusMm / 2 - 2 * c.eccentricityMm + 0.5;
    const midRadius = c.generatingRadiusMm / 2 + overshoot;
    const local: RotaryPointMm = {
      xMm: midRadius * Math.cos(Math.PI / 3),
      yMm: midRadius * Math.sin(Math.PI / 3),
    };

    expect(isInsideHousing(toWorld(c, Math.PI / 2, local, 0), housing)).toBe(
      false,
    );
    // ...while the drawn flank's own mid-point at that same angle is inside.
    const drawn =
      deriveRotaryProportions(c).rotorFlankMm[ROTOR_FLANK_SAMPLES / 2];
    expect(isInsideHousing(toWorld(c, Math.PI / 2, drawn, 0), housing)).toBe(
      true,
    );
  });
});

describe("deriveRotaryProportions - part sizing", () => {
  it("scales every cosmetic part with R, so nothing is distorted at any size", () => {
    const small = deriveRotaryProportions(config(60, 8, 40));
    const large = deriveRotaryProportions(config(120, 16, 80));
    const ratio = 2;

    expect(large.apexRadiusMm).toBeCloseTo(small.apexRadiusMm * ratio, 9);
    expect(large.eccentricLobeRadiusMm).toBeCloseTo(
      small.eccentricLobeRadiusMm * ratio,
      9,
    );
    expect(large.shaftJournalRadiusMm).toBeCloseTo(
      small.shaftJournalRadiusMm * ratio,
      9,
    );
    expect(large.flankSagittaMm).toBeCloseTo(small.flankSagittaMm * ratio, 9);
    expect(large.bounds.maxX).toBeCloseTo(small.bounds.maxX * ratio, 9);
  });

  it("draws the housing at the real rotor width and insets the rotor inside it", () => {
    const p = deriveRotaryProportions(THIRTEEN_B);

    expect(p.housingDepthMm).toBe(THIRTEEN_B.rotorWidthMm);
    expect(p.rotorDepthMm).toBeLessThan(p.housingDepthMm);
    // Both joint markers sit ahead of the rotor's own front face.
    expect(p.apexZMm).toBeGreaterThan(p.rotorDepthMm / 2);
    expect(p.eccentricZMm).toBeGreaterThan(p.rotorDepthMm / 2);
  });

  it("leaves a face skin thin enough to read as a surface, not as the rotor", () => {
    const p = deriveRotaryProportions(THIRTEEN_B);
    expect(p.rotorCoreScale).toBeCloseTo(1 - ROTOR_SKIN_FRACTION, 12);
    expect(p.rotorCoreScale).toBeGreaterThan(0.5);
    expect(p.rotorCoreScale).toBeLessThan(1);
  });

  it("produces finite geometry for a degenerate configuration", () => {
    // Validation is expected to have rejected these upstream; the renderer
    // still must not emit NaN if one slips through between a store write and
    // the validation that follows it.
    const p = deriveRotaryProportions(config(0, 0, 0));

    for (const point of [...p.housingInnerMm, ...p.rotorFlankMm]) {
      expect(Number.isFinite(point.xMm)).toBe(true);
      expect(Number.isFinite(point.yMm)).toBe(true);
    }
    expect(Number.isFinite(p.bounds.maxX)).toBe(true);
    expect(Number.isFinite(p.flankSagittaMm)).toBe(true);
  });
});
