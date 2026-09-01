/**
 * Constants for the rotary (Wankel) family: the fixed counts that fall out of
 * the mechanism's geometry, the practical input ranges, and a default
 * configuration.
 *
 * The piston family's constants stay in `./constants.ts`; `INPUT_RANGES` is
 * re-used here for the two fields the two families genuinely share
 * (compression ratio has its own rotary range, redline does not — a redline is
 * a redline whatever is spinning).
 */

import { INPUT_RANGES } from "./constants";
import type { RotaryConfig, RotaryRotorCount } from "./rotaryTypes";

/**
 * A rotor has three flanks, so three working chambers — the count that makes a
 * rotary fire once per shaft revolution off a rotor turning at a third of
 * shaft speed. Not a configurable: a two- or four-lobe rotor needs a different
 * trochoid entirely, and every formula in this tree assumes three.
 */
export const ROTOR_FACE_COUNT = 3;

/**
 * The eccentric shaft turns three times per rotor revolution.
 *
 * This is forced by the geometry, not chosen. The rotor's apexes ride the
 * peritrochoid `P(α) = (e·cos3α + R·cosα, e·sin3α + R·sinα)`, whose `3α` term
 * is what makes the rotor center orbit three times for each turn of the rotor
 * body — see the identity proof in `rotaryGeometry.ts`. Every "1/3", "×3",
 * "1080°", and "mod 6" in this codebase traces back to this number.
 */
export const SHAFT_REVS_PER_ROTOR_REV = 3;

/**
 * The smallest K = R/e that still describes a real housing.
 *
 * The peritrochoid's speed is |P′(α)|² = 9e² + R² + 6eR·cos2α, whose minimum
 * (at cos2α = −1) is exactly (R − 3e)². At R = 3e the curve has a cusp; below
 * it the "housing" crosses itself into a looped rosette that no rotor could
 * sweep. So K > 3 is a hard geometric floor, not a taste judgment — unlike
 * K ≈ 6, below which the housing merely turns lumpy and unfashionable while
 * remaining perfectly valid to explore. `rotaryValidation.ts` enforces the
 * floor and nothing above it.
 */
export const ROTARY_MIN_K_FACTOR = 3;

/**
 * Practical input ranges for rotary geometry. The cross-field rule
 * `generatingRadius > ROTARY_MIN_K_FACTOR × eccentricity` remains
 * authoritative inside these ranges, exactly as `rodLength > stroke / 2` does
 * for the piston family — and it bites here, since R = 60 with e = 25 sits
 * inside both individual ranges at K = 2.4.
 *
 * Compression ratio gets a narrower window than the piston family's 5–20: a
 * rotary's long, thin, high-surface-area chamber will not tolerate much beyond
 * 10:1 on pump fuel, and production rotaries have lived between roughly 9 and
 * 10 for fifty years.
 */
export const ROTARY_INPUT_RANGES = {
  generatingRadiusMm: { min: 60, max: 140 },
  eccentricityMm: { min: 8, max: 25 },
  rotorWidthMm: { min: 40, max: 120 },
  compressionRatio: { min: 8, max: 12 },
  // Shared with the piston family: the store puts a redline straight into rpm
  // for the "At redline" button and share links, so the two must agree.
  redlineRpm: INPUT_RANGES.redlineRpm,
} as const;

/**
 * The configuration a rotary slot opens on: the textbook Mazda 13B geometry
 * (R = 105 mm, e = 15 mm, b = 80 mm), which is also the worked example every
 * derivation in this tree is checked against — 3√3·e·R·b comes out at 654.7 cc
 * per chamber against Mazda's published 654 cc, and 1,309 cc for the two-rotor
 * engine against a published 1,308 cc.
 *
 * This is a *default*, not a preset. The cited preset roster — variant names,
 * output figures, per-variant compression ratios and redlines — is built
 * elsewhere from researched data; these are only the dimensions the math needs
 * a plausible starting value for.
 */
export const DEFAULT_ROTARY_CONFIG: RotaryConfig = {
  generatingRadiusMm: 105,
  eccentricityMm: 15,
  rotorWidthMm: 80,
  compressionRatio: 9,
  redlineRpm: 8000,
};

/** Two rotors: the configuration nearly every road-going rotary shipped with. */
export const DEFAULT_ROTARY_ROTOR_COUNT: RotaryRotorCount = 2;

/** Every rotor count with defined phasing, for pickers and validation. */
export const ROTARY_ROTOR_COUNTS = [1, 2, 3] as const;
