/**
 * Serialization of shareable application state to and from a URL query
 * string (TECHNICAL_DESIGN.md §2.2, "shareable engine configurations").
 *
 * This module is pure: it manipulates strings and plain data only. It uses
 * `URLSearchParams`, which is a WHATWG runtime standard present in Node and
 * test environments — not a DOM API — so the engine layer's "no browser
 * APIs" rule still holds. Reading and writing the actual address bar is the
 * interface layer's job.
 *
 * ## URL contract
 *
 * Shared links are permanent once published, so this format is append-only:
 * add new optional parameters, never repurpose or remove existing ones, and
 * never change how an existing parameter parses.
 *
 * | Param    | Meaning                                          | Omitted when |
 * |----------|--------------------------------------------------|--------------|
 * | `a`      | Engine A: a preset id, or `bore-stroke-rod-cr-redline` | never |
 * | `b`      | Engine B; its presence turns comparison mode on  | not comparing |
 * | `c`      | Engine A's cylinder count (§24a: 1, 3, 4, or 6)  | matches what `a` implies (a preset's own count, or 1) |
 * | `bc`     | Engine B's cylinder count                        | matches what `b` implies, or not comparing |
 * | `rpm`    | Engine speed (engine A's, when speeds are split) | default |
 * | `brpm`   | Engine B's speed; its presence means unlinked    | speeds linked |
 * | `u`      | `in` for inch display                            | millimeters |
 * | `sp`     | Playback speed multiplier                        | default |
 * | `angle`  | Crank angle in degrees; implies paused           | playing |
 * | `bangle` | Engine B's crank angle in degrees                | playing, or linked |
 *
 * A config is written as its preset id when it matches one exactly
 * (`?a=s2000-ap1` reads better than five numbers and keeps meaning if that
 * preset's researched data is later corrected). Otherwise it is five
 * hyphen-separated numbers in canonical units. The two forms are told apart
 * by content: preset ids always contain a letter, numeric configs never do.
 *
 * Decoding is deliberately forgiving — a truncated, hand-edited, or
 * outdated link yields whatever parts are valid and silently drops the
 * rest, rather than failing. Every decoded config passes `validateConfig`,
 * so a malformed link can never push invalid geometry into the simulation.
 */

import {
  DEFAULT_ANIMATION,
  DEFAULT_PLAYBACK_SPEED,
  INPUT_RANGES,
  PLAYBACK_SPEEDS,
  TWO_PI,
} from "./constants";
import type { PlaybackSpeed } from "./constants";
import { isSupportedCylinderCount } from "./engineLayout";
import type { SupportedCylinderCount } from "./engineLayout";
import { ENGINE_PRESETS } from "./presets";
import type { EnginePreset } from "./presets";
import type { CrankMechanismConfig, DisplayUnit } from "./types";
import { validateConfig } from "./validation";

/** The shareable slice of application state. */
export interface ShareState {
  config: CrankMechanismConfig;
  comparisonConfig: CrankMechanismConfig | null;
  /** Engine A's cylinder count (§24a). */
  cylinderCount: SupportedCylinderCount;
  /** Engine B's cylinder count; only meaningful while `comparisonConfig` is set. */
  comparisonCylinderCount: SupportedCylinderCount;
  rpm: number;
  /** Engine B's speed; only travels in a link while `rpmLinked` is false. */
  comparisonRpm: number;
  rpmLinked: boolean;
  displayUnit: DisplayUnit;
  playbackSpeed: PlaybackSpeed;
  isPlaying: boolean;
  crankAngleRad: number;
  /** Engine B's angle; differs from engine A's only while unlinked. */
  comparisonCrankAngleRad: number;
}

/** Whatever a link actually carried; absent fields keep their current value. */
export type PartialShareState = Partial<ShareState>;

const CONFIG_SEPARATOR = "-";

/** Formats a number without trailing zeros, e.g. 10.5 -> "10.5", 86 -> "86". */
function formatNumber(value: number): string {
  return String(Number(value.toFixed(4)));
}

