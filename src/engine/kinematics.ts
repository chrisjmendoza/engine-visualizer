/**
 * Slider-crank kinematics (TECHNICAL_DESIGN.md §9).
 *
 * Coordinate system (§8.2): the crankshaft center is the origin. +Y follows
 * the cylinder centerline toward the cylinder head. +X is lateral crankpin
 * movement. +Z is crankshaft depth (unused by this 2D mechanism). Crank
 * angle θ = 0 is top dead center (TDC); θ increases as the crank rotates,
 * with θ = π at bottom dead center (BDC).
 *
 * Sign convention for rodAngleRad (§9.5): `arcsin` returns a signed angle.
 * A positive rod angle means the crankpin (big end) has swung toward +X,
 * tilting the rod clockwise as viewed from the front of the scene (+Z
 * looking toward -Z). This matches the sign of crankPinXmm.
 */

import type { CrankMechanismConfig, MechanismState } from "./types";

/**
 * Computes crankpin position, piston-pin position, piston displacement from
 * TDC, and connecting-rod angle for a given crank angle.
 *
 * `crankAngleRad` is used as given (not normalized); callers that need
 * angle-wrap equivalence should normalize before calling.
 */
export function calculateMechanismState(
  config: CrankMechanismConfig,
  crankAngleRad: number,
): MechanismState {
  const r = config.strokeMm / 2;
  const l = config.rodLengthMm;
  const theta = crankAngleRad;

  const crankPinXmm = r * Math.sin(theta);
  const crankPinYmm = r * Math.cos(theta);

  const sinTheta = Math.sin(theta);
  const underRoot = l * l - r * r * sinTheta * sinTheta;
  const pistonPinYmm = r * Math.cos(theta) + Math.sqrt(Math.max(underRoot, 0));

  const pistonDisplacementMm = r + l - pistonPinYmm;

  const rodAngleRad = Math.asin((r / l) * sinTheta);

  return {
    crankAngleRad,
    crankPinXmm,
    crankPinYmm,
    pistonPinYmm,
    pistonDisplacementMm,
    rodAngleRad,
  };
}

/**
 * Length of the vertical leg of the rod triangle, √(l² − r²sin²θ) — the
 * radical shared by §9.3's piston-pin position and both of its derivatives
 * below. Validation (§13) enforces `rodLength > stroke / 2`, i.e. l > r, so
 * the radicand never drops below l² − r² > 0; the `Math.max` guard only
 * mirrors `calculateMechanismState`'s defense against a config that somehow
 * bypassed validation.
 */
function rodVerticalLegMm(r: number, l: number, sinTheta: number): number {
  return Math.sqrt(Math.max(l * l - r * r * sinTheta * sinTheta, 0));
}

/**
 * Piston velocity with respect to *crank angle*, in millimeters per radian
 * — the exact derivative of §9.4's displacement, dx/dθ:
 *
 *     dx/dθ = r·sinθ + r²·sinθ·cosθ / s,    s = √(l² − r²sin²θ)
 *
 * Differentiating the closed form rather than the mechanism state keeps the
 * result exact at every angle (a finite difference would not be) and keeps
 * the result independent of engine speed: the shape of the curve is pure
 * geometry, and only its scale depends on rpm. Multiply by ω = rpm·2π/60 to
 * get millimeters per second — a time-domain conversion that belongs at the
 * interface boundary (`calculatePistonVelocityMps`), not here, so this
 * module stays free of anything but §8.1's canonical units.
 *
 * Positive means the piston is moving *away* from TDC (displacement
 * growing), matching the sign of `pistonDisplacementMm` itself. It is zero
 * at both dead centers and peaks before 90° — earlier the shorter the rod,
 * which is the rod-angularity asymmetry a pure sinusoid cannot show.
 */
export function calculatePistonVelocityMmPerRad(
  config: CrankMechanismConfig,
  crankAngleRad: number,
): number {
  const r = config.strokeMm / 2;
  const l = config.rodLengthMm;
  const sinTheta = Math.sin(crankAngleRad);
  const cosTheta = Math.cos(crankAngleRad);
  const s = rodVerticalLegMm(r, l, sinTheta);

  return r * sinTheta + (r * r * sinTheta * cosTheta) / s;
}

/**
 * Piston acceleration with respect to *crank angle*, in millimeters per
 * radian squared — the second derivative of §9.4's displacement, obtained by
 * differentiating `calculatePistonVelocityMmPerRad` once more:
 *
 *     d²x/dθ² = r·cosθ + r²·( cos2θ + r²·sin²θ·cos²θ / s² ) / s
 *
 * The `r²sin²θcos²θ / s²` term is the contribution of s's own derivative
 * (s′ = −r²sinθcosθ / s); dropping it is the classic transcription mistake,
 * which is why the tests check this against a central difference of
 * `calculateMechanismState(...).pistonDisplacementMm` rather than against a
 * restatement of the same algebra.
 *
 * Positive means acceleration directed away from TDC. Its extremes fall at
 * the dead centers and are famously unequal: exactly r(1 + r/l) at TDC and
 * −r(1 − r/l) at BDC, so the inertial load the rod and bearings see at TDC
 * always exceeds the one at BDC, by more as the rod shortens. Multiply by
 * ω² for millimeters per second squared — again at the interface boundary
 * (`calculatePistonAccelerationMps2`), not here.
 */
export function calculatePistonAccelerationMmPerRad2(
  config: CrankMechanismConfig,
  crankAngleRad: number,
): number {
  const r = config.strokeMm / 2;
  const l = config.rodLengthMm;
  const sinTheta = Math.sin(crankAngleRad);
  const cosTheta = Math.cos(crankAngleRad);
  const s = rodVerticalLegMm(r, l, sinTheta);
  const cosTwoTheta = Math.cos(2 * crankAngleRad);

  return (
    r * cosTheta +
    (r *
      r *
      (cosTwoTheta +
        (r * r * sinTheta * sinTheta * cosTheta * cosTheta) / (s * s))) /
      s
  );
}
