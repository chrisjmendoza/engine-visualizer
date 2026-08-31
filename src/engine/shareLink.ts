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
 * | `l`      | Engine A's layout id (§24a: `v8-cross`, `inline-4`, ...) | matches what `a` implies (a preset's own layout, else the default layout) |
 * | `bl`     | Engine B's layout id                             | matches what `b` implies, or not comparing |
 * | `sv`     | Engine A's cylinder view: `1` one cylinder, `0` whole engine | matches what the link's own `l`/`c` imply |
 * | `bsv`    | Engine B's cylinder view                         | matches what `bl`/`bc` imply, or not comparing |
 * | `c`      | **Legacy.** Engine A's cylinder count (1, 3, 4, 6) | always — superseded by `l`, still decoded |
 * | `bc`     | **Legacy.** Engine B's cylinder count            | always — superseded by `bl`, still decoded |
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
 *
 * ## `c`/`bc`, and `l=single` — the append-only rule in practice
 *
 * The first multi-cylinder release identified a layout by a bare cylinder
 * count (`c=6`). A count can no longer identify a layout (a V8 and an
 * inline-8 share one), so `l`/`bl` carry a layout id instead — but links
 * written by that release are already out in the world, so `c`/`bc` must
 * keep decoding forever. They map onto the only layouts that release could
 * render (see `LEGACY_COUNT_LAYOUT_IDS`) and are never emitted again. An
 * explicit `l` always wins over a legacy `c` in the same link.
 *
 * The release after that split "which engine is this" from "how much of it am
 * I looking at" (§24a): `l` now names an **architecture** and `sv` names the
 * **view**. `l=single` and `c=1` predate the split and said both things at
 * once, so they now decode as "one cylinder of whatever `a` implies" —
 * `singleCylinderView: true`, with the architecture still taken from `a`. A
 * legacy link therefore opens showing exactly the one cylinder it always did.
 * `c=3|4|6` and any other `l` keep meaning that architecture with the whole
 * engine on stage.
 *
 * ## When `sv` travels
 *
 * `sv` follows the same rule `l` does — it is written exactly when it
 * disagrees with what the rest of the link already implies (see
 * `impliedSingleCylinderView`), which is what keeps every state round-tripping
 * while leaving the common links short. A link that names no architecture is
 * describing one cylinder of whatever `a` implies; a link that names one is
 * describing that whole engine.
 */

import {
  DEFAULT_ANIMATION,
  DEFAULT_PLAYBACK_SPEED,
  INPUT_RANGES,
  PLAYBACK_SPEEDS,
  TWO_PI,
} from "./constants";
import type { PlaybackSpeed } from "./constants";
import { DEFAULT_LAYOUT_ID, isEngineLayoutId } from "./engineLayout";
import type { EngineLayoutId } from "./engineLayout";
import { ENGINE_PRESETS } from "./presets";
import type { EnginePreset } from "./presets";
import type { CrankMechanismConfig, DisplayUnit } from "./types";
import { validateConfig } from "./validation";

/** The shareable slice of application state. */
export interface ShareState {
  config: CrankMechanismConfig;
  comparisonConfig: CrankMechanismConfig | null;
  /** Engine A's layout (§24a). */
  layoutId: EngineLayoutId;
  /** Engine B's layout; only meaningful while `comparisonConfig` is set. */
  comparisonLayoutId: EngineLayoutId;
  /** Engine A's view: one cylinder of that layout, or the whole engine (§24a). */
  singleCylinderView: boolean;
  /** Engine B's view; only meaningful while `comparisonConfig` is set. */
  comparisonSingleCylinderView: boolean;
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
 * written) and `defaultLayoutIdFor` (to decide what layout a link implies
 * when it omits `l`/`bl`), so the two stay in lockstep by construction
 * rather than by two independently-maintained rules.
 */
function presetForConfig(
  config: CrankMechanismConfig,
): EnginePreset | undefined {
  return ENGINE_PRESETS.find((entry) => configsEqual(entry.config, config));
}

