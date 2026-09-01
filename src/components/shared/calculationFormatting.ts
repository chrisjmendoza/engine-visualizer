/**
 * Presentation helpers shared between `CalculationPanel` and
 * `ComparisonTable`, so the two never drift on wording or rounding. Kept
 * out of `CalculationPanel.tsx` itself (rather than exported from there) so
 * that component file only exports the component — Fast Refresh (and
 * oxlint's `react/only-export-components` rule) expects that.
 */

import { mmToIn } from "../../engine/units";
import type { CrankMechanismConfig, DisplayUnit } from "../../engine/types";
import { ENGINE_PRESETS } from "../../engine/presets";
import type { EnginePreset } from "../../engine/presets";
import { ROTARY_ENGINE_PRESETS } from "../../engine/rotaryPresets";
import type { RotaryEnginePreset } from "../../engine/rotaryPresets";
import type { RotaryConfig } from "../../engine/rotaryTypes";
import { formatRounded, formatRpm } from "./formatting";
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

/**
 * The verified whole-engine output (peak power and peak torque, each with
 * its own rpm) for whichever preset a config's per-cylinder geometry
 * exactly matches — the same bore/stroke/rod comparison
 * `PresetSelector.tsx` uses to decide whether a preset button reads as
 * selected. Deliberately ignores cylinder count/layout and the
 * cylinder-view preference: `output` describes the whole real engine
 * regardless of which layout this visualizer currently renders for it, or
 * how much of it is on stage. Returns `undefined` when no preset matches,
 * or when the matching preset has no published output (a hand-edited
 * config, or a preset whose figures couldn't clear the two-source bar) —
 * callers render "—" in that case, the same as any other preset-derived
 * value.
 */
export function matchingPresetOutput(
  config: CrankMechanismConfig,
): EnginePreset["output"] | undefined {
  const preset = ENGINE_PRESETS.find(
    (candidate) =>
      candidate.config.boreMm === config.boreMm &&
      candidate.config.strokeMm === config.strokeMm &&
      candidate.config.rodLengthMm === config.rodLengthMm,
  );
  return preset?.output;
}

/**
 * Renders one peak-output figure with its own rpm, e.g. "240 hp @ 8,300
 * rpm" — or "—" when the value/rpm pair isn't available (no matching
 * preset, or a matching preset with no published output).
 */
export function peakOutputForDisplay(
  value: number | undefined,
  unit: string,
  rpm: number | undefined,
): string {
  if (value === undefined || rpm === undefined) {
    return "—";
  }
  return `${formatRounded(value, 0)} ${unit} @ ${formatRpm(rpm)}`;
}

/**
 * The verified whole-engine output for whichever rotary preset a config
 * exactly matches — the rotary `matchingPresetOutput`.
 *
 * Unlike the piston version, this compares the FULL config (R, e, rotor
 * width, compression ratio, AND redline), not just the chamber's physical
 * dimensions: three of this roster's four presets (13B-REW, 13B-MSP Renesis,
 * 20B-REW) share the exact same 105/15/80 chamber, differing only in
 * compression ratio and redline, so R/e/b alone would not tell them apart.
 * Deliberately ignores rotor count, though, mirroring the piston version's
 * own asymmetry (`PresetSelector`'s "is this preset selected" check does
 * look at layout; this output lookup does not) — a hand-selected rotor count
 * on otherwise-13B-REW geometry still reads as a 13B-REW for output-lookup
 * purposes.
 */
export function matchingRotaryPresetOutput(
  config: RotaryConfig,
): RotaryEnginePreset["output"] | undefined {
  const preset = ROTARY_ENGINE_PRESETS.find(
    (candidate) =>
      candidate.config.generatingRadiusMm === config.generatingRadiusMm &&
      candidate.config.eccentricityMm === config.eccentricityMm &&
      candidate.config.rotorWidthMm === config.rotorWidthMm &&
      candidate.config.compressionRatio === config.compressionRatio &&
      candidate.config.redlineRpm === config.redlineRpm,
  );
  return preset?.output;
}
