/**
 * Engine-level calculated results derived from configuration alone
 * (TECHNICAL_DESIGN.md §9.6-9.8, §10, §15). All inputs are in canonical
 * units (millimeters, RPM); outputs are documented per function.
 */

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