/**
 * The layout a link implies for `config` when it carries no explicit
 * `l`/`bl`: a preset's own real layout when `config` matches one exactly
 * (§24a), else `DEFAULT_LAYOUT_ID` — the same architecture the app itself
 * opens on. A link is a complete description of an engine, so a numeric `a`
 * with no `l` describes the default engine, not "leave the current layout
 * alone".
 *
 * The fallback used to be `"single"`, back when that was both an architecture
 * and a view. It no longer is: the *view* now comes from `sv` (which defaults
 * to one cylinder), so a bare numeric link still opens on exactly one
 * cylinder, as it always did — that cylinder is simply now labeled as
 * belonging to the default architecture rather than to a layout called
 * "single".
 */
export function defaultLayoutIdFor(
  config: CrankMechanismConfig,
): EngineLayoutId {
  return presetForConfig(config)?.layoutId ?? DEFAULT_LAYOUT_ID;
}

/**
 * The layouts the pre-`l` release could describe with its `c` cylinder
 * count, all of them inline (§25a's append-only rule). Decode-only: nothing
 * writes `c` any more, and a count outside this map is dropped like any
 * other malformed parameter.
 */
const LEGACY_COUNT_LAYOUT_IDS: Record<string, EngineLayoutId> = {
  "1": "single",
  "3": "inline-3",
  "4": "inline-4",
  "6": "inline-6",
};

/** Reads a legacy `c`/`bc` cylinder count as a layout id, or null. */
function layoutIdFromLegacyCount(raw: string): EngineLayoutId | null {
  return LEGACY_COUNT_LAYOUT_IDS[raw.trim()] ?? null;
}

/**
 * The cylinder view a link implies when it carries no explicit `sv`/`bsv`,
 * given the layout id that link writes (or `null` when it writes none).
 *
 * A link that names an architecture is describing that whole engine; a link
 * that names none — or names the legacy `"single"`, which never was an
 * architecture — is describing one cylinder. Encoding and decoding both go
 * through this one function, which is what makes "omit `sv` when it agrees
 * with the rest of the link" safe to round-trip.
 */
function impliedSingleCylinderView(layoutParam: string | null): boolean {
  return layoutParam === null || layoutParam === "single";
}

