/**
 * Engine-level results for the rotary family, derived from configuration alone
 * (TECHNICAL_DESIGN.md §27) — the rotary's `calculations.ts`. Inputs are in
 * canonical units (millimeters, RPM); outputs are documented per function.
 *
 * ## Where 3√3·e·R·b comes from
 *
 * The displacement formula is usually quoted without derivation, so here it
 * is. `chamberAreaMm2` measures face k's chamber as the shoelace of the
 * housing arc `α ∈ [α₀, α₀ + 2π/3]` closed by the chord between its endpoints.
 * Both halves integrate in closed form.
 *
 * **The arc.** With `P(α) = (e·cos3α + R·cosα, e·sin3α + R·sinα)`,
 *
 *     x·y′ − y·x′ = 3e² + R² + 4eR·(cos3α·cosα + sin3α·sinα)
 *                 = 3e² + R² + 4eR·cos2α
 *
 * so ½∫ over a 2π/3 span starting at α₀ gives
 *
 *     (3e² + R²)·π/3 + √3·e·R·cos(2α₀ + 2π/3)
 *
 * using sin(2α₀ + 4π/3) − sin 2α₀ = √3·cos(2α₀ + 2π/3).
 *
 * **The chord**, from P(α₀ + 2π/3) back to P(α₀), contributes
 * ½(x_A·y_B − x_B·y_A). Because 3(α₀ + 2π/3) = 3α₀ + 2π the cos3α and sin3α
 * factors are common to both endpoints, and the cross terms collapse to
 *
 *     −(√3/2)·e·R·cos(2α₀ − π/3) − (√3/4)·R²
 *
 * **Together**, and using cos(2α₀ + 2π/3) = −cos(2α₀ − π/3) — the two
 * arguments differ by exactly π — the trigonometric parts add rather than
 * cancel:
 *
 *     Area(α₀) = (3e² + R²)·π/3 − (√3/4)·R²  −  (3√3/2)·e·R·cos(2α₀ − π/3)
 *                └────────── constant ──────┘    └──── amplitude (3√3/2)eR ──┘
 *
 * The chamber area is therefore an **exact sinusoid** in α₀ — no small-angle
 * approximation, no rod-angularity asymmetry of the kind the slider-crank has.
 * Peak-to-peak is twice the amplitude:
 *
 *     swept area = 3√3·e·R      ⇒      Vd = 3√3·e·R·b
 *
 * and the minimum falls where cos(2α₀ − π/3) = 1, which is the anchor
 * `rotaryCycle.ts` builds its phases on. `rotaryCalculations.test.ts` checks
 * the closed form against a numerical shoelace sweep, and checks the resulting
 * displacement against Mazda's published figure for the 13B.
 */

import { ROTOR_FACE_COUNT, SHAFT_REVS_PER_ROTOR_REV } from "./rotaryConstants";
import { ROTARY_CYCLE_SPAN_RAD } from "./rotaryCycle";
import type { RotaryConfig, RotaryRotorCount } from "./rotaryTypes";

/**
 * The 3√3 of the displacement formula, named so the formula reads as its
 * derivation. (There is no `Math.SQRT3`; only SQRT2 and SQRT1_2 exist.)
 */
export const THREE_ROOT_THREE = 3 * Math.sqrt(3);

/**
 * Swept volume of **one chamber**, in cubic centimeters: 3√3·e·R·b.
 *
 * The rotor's width b enters linearly and the two radii multiply, so a rotary
 * scales with e·R the way a piston engine scales with bore²·stroke. For the
 * canonical 13B (e = 15, R = 105, b = 80 mm) this returns 654.7 cc against
 * Mazda's published 654 cc per chamber — the published figure is the rounded
 * one, and the 0.1% gap is rounding in the quoted dimensions, not a modeling
 * error.
 */
export function calculateChamberDisplacementCc(config: RotaryConfig): number {
  return (
    (THREE_ROOT_THREE *
      config.eccentricityMm *
      config.generatingRadiusMm *
      config.rotorWidthMm) /
    1000
  );
}

/**
 * The engine's rated displacement in cubic centimeters: chamber displacement
 * × rotor count.
 *
 * **This is a convention, and a contested one.** Mazda rates a two-rotor 13B
 * at 1,308 cc — two chambers' worth — and every regulator and every road-tax
 * table follows suit. But a rotor sweeps *three* chambers per rotor
 * revolution, and it completes that revolution in three shaft turns, so per
 * shaft revolution a rotary displaces one chamber per rotor, exactly as a
 * four-stroke piston engine displaces half its swept volume per crank
 * revolution. That parity is why the industry convention is defensible; the
 * argument that a 13B "is really a 2.6-litre" comes from counting all three
 * faces, and the argument that it is "really 654 cc × 2 × 2" comes from
 * counting per shaft revolution against a two-revolution piston cycle.
 *
 * We quote the industry convention because that is what the badge on the car
 * says, and say so wherever the number is shown.
 */
