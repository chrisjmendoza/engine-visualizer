/**
 * Engine-level calculated results derived from configuration alone
 * (TECHNICAL_DESIGN.md §9.6-9.8, §10, §15). All inputs are in canonical
 * units (millimeters, RPM); outputs are documented per function.
 */

import { TWO_PI } from "./constants";

/** Single-cylinder swept displacement in cubic centimeters. */
export function calculateCylinderDisplacementCc(
  boreMm: number,
  strokeMm: number,
): number {
  return (Math.PI * boreMm * boreMm * strokeMm) / 4000;
}

/** Mean piston speed in meters per second at a given engine speed. */
export function calculateMeanPistonSpeedMps(
  strokeMm: number,
  rpm: number,
): number {
  return (2 * (strokeMm / 1000) * rpm) / 60;
}

/**
 * Crankshaft angular velocity ω in radians per second, from engine speed.
 *
 * This is the only bridge between the crank-angle domain — where
 * `src/engine/kinematics.ts` derives piston velocity and acceleration as
 * exact functions of geometry alone — and the time domain a readout wants.
 * Keeping it here rather than in `kinematics.ts` preserves that split: the
 * shape of a kinematic curve is geometry, its scale is engine speed.
 */
export function calculateAngularVelocityRadPerSec(rpm: number): number {
  return (rpm * TWO_PI) / 60;
}

/**
 * Piston velocity in meters per second, from the per-radian velocity
 * (`calculatePistonVelocityMmPerRad`) and an engine speed: dx/dt =
 * (dx/dθ)·ω, then millimeters to meters.
 */
export function calculatePistonVelocityMps(
  velocityMmPerRad: number,
  rpm: number,
): number {
  return (velocityMmPerRad * calculateAngularVelocityRadPerSec(rpm)) / 1000;
}

/**
 * Piston acceleration in meters per second squared, from the per-radian
 * acceleration (`calculatePistonAccelerationMmPerRad2`) and an engine speed:
 * d²x/dt² = (d²x/dθ²)·ω², then millimeters to meters. ω is squared, so this
 * grows with the *square* of rpm — the reason peak piston acceleration, not
 * mean piston speed, is what limits a high-revving engine's reciprocating
 * mass.
 */
export function calculatePistonAccelerationMps2(
  accelerationMmPerRad2: number,
  rpm: number,
): number {
  const omega = calculateAngularVelocityRadPerSec(rpm);
  return (accelerationMmPerRad2 * omega * omega) / 1000;
}

/** Connecting-rod length divided by stroke (dimensionless). */
export function calculateRodStrokeRatio(
  rodLengthMm: number,
  strokeMm: number,
): number {
  return rodLengthMm / strokeMm;
}

/** Bore divided by stroke (dimensionless). */
export function calculateBoreStrokeRatio(
  boreMm: number,
  strokeMm: number,
): number {
  return boreMm / strokeMm;
}

/**
 * Clearance volume at TDC in cubic centimeters.
 *
 * From CR = (Vswept + Vclearance) / Vclearance, so Vclearance =
 * Vswept / (CR - 1). Requires compressionRatio > 1 (validation enforces
 * a minimum well above that).
 */
export function calculateClearanceVolumeCc(
  boreMm: number,
  strokeMm: number,
  compressionRatio: number,
): number {
  return (
    calculateCylinderDisplacementCc(boreMm, strokeMm) / (compressionRatio - 1)
  );
}

/**
 * Height of the clearance space above the piston crown at TDC, in
 * millimeters, modeling that space as a flat cylindrical disc of bore
 * diameter (chamber domes, piston dishes, and gasket volume are not
 * modeled). The bore area cancels, leaving stroke / (CR - 1).
 */
export function calculateClearanceHeightMm(
  strokeMm: number,
  compressionRatio: number,
): number {
  return strokeMm / (compressionRatio - 1);
}

/**
 * Distance from the piston crown to the cylinder head, in millimeters, for
 * a given piston displacement from TDC (same flat-disc clearance model as
 * `calculateClearanceHeightMm`).
 *
 * At TDC (displacement 0) this is the clearance height — the minimum; at
 * BDC (displacement = stroke) it is clearance height + stroke — the maximum.
 */
export function calculatePistonToHeadDistanceMm(
  strokeMm: number,
  compressionRatio: number,
  pistonDisplacementMm: number,
): number {
  return (
    calculateClearanceHeightMm(strokeMm, compressionRatio) +
    pistonDisplacementMm
  );
}
