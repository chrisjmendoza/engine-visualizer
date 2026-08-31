import type { AnimationControls, CrankMechanismConfig } from "./types";

/** Plausible automotive single-cylinder default (square bore/stroke). */
export const DEFAULT_CONFIG: CrankMechanismConfig = {
  boreMm: 86,
  strokeMm: 86,
  rodLengthMm: 143,
  compressionRatio: 10.5,
  redlineRpm: 7000,
};

export const DEFAULT_ANIMATION: AnimationControls = {
  // A low default speed, further slowed by DEFAULT_PLAYBACK_SPEED, so the
  // mechanism's motion is legible the moment the page opens.
  rpm: 60,
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
  redlineRpm: { min: 3000, max: 12_000 },
  // Must cover every legal redline (redlineRpm.max), since the "At redline"
  // button and share links both put redlineRpm directly into rpm.
  rpm: { min: 0, max: 12_000 },
} as const;

export const MM_PER_INCH = 25.4;

export const TWO_PI = Math.PI * 2;

/** How often the animation loop mirrors the live crank angle into the store. */
export const READOUT_SYNC_HZ = 10;

/**
 * Visual playback-speed multipliers. Rendered motion advances at
 * `rpm × playbackSpeed`; every calculated readout keeps using the true RPM.
 * Even idle speeds (600 RPM = 10 rev/s) strobe at 60 fps, so rendering is
 * slowed by default (see DEFAULT_PLAYBACK_SPEED).
 */
export const PLAYBACK_SPEEDS = [1, 0.5, 0.25, 0.1, 0.02, 0.01, 0.004] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/**
 * Display labels for each multiplier, kept beside the values so the two
 * cannot drift apart. The slowest settings exist for high-revving engines:
 * a 9,000 rpm redline is 150 revolutions per second, which needs roughly
 * 1/250x before a full revolution is watchable.
 */
export const PLAYBACK_SPEED_LABELS: Record<PlaybackSpeed, string> = {
  1: "1×",
  0.5: "1/2×",
  0.25: "1/4×",
  0.1: "1/10×",
  0.02: "1/50×",
  0.01: "1/100×",
  0.004: "1/250×",
};

export const DEFAULT_PLAYBACK_SPEED: PlaybackSpeed = 0.5;
