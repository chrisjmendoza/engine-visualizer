/**
 * Core domain types for the engine simulation.
 *
 * Canonical units (see TECHNICAL_DESIGN.md §8):
 * - Lengths are millimeters.
 * - Angles are radians.
 * - Engine speed is revolutions per minute.
 *
 * Scene coordinate system:
 * - The crankshaft center is the origin.
 * - +Y follows the cylinder centerline toward the cylinder head.
 * - X is lateral crankpin movement.
 * - Z is crankshaft depth.
 * - Crank angle 0 is top dead center.
 */

/**
 * Physical dimensions of a single slider-crank mechanism.
 *
 * `compressionRatio` is dimensionless (total volume at BDC over clearance
 * volume at TDC). The clearance space is modeled as a flat cylindrical disc
 * above the piston crown — chamber domes, piston dishes, and gasket volume
 * are not modeled — so clearance height is `strokeMm / (compressionRatio - 1)`.
 */
export interface CrankMechanismConfig {
  boreMm: number;
  strokeMm: number;
  rodLengthMm: number;
  compressionRatio: number;
  /**
   * The engine's rated maximum speed, in RPM. Engine-level data, ignored by
   * kinematics; used for at-redline calculated results.
   */
  redlineRpm: number;
}

export type DisplayUnit = "mm" | "in";

export interface UserPreferences {
  displayUnit: DisplayUnit;
  showLabels: boolean;
  /**
   * Gates the four-stroke stroke badge (`src/engine/cycle.ts`'s pedagogical
   * overlay). Session-local, like every other preference here: not carried
   * by share links tonight (see the store's `setShowCycle` doc comment).
   */
  showCycle: boolean;
}

export interface AnimationControls {
  rpm: number;
  isPlaying: boolean;
  crankAngleRad: number;
}

/**
 * Instantaneous mechanism geometry at a given crank angle.
 *
 * Sign convention for rodAngleRad: positive when the crankpin has swung
 * toward +X, tilting the rod clockwise viewed from the front (+Z looking
 * toward -Z).
 */
export interface MechanismState {
  crankAngleRad: number;
  crankPinXmm: number;
  crankPinYmm: number;
  pistonPinYmm: number;
  /** Distance the piston has traveled down from top dead center. */
  pistonDisplacementMm: number;
  rodAngleRad: number;
}

/** A validation problem described in mechanical terms, tied to one input. */
export interface ValidationIssue {
  field:
    | "boreMm"
    | "strokeMm"
    | "rodLengthMm"
    | "compressionRatio"
    | "redlineRpm"
    | "rpm"
    | "crankAngleRad";
  message: string;
}
