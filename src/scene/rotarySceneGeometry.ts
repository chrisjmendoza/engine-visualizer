/**
 * Drawn proportions for the rotary (Wankel) family — the rotary's
 * `deriveProportions` (TECHNICAL_DESIGN.md §27, §12.2).
 *
 * Same contract as the piston side: **no mechanism math lives here.** Every
 * curve is sampled from `src/engine/rotaryGeometry.ts`, and everything else is
 * cosmetic part sizing derived from the configured R, e, and b so the drawing
 * is never distorted relative to itself. Pure TypeScript — no React, no
 * Three.js — so all of it is testable without a WebGL context.
 *
 * ## What is real and what is stylized
 *
 * - **The housing outline is exact.** It is `sampleHousingOutline`'s
 *   peritrochoid, sampled once per configuration and never per frame (§18).
 *   The drawn housing adds a wall outside that curve, which is why the drawn
 *   bounds are slightly wider than `housingMaxRadiusMm`.
 * - **The apex positions are exact**, and so is the rotor's placement; both
 *   come from `rotaryGeometry.ts` at frame time.
 * - **The rotor flank is stylized**, and deliberately so. A real Wankel rotor
 *   flank is the inner envelope of the trochoid, a curve with no elementary
 *   form; production rotors approximate it with a circular arc plus a
 *   combustion recess. This draws the circular arc and omits the recess. What
 *   it does *not* do is invent the arc's depth — see `flankSagittaMm`, which
 *   is pinned to the one geometric fact that constrains it.
 *
 * ## Coordinate frames
 *
 * Two frames appear here and it matters which is which:
 *
 * - **Housing / stage frame**: eccentric-shaft center at the origin, +Y up,
 *   the housing's major axis along X (`rotaryGeometry.ts`'s convention).
 * - **Rotor frame**: rotor center at the origin, apex k at angle 2πk/3 and
 *   radius R. The scene draws the rotor once in this frame and lets the frame
 *   loop position and rotate the whole group, so the rotor's parts are static
 *   geometry and only two numbers change per frame.
 */

import { TWO_PI } from "../engine/constants";
import { ROTOR_FACE_COUNT } from "../engine/rotaryConstants";
import {
  housingMaxRadiusMm,
  sampleHousingOutline,
} from "../engine/rotaryGeometry";
import type { RotaryConfig, RotaryPointMm } from "../engine/rotaryTypes";
import type { SceneBounds } from "./sceneGeometry";

/**
 * Points used for the housing outline, sampled once per configuration.
 *
 * 240 points puts a vertex every 1.5° of trochoid parameter — under 3 mm of
 * arc on a 13B-sized housing, which is well inside a pixel at any framing the
 * camera picks. The cost is paid once per configuration change, never per
 * frame (§18), so the number is chosen for smoothness rather than for speed.
 */
export const HOUSING_OUTLINE_SAMPLES = 240;

/**
 * Thickness of the drawn housing wall, as a fraction of the local housing
 * radius.
 *
 * The outer edge is the trochoid *scaled* about the shaft center rather than
 * offset along its own normal. A normal offset would give a wall of constant
 * thickness, which sounds better until the waist of a low-K housing — where
 * the curvature radius can fall below the wall thickness — folds the offset
 * curve back through itself. Scaling cannot self-intersect at any K, and the
 * wall it draws is thicker at the lobes than at the waist, which is how a real
 * housing casting is proportioned anyway.
 */
export const HOUSING_WALL_FRACTION = 0.07;

/** Points sampled along each rotor flank arc, apex to apex. */
export const ROTOR_FLANK_SAMPLES = 48;

/**
 * How far the drawn flank is held back from the housing, as a fraction of R.
 *
 * See `flankSagittaMm` for what it is held back *from*: a real rotor flank
 * touches the housing at minimum volume, and drawing it touching would read as
 * an interference rather than as a tight seal.
 */
export const ROTOR_FLANK_CLEARANCE_FRACTION = 0.03;

