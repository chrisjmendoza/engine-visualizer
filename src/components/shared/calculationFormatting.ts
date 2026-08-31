/**
 * Presentation helpers shared between `CalculationPanel` and
 * `ComparisonTable`, so the two never drift on wording or rounding. Kept
 * out of `CalculationPanel.tsx` itself (rather than exported from there) so
 * that component file only exports the component — Fast Refresh (and
 * oxlint's `react/only-export-components` rule) expects that.
 */

import { mmToIn, radToDeg } from "../../engine/units";
import type { DisplayUnit, MechanismState } from "../../engine/types";
import { formatRounded } from "./formatting";
import { METRIC_INFO } from "./metricInfo";
import type { MetricInfo } from "./metricInfo";

/**
 * Looks up a metric's explainer content by id (the single place
 * `CalculationPanel` and `ComparisonTable` map a results row to its
 * `METRIC_INFO` entry, so the two never drift on which id means what).
 */
export const METRIC_INFO_BY_ID: ReadonlyMap<string, MetricInfo> = new Map(
  METRIC_INFO.map((entry) => [entry.id, entry]),
);

/** Renders a length in the selected display unit (mm 2dp / in 3dp). */
export function lengthForDisplay(mm: number, unit: DisplayUnit): string {
  const value = unit === "in" ? mmToIn(mm) : mm;
  const decimals = unit === "in" ? 3 : 2;
  return `${formatRounded(value, decimals)} ${unit}`;
}

/** Renders a static min-max length range with the unit shown once, e.g. "9.05 – 95.05 mm". */
export function lengthRangeForDisplay(
  minMm: number,
  maxMm: number,
  unit: DisplayUnit,
): string {
  const decimals = unit === "in" ? 3 : 2;
  const min = unit === "in" ? mmToIn(minMm) : minMm;
  const max = unit === "in" ? mmToIn(maxMm) : maxMm;
  return `${formatRounded(min, decimals)} – ${formatRounded(max, decimals)} ${unit}`;
}

/** A mechanical-terms sentence summarizing the live mechanism state (§19). */
export function describeMechanism(
  state: MechanismState,
  unit: DisplayUnit,
): string {
  const angleDeg = radToDeg(state.crankAngleRad);
  const rodDeg = radToDeg(state.rodAngleRad);

  let tilt: string;
  if (rodDeg > 0.05) {
    tilt = `tilted ${formatRounded(rodDeg, 1)} degrees toward the crankpin's side of the cylinder`;
  } else if (rodDeg < -0.05) {
    tilt = `tilted ${formatRounded(Math.abs(rodDeg), 1)} degrees away from the crankpin's side of the cylinder`;
  } else {
    tilt = "aligned with the cylinder centerline";
  }

  return (
    `At a crank angle of ${formatRounded(angleDeg, 1)} degrees, the piston is ` +
    `${lengthForDisplay(state.pistonDisplacementMm, unit)} past top dead center, ` +
    `and the connecting rod is ${tilt}.`
  );
}