export function calculateRotaryEngineDisplacementCc(
  config: RotaryConfig,
  rotorCount: RotaryRotorCount,
): number {
  return calculateChamberDisplacementCc(config) * rotorCount;
}

/**
 * K = R/e, the trochoid constant — the rotary's shape parameter, and its
 * closest analog to the rod-to-stroke ratio: dimensionless, invariant under
 * scaling, and the thing that decides how the mechanism *behaves* rather than
 * how big it is.
 *
 * A 13B is K = 7. Higher K flattens the housing toward a circle and shortens
 * the chamber; lower K deepens the waist into a peanut, lengthening the
 * chamber and worsening the surface-to-volume ratio that already costs the
 * rotary its thermal efficiency. Below K = 3 the housing self-intersects and
 * stops being a housing at all (`ROTARY_MIN_K_FACTOR`).
 */
export function calculateKFactor(config: RotaryConfig): number {
  return config.generatingRadiusMm / config.eccentricityMm;
}

/**
 * Chamber volume at minimum, in cubic centimeters, from CR = (Vd + Vc)/Vc ⇒
 * Vc = Vd/(CR − 1) — the same relation as `calculateClearanceVolumeCc`, since
 * a compression ratio means the same thing whatever sweeps the volume.
 *
 * On a real rotary this space is mostly a recess machined into the rotor
 * flank: the bare trochoid geometry, with a theoretically-generated flank,
 * leaves far too little room and would give an unusably high compression
 * ratio. That is a fact about rotor design, not about this formula, which
 * takes the compression ratio as the given it is.
 */
export function calculateRotaryClearanceVolumeCc(config: RotaryConfig): number {
  return calculateChamberDisplacementCc(config) / (config.compressionRatio - 1);
}

/**
 * Chamber volume in cubic centimeters at a face cycle angle γ (radians, as
 * returned by `rotorFaceCycleAngleRad`):
 *
 *     V(γ) = Vc + (Vd/2)·(1 − cos(2γ/3))
 *
 * The 2/3 is the header's `2α₀` seen through the cycle's own coordinate: γ
 * spans 1080° while α₀ spans 360°, and the volume completes two oscillations
 * per cycle. So V is minimum at γ = 0 and γ = 540° (the phase boundaries where
 * compression ends and where exhaust ends), maximum at 270° and 810° (where
 * intake and power end) — the four `rotaryPhaseAt` boundaries, derived rather
 * than declared.
 *
 * Exact and allocation-free; this is the closed form `chamberAreaMm2`'s
 * numerical sweep exists to verify, and the one a volume plot should use.
 */
export function calculateChamberVolumeCc(
  config: RotaryConfig,
  faceCycleAngleRad: number,
): number {
  const swept = calculateChamberDisplacementCc(config);
  const clearance = swept / (config.compressionRatio - 1);
  // Reduce γ into one cycle before scaling it: a full cycle of γ is exactly
  // three full turns of 2γ/3, so this is an identity for the cosine while
  // keeping the argument small for a caller that hands over an unwrapped
  // running angle.
  const wrapped = faceCycleAngleRad % ROTARY_CYCLE_SPAN_RAD;
  return (
    clearance +
    (swept / 2) * (1 - Math.cos((2 * wrapped) / SHAFT_REVS_PER_ROTOR_REV))
  );
}

/**
 * Rotor speed in RPM from eccentric-shaft speed: the 3:1 reduction that makes
 * a rotary's apex seals survive. A 9,000 rpm Renesis spins its rotors at
 * 3,000 — slower than a family sedan's crankshaft at highway speed, which is
 * the usual answer to "how does it rev so high".
 */
export function calculateRotorSpeedRpm(shaftRpm: number): number {
  return shaftRpm / SHAFT_REVS_PER_ROTOR_REV;
}

/**
 * Firings per eccentric-shaft revolution: one per rotor. Each rotor's three
 * faces fire once each per rotor revolution, and a rotor revolution is three
 * shaft revolutions — so 3 firings / 3 revolutions = 1 per rotor, per shaft
 * turn. A two-rotor engine therefore fires twice per shaft revolution, the
 * same count as a four-cylinder four-stroke fires per crank revolution.
 */
export function calculateFiringsPerShaftRevolution(
  rotorCount: RotaryRotorCount,
): number {
  return (ROTOR_FACE_COUNT * rotorCount) / SHAFT_REVS_PER_ROTOR_REV;
}