/**
 * Thickness of the tinted face skin, as a fraction of the rotor's size.
 *
 * The skin is the rotor shape scaled down about its own center, so the band
 * between the two is thickest at the apexes and thinnest at mid-flank — which
 * is the right emphasis, since the apex is where a chamber is sealed off from
 * its neighbours.
 */
export const ROTOR_SKIN_FRACTION = 0.1;

/** Apex marker radius, as a fraction of R. Mirrors the piston pin's role. */
export const APEX_RADIUS_FRACTION = 0.05;

/** Eccentric lobe radius, as a fraction of R. */
export const ECCENTRIC_LOBE_RADIUS_FRACTION = 0.14;

/** Fixed main-journal radius at the shaft center, as a fraction of R. */
export const SHAFT_JOURNAL_RADIUS_FRACTION = 0.085;

/** Angular pitch between adjacent apexes in the rotor frame: 120°. */
const APEX_PITCH_RAD = TWO_PI / ROTOR_FACE_COUNT;

/** Rotor-frame direction of a face's mid-flank: halfway between its apexes. */
const FLANK_MID_ANGLE_RAD = APEX_PITCH_RAD / 2;

/** Cosmetic part sizes and sampled curves for one rotary configuration. */
export interface RotaryProportions {
  /** R, carried through so the renderer never re-reads the config. */
  generatingRadiusMm: number;
  /** e: the throw of the eccentric lobe. */
  eccentricityMm: number;

  /** The housing's working surface: the exact peritrochoid, stage frame. */
  housingInnerMm: readonly RotaryPointMm[];
  /** The outside of the drawn housing wall, `HOUSING_WALL_FRACTION` beyond. */
  housingOuterMm: readonly RotaryPointMm[];
  /** Depth of the drawn housing along Z: the real rotor width b. */
  housingDepthMm: number;
  /** Depth of the drawn rotor, a little less than the housing's. */
  rotorDepthMm: number;

  /**
   * Signed depth of the flank arc's bulge at mid-flank, millimeters: positive
   * bulging into the chamber, negative bowed back toward the rotor center.
   * See `deriveRotaryProportions` for where the number comes from.
   */
  flankSagittaMm: number;
  /**
   * Face 0's flank, in the **rotor frame**, from apex 0 to apex 1 inclusive.
   * Faces 1 and 2 are this curve rotated by 120° and 240°, so the renderer
   * samples one arc and instances it three times.
   */
  rotorFlankMm: readonly RotaryPointMm[];
  /**
   * Scale factor taking the rotor's outline to the inside of its tinted face
   * skin: `1 - ROTOR_SKIN_FRACTION`.
   */
  rotorCoreScale: number;

  /** Apex marker radius. */
  apexRadiusMm: number;
  /** Eccentric lobe radius: the drawn size of the crankpin analog. */
  eccentricLobeRadiusMm: number;
  /** Fixed main journal radius at the shaft center. */
  shaftJournalRadiusMm: number;

  /** Z of the eccentric assembly, in front of the rotor so it stays readable. */
  eccentricZMm: number;
  /** Z of the apex markers, in front of the rotor for the same reason. */
  apexZMm: number;

  /**
   * Static extents of this rotor and its housing, relative to its own
   * eccentric-shaft center — the rotary's `MechanismProportions.bounds`, and
   * what the stage spaces and frames from.
   */
  bounds: SceneBounds;
}

/** Axis-aligned envelope of a sampled curve. */
function boundsOf(points: readonly RotaryPointMm[]): SceneBounds {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    if (point.xMm < minX) minX = point.xMm;
    if (point.xMm > maxX) maxX = point.xMm;
    if (point.yMm < minY) minY = point.yMm;
    if (point.yMm > maxY) maxY = point.yMm;
  }

  return { minX, maxX, minY, maxY };
}