function configsEqual(
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

/**
 * Finds the preset (if any) whose geometry exactly matches `config`. Shared
 * by `encodeConfig` (to decide whether a preset id or five numbers gets
 * written) and `defaultCylinderCountFor` (to decide what cylinder count a
 * link implies when it omits `c`/`bc`), so the two stay in lockstep by
 * construction rather than by two independently-maintained rules.
 */
function presetForConfig(
  config: CrankMechanismConfig,
): EnginePreset | undefined {
  return ENGINE_PRESETS.find((entry) => configsEqual(entry.config, config));
}

/**
 * The cylinder count a link implies for `config` when it carries no
 * explicit `c`/`bc`: a preset's own real cylinder count when `config`
 * matches one exactly (§24a — falling back to 1 for a preset whose real
 * layout isn't renderable yet, e.g. a V8), or 1 for a hand-typed numeric
 * config. A link is a complete description of an engine, so a numeric `a`
 * with no `c` means single-cylinder, not "leave the current count alone".
 */
export function defaultCylinderCountFor(
  config: CrankMechanismConfig,
): SupportedCylinderCount {
  return presetForConfig(config)?.cylinderCount ?? 1;
}

/** Encodes one config as a preset id when possible, else as five numbers. */
export function encodeConfig(config: CrankMechanismConfig): string {
  const preset = presetForConfig(config);
  if (preset) {
    return preset.id;
  }
  return [
    config.boreMm,
    config.strokeMm,
    config.rodLengthMm,
    config.compressionRatio,
    config.redlineRpm,
  ]
    .map(formatNumber)
    .join(CONFIG_SEPARATOR);
}

/** Decodes one config, returning null for anything unusable. */
export function decodeConfig(raw: string): CrankMechanismConfig | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }

  // Preset ids contain letters; numeric configs never do.
  if (/[a-z]/i.test(trimmed)) {
    const preset = ENGINE_PRESETS.find((entry) => entry.id === trimmed);
    return preset ? preset.config : null;
  }

  const parts = trimmed.split(CONFIG_SEPARATOR);
  if (parts.length !== 5) {
    return null;
  }
  const [bore, stroke, rod, ratio, redline] = parts.map(Number);
  const result = validateConfig({
    boreMm: bore,
    strokeMm: stroke,
    rodLengthMm: rod,
    compressionRatio: ratio,
    redlineRpm: redline,
  });
  return result.ok ? result.config : null;
}

function isPlaybackSpeed(value: number): value is PlaybackSpeed {
  return (PLAYBACK_SPEEDS as readonly number[]).includes(value);
}

/** Normalizes radians into [0, 2*PI) and converts to degrees. */
function toDegrees(radians: number): number {
  const wrapped = ((radians % TWO_PI) + TWO_PI) % TWO_PI;
  return (wrapped * 180) / Math.PI;
}

/** Reads a degrees parameter back into normalized radians. */
function parseAngleParam(raw: string): number | null {
  const degrees = Number(raw);
  if (!Number.isFinite(degrees)) {
    return null;
  }
  const radians = (degrees * Math.PI) / 180;
  return ((radians % TWO_PI) + TWO_PI) % TWO_PI;
}

/** Reads an rpm parameter, rejecting values outside the practical range. */
function parseRpmParam(raw: string): number | null {
  const rpm = Number(raw);
  return Number.isFinite(rpm) &&
    rpm >= INPUT_RANGES.rpm.min &&
    rpm <= INPUT_RANGES.rpm.max
    ? rpm
    : null;
}

/**
 * Builds the query string (without a leading "?") for the given state.
 * Values at their defaults are omitted to keep shared links short.
 */
export function encodeShareState(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("a", encodeConfig(state.config));

  if (state.comparisonConfig) {
    params.set("b", encodeConfig(state.comparisonConfig));
  }
  // `c` only needs to travel when it disagrees with what decoding `a` will
  // infer on its own: a preset id already implies its own real cylinder
  // count (§24a), and a numeric config implies 1. Omitting `c` whenever the
  // count merely equals 1 (regardless of what `a` implies) would corrupt a
  // preset-id link deliberately viewed at a different count — see
  // `defaultCylinderCountFor`. Engine B's count only means anything once
  // engine B itself is in the link, same reasoning as `brpm`/`bangle` below.
  if (state.cylinderCount !== defaultCylinderCountFor(state.config)) {
    params.set("c", String(state.cylinderCount));
  }
  if (
    state.comparisonConfig &&
    state.comparisonCylinderCount !==
      defaultCylinderCountFor(state.comparisonConfig)
  ) {
    params.set("bc", String(state.comparisonCylinderCount));
  }
  if (state.rpm !== DEFAULT_ANIMATION.rpm) {
    params.set("rpm", formatNumber(state.rpm));
  }
  // Engine B's speed travels only when the engines are actually unlinked,
  // and then always — even if it happens to equal engine A's — because its
  // presence is what tells the reader the speeds are split.
  if (state.comparisonConfig && !state.rpmLinked) {
    params.set("brpm", formatNumber(state.comparisonRpm));
  }
  if (state.displayUnit === "in") {
    params.set("u", "in");
  }
  if (state.playbackSpeed !== DEFAULT_PLAYBACK_SPEED) {
    params.set("sp", formatNumber(state.playbackSpeed));
  }
  // A paused link is a link to one exact crank position, so the angle only
  // travels when playback is stopped; while playing it would be stale by
  // the time anyone opened the link.
  if (!state.isPlaying) {
    params.set("angle", formatNumber(toDegrees(state.crankAngleRad)));
    // Unlinked engines sit at genuinely different angles, so engine B's has
    // to travel too; while linked it is engine A's angle by definition.
    if (state.comparisonConfig && !state.rpmLinked) {
      params.set(
        "bangle",
        formatNumber(toDegrees(state.comparisonCrankAngleRad)),
      );
    }
  }

  // URLSearchParams percent-encodes nothing in our value alphabet
  // (digits, ".", "-", lowercase letters), so the result stays readable.
  return params.toString();
}

