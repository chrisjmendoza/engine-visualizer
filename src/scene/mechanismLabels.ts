/**
 * Naming for the text shown under each rendered mechanism.
 *
 * The scene consumes `ENGINE_PRESETS` as engine-layer data: if a configuration
 * still matches a preset exactly, that preset's name identifies it; once any
 * dimension has been edited it is no longer that engine, so it is described as
 * a custom one.
 *
 * Pure: no React, Three.js, or browser imports.
 */

import { ENGINE_PRESETS } from "../engine/presets";
import type { CrankMechanismConfig } from "../engine/types";

/** Shown when a configuration matches no preset. */
export const CUSTOM_ENGINE_LABEL = "Custom engine";

/**
 * Exact field-by-field equality. Every field of `CrankMechanismConfig` is
 * compared, so editing any one of them — including redline — makes the
 * configuration custom rather than silently keeping a preset's name.
 */
function configsMatch(
  a: CrankMechanismConfig,
  b: CrankMechanismConfig,
): boolean {
  return (
    a.boreMm === b.boreMm &&
    a.strokeMm === b.strokeMm &&
    a.rodLengthMm === b.rodLengthMm &&
    a.compressionRatio === b.compressionRatio &&
    a.redlineRpm === b.redlineRpm
  );
}

/** The preset this configuration matches exactly, or null. */
export function findMatchingPreset(config: CrankMechanismConfig) {
  return ENGINE_PRESETS.find((preset) => configsMatch(preset.config, config));
}

/** Display name for a configuration: its preset's name, or "Custom engine". */
export function describeConfig(config: CrankMechanismConfig): string {
  return findMatchingPreset(config)?.name ?? CUSTOM_ENGINE_LABEL;
}