/** Reads an `sv`/`bsv` flag: `"1"` one cylinder, `"0"` whole engine, else null. */
function parseViewParam(raw: string | null): boolean | null {
  if (raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed === "1") {
    return true;
  }
  if (trimmed === "0") {
    return false;
  }
  return null;
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
 * Writes one engine's layout and cylinder-view parameters, each omitted when
 * the rest of the link already implies it. Shared by engines A (`l`/`sv`) and
 * B (`bl`/`bsv`) so the two can never drift apart.
 *
 * A state still carrying the legacy `"single"` layout id is normalized on the
 * way out rather than written verbatim: `"single"` was an architecture *and* a
 * view before §24a's second amendment split them, so it is written here as
 * what it always meant — the architecture `a` implies, viewed one cylinder at
 * a time. Nothing in the app stores `"single"` any more, but normalizing keeps
 * the encoder total, and keeps every state it can be handed round-trippable.
 */
function writeLayoutParams(
  params: URLSearchParams,
  layoutKey: string,
  viewKey: string,
  config: CrankMechanismConfig,
  layoutId: EngineLayoutId,
  singleCylinderView: boolean,
): void {
  const legacySingle = layoutId === "single";
  const impliedLayoutId = defaultLayoutIdFor(config);
  const effectiveLayoutId = legacySingle ? impliedLayoutId : layoutId;
  const effectiveView = legacySingle ? true : singleCylinderView;

  const layoutParam =
    effectiveLayoutId === impliedLayoutId ? null : effectiveLayoutId;
  if (layoutParam !== null) {
    params.set(layoutKey, layoutParam);
  }
  if (effectiveView !== impliedSingleCylinderView(layoutParam)) {
    params.set(viewKey, effectiveView ? "1" : "0");
  }
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
  // `l` only needs to travel when it disagrees with what decoding `a` will
  // infer on its own: a preset id already implies its own real layout
  // (§24a), and any other config implies `DEFAULT_LAYOUT_ID`. Engine B's
  // layout only means anything once engine B itself is in the link, same
  // reasoning as `brpm`/`bangle` below. The legacy `c`/`bc` are never
  // written: they are decode-only now.
  //
  // `sv` then travels only when the view disagrees with what that `l` (or
  // its absence) implies — see `impliedSingleCylinderView`.
  writeLayoutParams(
    params,
    "l",
    "sv",
    state.config,
    state.layoutId,
    state.singleCylinderView,
  );
  if (state.comparisonConfig) {
    writeLayoutParams(
      params,
      "bl",
      "bsv",
      state.comparisonConfig,
      state.comparisonLayoutId,
      state.comparisonSingleCylinderView,
    );
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
 * Reads one engine's layout and cylinder-view parameters back out of a link
 * — the exact inverse of `writeLayoutParams`, shared by engines A and B.
 *
 * An explicit `l` wins, then a legacy `c` (§25a: old links keep working).
 * Absent both, `a` still implies a layout (see `defaultLayoutIdFor`), so a
 * link is a complete description of the engine even when nothing travelled. A
 * parameter that is present but unrecognized (a stale or hand-edited value) is
 * neither "explicit" nor "absent": it is dropped without falling back, leaving
 * the current session's layout standing, same as any other malformed param
 * here — and it implies nothing about the view either.
 *
 * The legacy `l=single` and `c=1` are the one asymmetry: they named a view,
 * not an architecture, so they set `singleCylinderView` and leave the
 * architecture to `a`. An explicit `sv` always overrides whatever the layout
 * parameters implied.
 */
function readLayoutParams(
  layoutParam: string | null,
  legacyCountParam: string | null,
  viewParam: string | null,
  config: CrankMechanismConfig | undefined,
): { layoutId?: EngineLayoutId; singleCylinderView?: boolean } {
  // The layout id the link names, once the legacy count has been mapped on.
  // Null means "the link named none", which is not the same as naming one
  // this build does not know (`named === undefined`).
  let named: EngineLayoutId | null | undefined;
  if (layoutParam !== null) {
    named = isEngineLayoutId(layoutParam) ? layoutParam : undefined;
  } else if (legacyCountParam !== null) {
    named = layoutIdFromLegacyCount(legacyCountParam) ?? undefined;
  } else {
    named = null;
  }

  const result: { layoutId?: EngineLayoutId; singleCylinderView?: boolean } =
    {};
  const explicitView = parseViewParam(viewParam);
  if (explicitView !== null) {
    result.singleCylinderView = explicitView;
  }

  // Nothing usable was named, or nothing at all was said about this engine
  // (no layout parameter *and* no config): imply neither a layout nor a view,
  // so a link about something else entirely — `?rpm=4500` — leaves the
  // current session's engine alone.
  if (named === undefined || (named === null && config === undefined)) {
    return result;
  }

  // `"single"` was a view, not an architecture (see the module header), so it
  // leaves the architecture to whatever `a` implies — exactly as an absent
  // layout parameter does.
  const impliedLayoutId = config ? defaultLayoutIdFor(config) : undefined;
  const layoutId =
    named === null || named === "single" ? impliedLayoutId : named;
  if (layoutId !== undefined) {
    result.layoutId = layoutId;
  }
  if (explicitView === null) {
    result.singleCylinderView = impliedSingleCylinderView(named);
  }
  return result;
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

  const decodedA = readLayoutParams(
    params.get("l"),
    params.get("c"),
    params.get("sv"),
    state.config,
  );
  if (decodedA.layoutId !== undefined) {
    state.layoutId = decodedA.layoutId;
  }
  if (decodedA.singleCylinderView !== undefined) {
    state.singleCylinderView = decodedA.singleCylinderView;
  }

  // `bl`/`bc`/`bsv` only mean anything alongside a successfully decoded
  // engine B — same reasoning as `brpm`/`bangle` below — and so does their
  // absence: no `b`, no implied layout or view either.
  if (state.comparisonConfig) {
    const decodedB = readLayoutParams(
      params.get("bl"),
      params.get("bc"),
      params.get("bsv"),
      state.comparisonConfig,
    );
    if (decodedB.layoutId !== undefined) {
      state.comparisonLayoutId = decodedB.layoutId;
    }
    if (decodedB.singleCylinderView !== undefined) {
      state.comparisonSingleCylinderView = decodedB.singleCylinderView;
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
