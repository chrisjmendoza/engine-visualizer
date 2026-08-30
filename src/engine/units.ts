/**
 * Unit conversions for the interface boundary (TECHNICAL_DESIGN.md §8.1).
 *
 * Internal engine code always works in millimeters and radians. These
 * helpers exist only for converting to/from display units; they must not be
 * used inside `src/engine/kinematics.ts` or `src/engine/calculations.ts`.
 */

import { MM_PER_INCH, TWO_PI } from "./constants";

/** Converts a length in millimeters to inches. */
export function mmToIn(mm: number): number {
  return mm / MM_PER_INCH;
}

/** Converts a length in inches to millimeters. */
export function inToMm(inches: number): number {
  return inches * MM_PER_INCH;
}

/** Converts an angle in radians to degrees. */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Converts an angle in degrees to radians. */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Maps any finite angle (radians) into the half-open interval [0, 2π),
 * so that angles separated by whole revolutions compare as equal.
 */
export function normalizeAngleRad(rad: number): number {
  const wrapped = rad % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}