/** The same curve scaled about the origin of whichever frame it is in. */
function scalePoints(
  points: readonly RotaryPointMm[],
  scale: number,
): readonly RotaryPointMm[] {
  return points.map((point) => ({
    xMm: point.xMm * scale,
    yMm: point.yMm * scale,
  }));
}

/**
 * One face's flank arc in the rotor frame, from apex 0 to apex 1.
 *
 * The arc is the circle through both apexes whose mid-flank point stands
 * `sagittaMm` outside the straight chord between them, sampled uniformly along
 * the chord.
 *
 * ### Why it is written this way
 *
 * The obvious parametrization — find the arc's center and sweep an angle —
 * blows up as the sagitta approaches zero, exactly the case a K = 4 housing
 * lands on. Solving the circle for y over the chord coordinate x instead and
 * rearranging to
 *
 *     y(x) = s - sign(s)·x² / (ρ + √(ρ² - x²))
 *
 * removes the cancellation: the fraction tends to zero as ρ grows, so a zero
 * sagitta degenerates smoothly into the straight chord rather than into a
 * division by zero. (An infinite ρ propagates through IEEE arithmetic to
 * exactly that answer, so the degenerate case needs no branch of its own.)
 */
function sampleFlank(
  generatingRadiusMm: number,
  sagittaMm: number,
  sampleCount: number,
): readonly RotaryPointMm[] {
  const halfChordMm = generatingRadiusMm * Math.sin(FLANK_MID_ANGLE_RAD);
  const magnitude = Math.abs(sagittaMm);
  const arcRadiusMm =
    magnitude === 0
      ? Number.POSITIVE_INFINITY
      : (halfChordMm * halfChordMm + sagittaMm * sagittaMm) / (2 * magnitude);
  const bulgeSign = Math.sign(sagittaMm);

  // Rotor-frame basis for this face: `outward` points from the rotor center
  // through mid-flank, `along` runs from apex 0 toward apex 1.
  const outwardX = Math.cos(FLANK_MID_ANGLE_RAD);
  const outwardY = Math.sin(FLANK_MID_ANGLE_RAD);
  const alongX = -outwardY;
  const alongY = outwardX;
  // The chord's midpoint sits at R·cos(60°) = R/2 from the rotor center.
  const midX = generatingRadiusMm * Math.cos(FLANK_MID_ANGLE_RAD) * outwardX;
  const midY = generatingRadiusMm * Math.cos(FLANK_MID_ANGLE_RAD) * outwardY;

  const steps = Math.max(2, Math.floor(sampleCount));
  const points = new Array<RotaryPointMm>(steps + 1);
  for (let i = 0; i <= steps; i += 1) {
    const along = -halfChordMm + (2 * halfChordMm * i) / steps;
    const bulge =
      sagittaMm -
      (bulgeSign * (along * along)) /
        (arcRadiusMm + Math.sqrt(arcRadiusMm * arcRadiusMm - along * along));
    points[i] = {
      xMm: midX + along * alongX + bulge * outwardX,
      yMm: midY + along * alongY + bulge * outwardY,
    };
  }
  return points;
}

/**
 * Derives every drawn dimension for one rotary configuration. Pure and cheap,
 * but it samples two curves, so call it only when the configuration changes —
 * never per frame (§18).
 *
 * ## The flank sagitta, and why it is not a taste constant
 *
 * How far a rotor flank may bulge into its chamber is fixed by the mechanism,
 * not chosen. Take face k at the moment its chamber is at minimum volume — the
 * anchor `rotaryCycle.ts` locates at shaft angle 90° for face 0. There the
 * rotor center C, the face's mid-flank direction û, and the housing point at
 * that same trochoid parameter are *collinear*: with α₀ = π/6 the mid-flank
 * direction is β = π/2, C = (0, e), and the housing at β is
 * −C + R·û = (0, R − e). So the clear distance from the rotor center to the
 * housing along û is exactly R − 2e, the chord midpoint sits at R/2, and the
 * room left for the bulge is
 *
 *     s_max = (R − 2e) − R/2 = R/2 − 2e
 *
 * That is the *theoretical* rotor: its flank touches the housing at minimum
 * volume, which is what makes the theoretical compression ratio absurdly high
 * and why real rotors are relieved with a recess. Note it goes negative below
 * K = 4 — a low-K rotor's flanks are genuinely concave, and this formula
 * produces that without a special case.
 *
 * The drawn flank holds back from `s_max` by `ROTOR_FLANK_CLEARANCE_FRACTION`
 * of R, subtracted rather than scaled: scaling would shrink the margin to
 * nothing exactly where it is needed most (near K = 4, where `s_max` is
 * itself near zero) and would make a concave flank *less* concave, pushing it
 * toward the housing rather than away from it. Subtracting always moves the
 * flank inward. `rotarySceneGeometry.test.ts` checks the result stays strictly
 * inside the housing across the whole validated input range.
 */
