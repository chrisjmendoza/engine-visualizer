import type { AnimationControls, CrankMechanismConfig } from "./types";

/** Plausible automotive single-cylinder default (square bore/stroke). */
export const DEFAULT_CONFIG: CrankMechanismConfig = {
  boreMm: 86,
  strokeMm: 86,
  rodLengthMm: 143,
  compressionRatio: 10.5,
};

export const DEFAULT_ANIMATION: AnimationControls = {
  rpm: 600,
  isPlaying: true,
  crankAngleRad: 0,
};

/**
 * Practical input ranges (TECHNICAL_DESIGN.md §13). The cross-field rule
 * `rodLength > stroke / 2` remains authoritative even inside these ranges.
 */
export const INPUT_RANGES = {
  boreMm: { min: 20, max: 200 },
  strokeMm: { min: 20, max: 200 },
  rodLengthMm: { min: 30, max: 400 },
  compressionRatio: { min: 5, max: 20 },
  rpm: { min: 0, max: 10_000 },
} as const;

export const MM_PER_INCH = 25.4;

export const TWO_PI = Math.PI * 2;

/** How often the animation loop mirrors the live crank angle into the store. */
export const READOUT_SYNC_HZ = 10;
