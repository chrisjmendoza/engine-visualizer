/**
 * Input validation (TECHNICAL_DESIGN.md §13).
 *
 * Rejects non-positive dimensions, non-finite values, out-of-range inputs,
 * and — critically — connecting-rod lengths that do not clear the crank
 * radius (`rodLengthMm > strokeMm / 2`). This cross-field rule is
 * authoritative even when every field individually satisfies its own range.
 * Invalid configurations must never reach the simulation or renderer.
 */

import { z } from "zod";
import { INPUT_RANGES } from "./constants";
import type { CrankMechanismConfig, ValidationIssue } from "./types";

const CONFIG_FIELDS = [
  "boreMm",
  "strokeMm",
  "rodLengthMm",
  "compressionRatio",
  "redlineRpm",
] as const;
type ConfigField = (typeof CONFIG_FIELDS)[number];

function isConfigField(field: string): field is ConfigField {
  return (CONFIG_FIELDS as readonly string[]).includes(field);
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

/** Schema for `CrankMechanismConfig`, including the crank-radius cross-check. */
export const crankMechanismConfigSchema = z
  .object({
    boreMm: dimensionSchema("Bore", INPUT_RANGES.boreMm),
    strokeMm: dimensionSchema("Stroke", INPUT_RANGES.strokeMm),
    rodLengthMm: dimensionSchema(
      "Connecting-rod length",
      INPUT_RANGES.rodLengthMm,
    ),
    compressionRatio: z
      .number("Compression ratio must be a finite number.")
      .min(
        INPUT_RANGES.compressionRatio.min,
        `Compression ratio must be at least ${INPUT_RANGES.compressionRatio.min}:1.`,
      )
      .max(
        INPUT_RANGES.compressionRatio.max,
        `Compression ratio must be at most ${INPUT_RANGES.compressionRatio.max}:1.`,
      ),
    redlineRpm: z
      .number("Redline must be a finite number of RPM.")
      .min(
        INPUT_RANGES.redlineRpm.min,
        `Redline must be at least ${INPUT_RANGES.redlineRpm.min.toLocaleString()} RPM.`,
      )
      .max(
        INPUT_RANGES.redlineRpm.max,
        `Redline must be at most ${INPUT_RANGES.redlineRpm.max.toLocaleString()} RPM.`,
      ),
  })
  .superRefine((value, ctx) => {
    const crankRadiusMm = value.strokeMm / 2;
    if (value.rodLengthMm <= crankRadiusMm) {
      ctx.addIssue({
        code: "custom",
        path: ["rodLengthMm"],
        message: `Connecting-rod length must be greater than the ${formatMm(crankRadiusMm)} mm crank radius.`,
      });
    }
  });

/** Schema for engine speed in revolutions per minute. */
export const rpmSchema = z
  .number("RPM must be a finite number.")
  .min(INPUT_RANGES.rpm.min, `RPM must be at least ${INPUT_RANGES.rpm.min}.`)
  .max(INPUT_RANGES.rpm.max, `RPM must be at most ${INPUT_RANGES.rpm.max}.`);

export function validateConfig(
  config: unknown,
):
  | { ok: true; config: CrankMechanismConfig }
  | { ok: false; issues: ValidationIssue[] } {
  const result = crankMechanismConfigSchema.safeParse(config);
  if (result.success) {
    return { ok: true, config: result.data };
  }

  const issues: ValidationIssue[] = result.error.issues.map((issue) => {
    const key = String(issue.path[0] ?? "");
    const field: ConfigField = isConfigField(key) ? key : "boreMm";
    return { field, message: issue.message };
  });
  return { ok: false, issues };
}
