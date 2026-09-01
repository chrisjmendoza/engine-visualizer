/**
 * Wankel rotor and housing geometry (TECHNICAL_DESIGN.md §27).
 *
 * This is the rotary family's `kinematics.ts`: pure closed-form geometry in
 * canonical units, with no notion of time, rpm, engine speed, or rendering.
 * `src/scene/` consumes it the way it consumes `calculateMechanismState`.
 *
 * ## The mechanism in one paragraph
 *
 * An eccentric shaft turns at angle θ. Rigidly attached to it, at radius e
 * from the shaft center, is a lobe carrying the rotor's center — so the rotor
 * center orbits the origin once per shaft revolution. The rotor itself is
 * geared to turn at **one third** of shaft speed, so its orientation is
 * φ = θ/3. Its three apexes sit at radius R from its center, 120° apart. That
 * is the whole mechanism: two angles, both derived from θ, and two radii.
 *
 *     C(θ)   = (e·cosθ, e·sinθ)                          rotor center
 *     φ(θ)   = θ/3                                       rotor orientation
 *     A_k(θ) = C(θ) + R·(cos(φ + 2πk/3), sin(φ + 2πk/3)) apex k, k = 0,1,2
 *
 * ## The housing, and why it is a peritrochoid
 *
 * The housing is the curve the apexes trace:
 *
 *     P(α) = (e·cos3α + R·cosα, e·sin3α + R·sinα),   α ∈ [0, 2π)
 *
 * ### The apex-on-housing identity — the rotary's loop closure
 *
 * The slider-crank has one non-negotiable check: the crank, rod, and piston
 * must close a triangle at every angle. The rotary's equivalent is that every
 * apex lies *exactly* on the housing at every shaft angle, and it is provable
 * in two lines. Evaluate the housing at α = φ + 2πk/3 = θ/3 + 2πk/3:
 *
 *     3α  = 3·(θ/3 + 2πk/3) = θ + 2πk
 *     ⇒ e·cos3α = e·cos(θ + 2πk) = e·cosθ,  likewise for sin
 *     ⇒ P(α) = (e·cosθ + R·cos(θ/3 + 2πk/3),
 *               e·sinθ + R·sin(θ/3 + 2πk/3))
 *             = C(θ) + R·(cos(φ + 2πk/3), sin(φ + 2πk/3))
 *             = A_k(θ)                                            ∎
 *
 * The whole design hangs on that `3α`: it is the reason the rotor must turn at
 * exactly a third of shaft speed, and the reason the 2πk term vanishes for
 * every apex. `rotaryGeometry.test.ts` asserts it numerically to ~1e-12 across
 * a dense sweep as well, because a proof in a comment cannot catch a
 * transcription error in the code beneath it.
 *
 * ### Housing extremes
 *
 * |P(α)|² = e² + R² + 2eR·cos2α, so the housing radius runs between R − e at
 * the waist (α = ±π/2) and R + e at the lobe tips (α = 0, π) — a two-lobe
 * peanut, centrally symmetric because P(α + π) = −P(α). The major axis lies
 * along X in this coordinate system.
 *
 * ## Faces and chambers
 *
 * Face k is the flank between apex k and apex k+1, and the chamber it works in
 * is bounded by the housing arc `α ∈ [α₀, α₀ + 2π/3]`, α₀ = φ + 2πk/3, closed
 * by the rotor flank. `chamberAreaMm2` measures it by shoelace over that arc
 * closed with the **straight chord**, which is the right measure of chamber
 * *variation* whatever the real flank looks like: a rotor is rigid, so the
 * region between chord and flank is a fixed shape whose area subtracts the
 * same constant from every chamber at every shaft angle. It cancels out of
 * max − min, which is what `calculateChamberDisplacementCc` is checked
 * against.
 */

import { TWO_PI } from "./constants";
import { ROTOR_FACE_COUNT, SHAFT_REVS_PER_ROTOR_REV } from "./rotaryConstants";
import type {
  RotaryConfig,
  RotaryMechanismState,
  RotaryPointMm,
} from "./rotaryTypes";

/** Angular pitch between adjacent apexes: 120°. */
const APEX_PITCH_RAD = TWO_PI / ROTOR_FACE_COUNT;

/**
 * Arc of housing subtended by one chamber: 120°, the same pitch as the
 * apexes that bound it.
 */
export const CHAMBER_ARC_RAD = APEX_PITCH_RAD;

/**
 * Default shoelace resolution for `chamberAreaMm2`. Shoelace error on a smooth
 * convex-ish arc falls as O(n⁻²); at 512 subdivisions of a 13B chamber it is
 * under 0.1 mm² against the closed form, four decimal orders below the
 * ~8,184 mm² swing being measured.
 */
export const CHAMBER_AREA_SAMPLES = 512;