/**
 * Parses a query string into whatever state it validly carried. Unknown,
 * malformed, or out-of-range parameters are ignored rather than throwing,
 * so an old or hand-edited link still opens.
 */
export function decodeShareState(query: string): PartialShareState {
  const params = new URLSearchParams(
    query.startsWith("?") ? query.slice(1) : query,
  );
  const state: PartialShareState = {};

  const rawA = params.get("a");
  if (rawA) {
    const config = decodeConfig(rawA);
    if (config) {
      state.config = config;
    }
  }

  const rawB = params.get("b");
  if (rawB) {
    const comparisonConfig = decodeConfig(rawB);
    if (comparisonConfig) {
      state.comparisonConfig = comparisonConfig;
    }
  }

  // An explicit `c` always wins. Absent, `a` still implies a count — a
  // preset id implies its own real cylinder count, a numeric config implies
  // 1 (see `defaultCylinderCountFor`) — so a link is a complete description
  // of engine A's layout even when `c` never travelled. `c` present but
  // unsupported (a stale or hand-edited value) is neither "explicit" nor
  // "absent": it's dropped without falling back, leaving the current
  // session's count stand, same as any other malformed param here.
  const rawC = params.get("c");
  if (rawC !== null) {
    const count = Number(rawC);
    if (isSupportedCylinderCount(count)) {
      state.cylinderCount = count;
    }
  } else if (state.config) {
    state.cylinderCount = defaultCylinderCountFor(state.config);
  }

  // `bc` only means anything alongside a successfully decoded engine B —
  // same reasoning as `brpm`/`bangle` above — and so does its absence:
  // no `b`, no implied count either.
  const rawBc = params.get("bc");
  if (state.comparisonConfig) {
    if (rawBc !== null) {
      const count = Number(rawBc);
      if (isSupportedCylinderCount(count)) {
        state.comparisonCylinderCount = count;
      }
    } else {
      state.comparisonCylinderCount = defaultCylinderCountFor(
        state.comparisonConfig,
      );
    }
  }

  const rawRpm = params.get("rpm");
  if (rawRpm !== null) {
    const rpm = parseRpmParam(rawRpm);
    if (rpm !== null) {
      state.rpm = rpm;
    }
  }

  // A valid `brpm` is the signal that the engines were unlinked; without it
  // the link says nothing about linking and the current setting stands.
  // It only means anything alongside a successfully decoded engine B —
  // a hand-edited link carrying `brpm` with no usable `b` must not leave
  // a future comparison silently pre-unlinked.
  const rawComparisonRpm = params.get("brpm");
  if (rawComparisonRpm !== null && state.comparisonConfig) {
    const comparisonRpm = parseRpmParam(rawComparisonRpm);
    if (comparisonRpm !== null) {
      state.comparisonRpm = comparisonRpm;
      state.rpmLinked = false;
    }
  }

  if (params.get("u") === "in") {
    state.displayUnit = "in";
  } else if (params.get("u") === "mm") {
    state.displayUnit = "mm";
  }

  const rawSpeed = params.get("sp");
  if (rawSpeed !== null) {
    const speed = Number(rawSpeed);
    if (Number.isFinite(speed) && isPlaybackSpeed(speed)) {
      state.playbackSpeed = speed;
    }
  }

  const rawAngle = params.get("angle");
  if (rawAngle !== null) {
    const radians = parseAngleParam(rawAngle);
    if (radians !== null) {
      state.crankAngleRad = radians;
      state.isPlaying = false;
    }
  }

  const rawComparisonAngle = params.get("bangle");
  if (rawComparisonAngle !== null && state.comparisonConfig) {
    const radians = parseAngleParam(rawComparisonAngle);
    if (radians !== null) {
      state.comparisonCrankAngleRad = radians;
    }
  }

  return state;
}
