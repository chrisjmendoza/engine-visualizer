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

/**
 * Visual playback-speed multipliers. Rendered motion advances at
 * `rpm × playbackSpeed`; every calculated readout keeps using the true RPM.
 * Even idle speeds (600 RPM = 10 rev/s) strobe at 60 fps, so the default
 * slows rendering to one-tenth of real time.
 */
export const PLAYBACK_SPEEDS = [1, 0.5, 0.25, 0.1, 0.02] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export const DEFAULT_PLAYBACK_SPEED: PlaybackSpeed = 0.1;