function point(
  xMm: number,
  yMm: number,
  target?: RotaryPointMm,
): RotaryPointMm {
  if (target) {
    target.xMm = xMm;
    target.yMm = yMm;
    return target;
  }
  return { xMm, yMm };
}

/**
 * A point on the housing at trochoid parameter α (radians).
 *
 * α is *not* the shaft angle and not a polar angle — it is the peritrochoid's
 * own parameter, which happens to equal the rotor angle of whichever apex is
 * sitting there (see the header's identity).
 *
 * Pass `target` to write into a caller-owned point instead of allocating; the
 * frame loop and the housing sampler both do (§18).
 */
export function housingPointMm(
  config: RotaryConfig,
  alphaRad: number,
  target?: RotaryPointMm,
): RotaryPointMm {
  const e = config.eccentricityMm;
  const r = config.generatingRadiusMm;
  return point(
    e * Math.cos(3 * alphaRad) + r * Math.cos(alphaRad),
    e * Math.sin(3 * alphaRad) + r * Math.sin(alphaRad),
    target,
  );
}

/**
 * Distance from the shaft center to the housing at parameter α, from
 * |P(α)|² = e² + R² + 2eR·cos2α — evaluated in closed form rather than by
 * taking a hypotenuse of `housingPointMm`, so the extremes below are exact.
 */
export function housingRadiusMm(
  config: RotaryConfig,
  alphaRad: number,
): number {
  const e = config.eccentricityMm;
  const r = config.generatingRadiusMm;
  return Math.sqrt(
    Math.max(e * e + r * r + 2 * e * r * Math.cos(2 * alphaRad), 0),
  );
}

/**
 * The housing's greatest radius, R + e — reached at the two lobe tips on the
 * X axis. This is the bound multi-rotor spacing and camera framing want, and
 * it is exact, not sampled.
 */
export function housingMaxRadiusMm(config: RotaryConfig): number {
  return config.generatingRadiusMm + config.eccentricityMm;
}

/** The housing's least radius, R − e — the waist, on the Y axis. */
export function housingMinRadiusMm(config: RotaryConfig): number {
  return config.generatingRadiusMm - config.eccentricityMm;
}

/**
 * The housing outline as a closed polyline of `sampleCount` points, α stepping
 * uniformly over [0, 2π) with no duplicated closing point.
 *
 * Sample this **once per configuration**, never per frame: the housing is
 * fixed geometry, and the rotor moves inside it (§18).
 */
export function sampleHousingOutline(
  config: RotaryConfig,
  sampleCount: number,
): readonly RotaryPointMm[] {
  const count = Math.max(3, Math.floor(sampleCount));
  const points = new Array<RotaryPointMm>(count);
  for (let i = 0; i < count; i += 1) {
    points[i] = housingPointMm(config, (TWO_PI * i) / count);
  }
  return points;
}

/**
 * Rotor orientation φ, radians, at eccentric-shaft angle θ.
 *
 * `rotorPhaseRad` is the rotor's phase offset within a multi-rotor engine,
 * quoted in **shaft** terms (a two-rotor engine's rotors are 180° of shaft
 * apart) and divided by three here along with everything else — which is the
 * same statement as "a phased rotor is an unphased rotor evaluated at θ +
 * phase", the identity the whole of `rotaryCycle.ts` leans on.
 *
 * Returned unwrapped, as given: a caller that needs the rotor's true
 * orientation across many shaft revolutions must pass a θ that has not been
 * wrapped into [0, 2π), because θ and θ + 2π put the rotor 120° apart. That is
 * exactly why the animation loop carries a revolution *index* rather than
 * integrating a second angle.
 */
export function rotorAngleRad(
  shaftAngleRad: number,
  rotorPhaseRad = 0,
): number {
  return (shaftAngleRad + rotorPhaseRad) / SHAFT_REVS_PER_ROTOR_REV;
}

/**
 * Rotor center C(θ) = (e·cos θ, e·sin θ) — the position of the eccentric
 * shaft's lobe, and the rotary's closest analog to a crankpin.
 */
export function rotorCenterMm(
  config: RotaryConfig,
  shaftAngleRad: number,
  rotorPhaseRad = 0,
  target?: RotaryPointMm,
): RotaryPointMm {
  const e = config.eccentricityMm;
  const theta = shaftAngleRad + rotorPhaseRad;
  return point(e * Math.cos(theta), e * Math.sin(theta), target);
}

/**
 * The rotor angle of apex k: φ + 2πk/3. Indices outside 0..2 wrap, since the
 * apexes are cyclic — apex 3 is apex 0.
 */
export function rotorApexAngleRad(
  shaftAngleRad: number,
  apexIndex: number,
  rotorPhaseRad = 0,
): number {
  return (
    rotorAngleRad(shaftAngleRad, rotorPhaseRad) + APEX_PITCH_RAD * apexIndex
  );
}