export function deriveRotaryProportions(
  config: RotaryConfig,
): RotaryProportions {
  // Guard against a degenerate config reaching the renderer; validation
  // (`rotaryValidation.ts`) is expected to have rejected these upstream.
  const generatingRadiusMm = Math.max(config.generatingRadiusMm, 1);
  const eccentricityMm = Math.max(config.eccentricityMm, 0.1);
  const rotorWidthMm = Math.max(config.rotorWidthMm, 1);
  const guarded: RotaryConfig = {
    ...config,
    generatingRadiusMm,
    eccentricityMm,
    rotorWidthMm,
  };

  const housingInnerMm = sampleHousingOutline(guarded, HOUSING_OUTLINE_SAMPLES);
  const housingOuterMm = scalePoints(housingInnerMm, 1 + HOUSING_WALL_FRACTION);

  const theoreticalSagittaMm = generatingRadiusMm / 2 - 2 * eccentricityMm;
  const flankSagittaMm =
    theoreticalSagittaMm - ROTOR_FLANK_CLEARANCE_FRACTION * generatingRadiusMm;

  return {
    generatingRadiusMm,
    eccentricityMm,

    housingInnerMm,
    housingOuterMm,
    housingDepthMm: rotorWidthMm,
    // Inset so the rotor sits inside the housing band rather than flush with
    // its faces, the way the piston's depth sits inside the bore's.
    rotorDepthMm: 0.88 * rotorWidthMm,

    flankSagittaMm,
    rotorFlankMm: sampleFlank(
      generatingRadiusMm,
      flankSagittaMm,
      ROTOR_FLANK_SAMPLES,
    ),
    rotorCoreScale: 1 - ROTOR_SKIN_FRACTION,

    apexRadiusMm: APEX_RADIUS_FRACTION * generatingRadiusMm,
    eccentricLobeRadiusMm: ECCENTRIC_LOBE_RADIUS_FRACTION * generatingRadiusMm,
    shaftJournalRadiusMm: SHAFT_JOURNAL_RADIUS_FRACTION * generatingRadiusMm,

    // Both in front of the rotor's own front face, for the reason the piston
    // family pushes its crankpin forward: an accent-colored joint that
    // disappears behind the part it drives has stopped being a joint marker.
    eccentricZMm: 0.5 * rotorWidthMm,
    apexZMm: 0.47 * rotorWidthMm,

    // Measured from the drawn outline rather than asserted from R + e: the
    // housing's greatest *radius* is R + e and lands on the X axis, but its
    // greatest *height* is not R − e (that is the radius at the waist, and the
    // curve bulges past it either side), so the vertical extent has to be
    // taken from the samples.
    bounds: boundsOf(housingOuterMm),
  };
}

/**
 * The housing's greatest drawn radius: `housingMaxRadiusMm` plus the wall.
 *
 * Exposed for the framing and spacing tests, which check the sampled bounds
 * against the closed form rather than trusting either one alone.
 */
export function drawnHousingMaxRadiusMm(config: RotaryConfig): number {
  return housingMaxRadiusMm(config) * (1 + HOUSING_WALL_FRACTION);
}
