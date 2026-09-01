/**
 * Rotary input validation (TECHNICAL_DESIGN.md §13, §27) — the rotary family's
 * half of the validation layer, kept in its own module so that the piston
 * family's `validation.ts` is untouched by a second engine family.
 *
 * The rule that matters is the cross-field one, and it is the rotary's exact
 * counterpart to `rodLengthMm > strokeMm / 2`: a configuration whose fields all
 * sit inside their individual ranges can still describe an impossible
 * mechanism.
 *
 * ## Why K = R/e must exceed 3
 *
 * The housing is the peritrochoid `P(α) = (e·cos3α + R·cosα, e·sin3α +
 * R·sinα)`. Differentiate and take the squared speed:
 *
 *     x′ = −3e·sin3α − R·sinα
 *     y′ =  3e·cos3α + R·cosα
 *     |P′(α)|² = 9e² + R² + 6eR·(cos3α·cosα + sin3α·sinα)
 *              = 9e² + R² + 6eR·cos2α
 *
 * whose minimum, at cos2α = −1, is exactly **(R − 3e)²**. So:
 *
 * - R > 3e: |P′| never vanishes; the curve is smooth and simple — a housing.
 * - R = 3e: two cusps at the waist. The curve is still closed but no longer
 *   differentiable, and the rotor's apexes would have to reverse direction.
 * - R < 3e: the curve crosses itself into a looped rosette. There is no
 *   interior for a rotor to sweep, and every area and volume this codebase
 *   computes becomes meaningless (the shoelace happily returns a number).
 *
 * The confirmation is numerical as well as algebraic: `rotaryValidation.test.ts`
 * walks the outline at K = 2.4 and 2.9 and finds real segment intersections,
 * and finds none at 3.1 and above.
 *
 * ### What is *not* forbidden
 *
 * K below about 6 makes a deep-waisted, lumpy, thoroughly unfashionable
 * housing that no manufacturer would build. It is still a housing, the math is
 * still exact, and exploring it is the point of the application — so nothing
 * here objects to it. The floor stops degeneracy, not bad taste.
 *
 * The ranges themselves make the rule bite rather than being belt-and-braces:
 * R = 60 with e = 25 is K = 2.4, and both values sit comfortably inside
 * `ROTARY_INPUT_RANGES`.
 */

import { z } from "zod";
import {
  ROTARY_INPUT_RANGES,
  ROTARY_MIN_K_FACTOR,
  ROTARY_ROTOR_COUNTS,
} from "./rotaryConstants";
import type {
  RotaryConfig,
  RotaryRotorCount,
  RotaryValidationIssue,
} from "./rotaryTypes";

const ROTARY_CONFIG_FIELDS = [
  "generatingRadiusMm",
  "eccentricityMm",
  "rotorWidthMm",
  "compressionRatio",
  "redlineRpm",
] as const;
type RotaryConfigField = (typeof ROTARY_CONFIG_FIELDS)[number];

function isRotaryConfigField(field: string): field is RotaryConfigField {
  return (ROTARY_CONFIG_FIELDS as readonly string[]).includes(field);
}

/** Renders a millimeter value without misleading trailing precision. */
function formatMm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function dimensionSchema(label: string, range: { min: number; max: number }) {
  return z
    .number(`${label} must be a finite number of millimeters.`)
    .positive(`${label} must be greater than zero.`)
    .min(range.min, `${label} must be at least ${range.min} mm.`)
    .max(range.max, `${label} must be at most ${range.max} mm.`);
}

/** Schema for `RotaryConfig`, including the trochoid cross-check. */
export const rotaryConfigSchema = z
  .object({
    generatingRadiusMm: dimensionSchema(
      "Generating radius",
      ROTARY_INPUT_RANGES.generatingRadiusMm,
    ),
    eccentricityMm: dimensionSchema(
      "Eccentricity",
      ROTARY_INPUT_RANGES.eccentricityMm,
    ),
    rotorWidthMm: dimensionSchema(
      "Rotor width",
      ROTARY_INPUT_RANGES.rotorWidthMm,
    ),
    compressionRatio: z
      .number("Compression ratio must be a finite number.")
      .min(
        ROTARY_INPUT_RANGES.compressionRatio.min,
        `Compression ratio must be at least ${ROTARY_INPUT_RANGES.compressionRatio.min}:1.`,
      )
      .max(
        ROTARY_INPUT_RANGES.compressionRatio.max,
        `Compression ratio must be at most ${ROTARY_INPUT_RANGES.compressionRatio.max}:1.`,
      ),
    redlineRpm: z
      .number("Redline must be a finite number of RPM.")
      .min(
        ROTARY_INPUT_RANGES.redlineRpm.min,
        `Redline must be at least ${ROTARY_INPUT_RANGES.redlineRpm.min.toLocaleString()} RPM.`,
      )
      .max(
        ROTARY_INPUT_RANGES.redlineRpm.max,
        `Redline must be at most ${ROTARY_INPUT_RANGES.redlineRpm.max.toLocaleString()} RPM.`,
      ),
  })
  .superRefine((value, ctx) => {
    // The header's (R − 3e)² result: at or below this the housing cusps and
    // then loops through itself. Reported against the generating radius, the
    // field a user is most likely reaching for when they build a peanut.
    const minimumRadiusMm = ROTARY_MIN_K_FACTOR * value.eccentricityMm;
    if (value.generatingRadiusMm <= minimumRadiusMm) {
      ctx.addIssue({
        code: "custom",
        path: ["generatingRadiusMm"],
        message: `Generating radius must be greater than ${formatMm(minimumRadiusMm)} mm — ${ROTARY_MIN_K_FACTOR}× the ${formatMm(value.eccentricityMm)} mm eccentricity — or the housing crosses itself.`,
      });
    }
  });

/**
 * Narrowing guard for rotor counts, in the same spirit as
 * `isEngineLayoutId`: the picker is a closed list of three and a
 * hand-edited share link's bad value is dropped silently (§25a), so a boolean
 * narrowing is what both entry points want — not a parsed value with a
 * user-facing message.
 */
export function isRotaryRotorCount(value: unknown): value is RotaryRotorCount {
  return (ROTARY_ROTOR_COUNTS as readonly unknown[]).includes(value);
}

export function validateRotaryConfig(
  config: unknown,
):
  | { ok: true; config: RotaryConfig }
  | { ok: false; issues: RotaryValidationIssue[] } {
  const result = rotaryConfigSchema.safeParse(config);
  if (result.success) {
    return { ok: true, config: result.data };
  }

  const issues: RotaryValidationIssue[] = result.error.issues.map((issue) => {
    const key = String(issue.path[0] ?? "");
    const field: RotaryConfigField = isRotaryConfigField(key)
      ? key
      : "generatingRadiusMm";
    return { field, message: issue.message };
  });
  return { ok: false, issues };
}
