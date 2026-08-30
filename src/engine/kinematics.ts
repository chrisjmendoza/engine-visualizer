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
