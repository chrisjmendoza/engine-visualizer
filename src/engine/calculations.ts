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