/**
 * Position of apex k. Computed as C + R·(cos, sin) from the rotor's own frame
 * rather than by evaluating the housing, so that the test asserting the two
 * agree is testing something (see the header's identity).
 */
export function rotorApexMm(
  config: RotaryConfig,
  shaftAngleRad: number,
  apexIndex: number,
  rotorPhaseRad = 0,
  target?: RotaryPointMm,
): RotaryPointMm {
  const e = config.eccentricityMm;
  const r = config.generatingRadiusMm;
  const theta = shaftAngleRad + rotorPhaseRad;
  const apex = rotorApexAngleRad(shaftAngleRad, apexIndex, rotorPhaseRad);
  return point(
    e * Math.cos(theta) + r * Math.cos(apex),
    e * Math.sin(theta) + r * Math.sin(apex),
    target,
  );
}

/**
 * The trochoid parameter α₀ at which face k's chamber begins — the housing
 * position of apex k, which by the header's identity is just that apex's rotor
 * angle. Face k runs from here to α₀ + 2π/3 (apex k+1).
 */
export function chamberArcStartRad(
  shaftAngleRad: number,
  faceIndex: number,
  rotorPhaseRad = 0,
): number {
  return rotorApexAngleRad(shaftAngleRad, faceIndex, rotorPhaseRad);
}

/**
 * Cross-sectional area of face k's working chamber, mm², measured as the
 * shoelace of the housing arc `[α₀, α₀ + 2π/3]` closed by the straight chord
 * between its endpoints.
 *
 * ### What this does and does not include
 *
 * A real rotor flank bulges outward into the chamber (and carries a combustion
 * recess), so this over-reports absolute chamber area. It reports *variation*
 * exactly: the rotor is rigid, so the area between chord and flank is a
 * constant that subtracts from every chamber at every angle and cancels in
 * max − min. That is the quantity displacement is defined by, and the reason
 * the engine layer can stay honest about swept volume while `src/scene/` draws
 * a stylized flank.
 *
 * ### Why it is a numerical integral when a closed form exists
 *
 * There is one — see `calculateChamberVolumeCc` — but this function is what
 * *locates* the cycle's anchor and *verifies* the closed form, and a numerical
 * sweep that agrees with an independent derivation is worth more than either
 * alone. It allocates nothing and is exact enough for a plot, but it is not
 * meant for a 60 fps loop; use the closed form there.
 */
export function chamberAreaMm2(
  config: RotaryConfig,
  shaftAngleRad: number,
  faceIndex: number,
  rotorPhaseRad = 0,
  sampleCount: number = CHAMBER_AREA_SAMPLES,
): number {
  const e = config.eccentricityMm;
  const r = config.generatingRadiusMm;
  const alphaStart = chamberArcStartRad(
    shaftAngleRad,
    faceIndex,
    rotorPhaseRad,
  );
  const steps = Math.max(2, Math.floor(sampleCount));
  const step = CHAMBER_ARC_RAD / steps;

  // Shoelace over the closed polygon: the sampled arc, then the chord back to
  // its start. Held as running scalars so nothing is allocated per sample.
  let previousX = e * Math.cos(3 * alphaStart) + r * Math.cos(alphaStart);
  let previousY = e * Math.sin(3 * alphaStart) + r * Math.sin(alphaStart);
  const firstX = previousX;
  const firstY = previousY;
  let twiceArea = 0;

  for (let i = 1; i <= steps; i += 1) {
    const alpha = alphaStart + step * i;
    const x = e * Math.cos(3 * alpha) + r * Math.cos(alpha);
    const y = e * Math.sin(3 * alpha) + r * Math.sin(alpha);
    twiceArea += previousX * y - x * previousY;
    previousX = x;
    previousY = y;
  }
  // The closing chord, from the last arc point back to the first.
  twiceArea += previousX * firstY - firstX * previousY;

  return twiceArea / 2;
}

/**
 * Full rotor state at a shaft angle — the rotary analog of
 * `calculateMechanismState`.
 *
 * `shaftAngleRad` is used as given, not normalized: wrapping it would lose the
 * revolution count that the rotor's 3:1 reduction depends on (see
 * `rotorAngleRad`). This allocates four objects, so per-frame callers should
 * reach for the individual accessors with a `target` instead (§18).
 */
export function calculateRotaryMechanismState(
  config: RotaryConfig,
  shaftAngleRad: number,
  rotorPhaseRad = 0,
): RotaryMechanismState {
  const apexesMm = new Array<RotaryPointMm>(ROTOR_FACE_COUNT);
  for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
    apexesMm[k] = rotorApexMm(config, shaftAngleRad, k, rotorPhaseRad);
  }

  return {
    shaftAngleRad,
    rotorCenterMm: rotorCenterMm(config, shaftAngleRad, rotorPhaseRad),
    rotorAngleRad: rotorAngleRad(shaftAngleRad, rotorPhaseRad),
    apexesMm,
  };
}
