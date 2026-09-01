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

import { DEFAULT_CONFIG } from "../engine/constants";
import { ENGINE_PRESETS } from "../engine/presets";
import { calculateRotaryEngineDisplacementCc } from "../engine/rotaryCalculations";
import type { RotaryConfig, RotaryRotorCount } from "../engine/rotaryTypes";
import type { CrankMechanismConfig } from "../engine/types";

/** Shown when a configuration matches no preset. */
export const CUSTOM_ENGINE_LABEL = "Custom engine";

/**
 * Shown for the untouched default configuration, which matches no preset but
 * isn't anything the user customized either — "Custom engine" on first load
 * wrongly implied edits had already been made.
 */
export const DEFAULT_ENGINE_LABEL = "Default engine (86 × 86 mm)";

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

/**
 * Display name for a configuration: its preset's name, the default label for
 * the untouched default configuration, or "Custom engine" once edited.
 */
export function describeConfig(config: CrankMechanismConfig): string {
  const preset = findMatchingPreset(config);
  if (preset) {
    return preset.name;
  }
  return configsMatch(config, DEFAULT_CONFIG)
    ? DEFAULT_ENGINE_LABEL
    : CUSTOM_ENGINE_LABEL;
}

/** How each supported rotor count is spelled out in a rotary's label. */
const ROTOR_COUNT_WORDS: Readonly<Record<RotaryRotorCount, string>> =
  Object.freeze({
    1: "Single-rotor",
    2: "Two-rotor",
    3: "Three-rotor",
  });

/**
 * Display name for a rotary configuration (§27).
 *
 * Deliberately *not* preset matching, unlike `describeConfig`. A rotary's
 * identity is carried almost entirely by its rotor count and its displacement
 * — a 13B and a Renesis share R, e, and b and differ in porting, which this
 * app does not model — so naming a rotary after a preset would put a badge on
 * geometry that several real engines share. The count and the rated
 * displacement are what the label can honestly claim, and the displacement is
 * quoted by the industry convention `calculateRotaryEngineDisplacementCc`
 * documents (chamber volume × rotor count, the number on the car's badge).
 *
 * Rounded to whole cubic centimeters, which is how every rotary has ever been
 * advertised: the canonical 13B geometry reads "1,309 cc" here against Mazda's
 * published 1,308, the difference being rounding in the quoted dimensions
 * rather than a modeling error.
 */
export function describeRotaryConfig(
  config: RotaryConfig,
  rotorCount: RotaryRotorCount,
): string {
  const displacementCc = Math.round(
    calculateRotaryEngineDisplacementCc(config, rotorCount),
  );
  return `${ROTOR_COUNT_WORDS[rotorCount]} rotary (${displacementCc.toLocaleString("en-US")} cc)`;
}
