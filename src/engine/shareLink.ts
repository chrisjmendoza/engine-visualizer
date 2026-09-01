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
 * | `fam`    | Engine A's family (§27): `r` rotary, `p` piston  | piston (the default) |
 * | `bfam`   | Engine B's family                                | piston, or not comparing |
 * | `ra`     | Engine A's rotary config: a preset id, or `R-e-b-cr-redline` | engine A's family is piston |
 * | `rb`     | Engine B's rotary config                         | engine B's family is piston, or not comparing |
 * | `rn`     | Engine A's rotor count (1, 2, or 3)              | engine A's family is piston, or matches what `ra` implies |
 * | `brn`    | Engine B's rotor count                           | engine B's family is piston, or matches what `rb` implies, or not comparing |
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
 *
 * ## `fam`/`ra`/`rn` — the rotary family (§27)
 *
 * Rotary is a second engine family, not a fourteenth layout (its config
 * shares nothing with `CrankMechanismConfig` beyond compression ratio and
 * redline), so it gets its own trio of params per engine rather than folding
 * into `a`/`l`/`c`. `fam`/`bfam` name the family; `ra`/`rb` carry that
 * family's geometry in the same "preset id, or hyphenated numbers" form `a`/
 * `b` use (here: `generatingRadius-eccentricity-rotorWidth-compressionRatio-
 * redline`); `rn`/`brn` carry the rotor count, omitted when it matches what
 * `ra`/`rb` implies — a matching preset's own rotor count, or `1` for a
 * numeric (non-preset) rotary config, the same "the config's own preset, else
 * a documented default" inference `l` uses for layouts (`defaultLayoutIdFor`;
 * see `defaultRotaryRotorCountFor` here).
 *
 * `a`/`config` and `b`/`comparisonConfig` are unaffected by any of this and
 * keep meaning exactly what they always have: parallel store fields (§27),
 * not a discriminated union, so a slot's piston geometry is never discarded
 * just because that slot is currently showing rotary — it is only not shown.
 * A legacy link with no `fam`/`bfam` therefore still opens exactly as it
 * always did, on the piston family, because that is what a fresh session
 * already defaults to before hydration runs.
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
import { ROTARY_ENGINE_PRESETS } from "./rotaryPresets";
import type { RotaryEnginePreset } from "./rotaryPresets";
import { isRotaryRotorCount, validateRotaryConfig } from "./rotaryValidation";
import type { RotaryConfig, RotaryRotorCount } from "./rotaryTypes";
import type { CrankMechanismConfig, DisplayUnit } from "./types";
import { validateConfig } from "./validation";

/**
 * Which engine family a slot shows (TECHNICAL_DESIGN.md §27's architecture
 * note): parallel store fields, not a discriminated union, so this is its own
 * small type rather than something the piston `types.ts` or the rotary
 * `rotaryTypes.ts` would need to know about each other to share. Defined here
 * (rather than in either engine-family's own type module) because this is the
 * one module both `engineStore.ts` and every family's share-link encoding
 * already have to agree on.
 */
export type EngineFamily = "piston" | "rotary";

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
  /** Which family engine A shows (§27). */
  engineFamily: EngineFamily;
  /** Which family engine B shows; only meaningful while `comparisonConfig` is set. */
  comparisonEngineFamily: EngineFamily;
  /** Engine A's rotary geometry, carried regardless of `engineFamily` (§27's parallel-fields design). */
  rotaryConfig: RotaryConfig;
  /** Engine B's rotary geometry. */
  comparisonRotaryConfig: RotaryConfig;
  /** Engine A's rotor count. */
  rotaryRotorCount: RotaryRotorCount;
  /** Engine B's rotor count. */
  comparisonRotaryRotorCount: RotaryRotorCount;
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

function rotaryConfigsEqual(a: RotaryConfig, b: RotaryConfig): boolean {
  return (
    a.generatingRadiusMm === b.generatingRadiusMm &&
    a.eccentricityMm === b.eccentricityMm &&
    a.rotorWidthMm === b.rotorWidthMm &&
    a.compressionRatio === b.compressionRatio &&
    a.redlineRpm === b.redlineRpm
  );
}

/** The rotary preset (if any) whose geometry exactly matches `config` — the rotary `presetForConfig`. */
function rotaryPresetForConfig(
  config: RotaryConfig,
): RotaryEnginePreset | undefined {
  return ROTARY_ENGINE_PRESETS.find((entry) =>
    rotaryConfigsEqual(entry.config, config),
  );
}

/**
 * The rotor count a link implies for `config` when it carries no explicit
 * `rn`/`brn`: a matching preset's own rotor count, or `1` for a numeric
 * (non-preset) rotary config — the rotary analog of `defaultLayoutIdFor`.
 * The fallback is `1` rather than the store's own default rotor count
 * (`DEFAULT_ROTARY_ROTOR_COUNT`, 2): a bare numeric `ra` describes geometry
 * alone, and the simplest architecture that geometry could mean is a single
 * rotor, exactly as a bare numeric `a` implies `DEFAULT_LAYOUT_ID` rather
 * than "whatever architecture happens to be showing" (§27).
 */
export function defaultRotaryRotorCountFor(
  config: RotaryConfig,
): RotaryRotorCount {
  return rotaryPresetForConfig(config)?.rotorCount ?? 1;
}

/** Encodes one rotary config as a preset id when possible, else as five numbers. */
export function encodeRotaryConfig(config: RotaryConfig): string {
  const preset = rotaryPresetForConfig(config);
  if (preset) {
    return preset.id;
  }
  return [
    config.generatingRadiusMm,
    config.eccentricityMm,
    config.rotorWidthMm,
    config.compressionRatio,
    config.redlineRpm,
  ]
    .map(formatNumber)
    .join(CONFIG_SEPARATOR);
}

/** Decodes one rotary config, returning null for anything unusable — the rotary `decodeConfig`. */
export function decodeRotaryConfig(raw: string): RotaryConfig | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }

  // Rotary preset ids contain letters, exactly like the piston roster's;
  // numeric configs never do.
  if (/[a-z]/i.test(trimmed)) {
    const preset = ROTARY_ENGINE_PRESETS.find((entry) => entry.id === trimmed);
    return preset ? preset.config : null;
  }

  const parts = trimmed.split(CONFIG_SEPARATOR);
  if (parts.length !== 5) {
    return null;
  }
  const [generatingRadius, eccentricity, rotorWidth, ratio, redline] =
    parts.map(Number);
  const result = validateRotaryConfig({
    generatingRadiusMm: generatingRadius,
    eccentricityMm: eccentricity,
    rotorWidthMm: rotorWidth,
    compressionRatio: ratio,
    redlineRpm: redline,
  });
  return result.ok ? result.config : null;
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
 * Writes one engine's family, rotary geometry, and rotor count (§27), each
 * omitted when it does not apply or agrees with what the rest of the link
 * implies. Shared by engines A (`fam`/`ra`/`rn`) and B (`bfam`/`rb`/`brn`).
 *
 * Piston is the default family, so a piston slot writes nothing here at
 * all — not even a stray `ra` for geometry nobody is looking at — exactly
 * as the param table promises. Only once a slot is rotary does its geometry
 * and (non-implied) rotor count travel.
 */
function writeFamilyParams(
  params: URLSearchParams,
  familyKey: string,
  rotaryKey: string,
  rotorKey: string,
  family: EngineFamily,
  rotaryConfig: RotaryConfig,
  rotorCount: RotaryRotorCount,
): void {
  if (family !== "rotary") {
    return;
  }
  params.set(familyKey, "r");
  params.set(rotaryKey, encodeRotaryConfig(rotaryConfig));
  const impliedRotorCount = defaultRotaryRotorCountFor(rotaryConfig);
  if (rotorCount !== impliedRotorCount) {
    params.set(rotorKey, String(rotorCount));
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
  // Family/rotary-geometry/rotor-count params (§27): engine A's always
  // apply (a slot always has a family); engine B's only mean anything once
  // engine B itself is in the link, same reasoning as `bl` above.
  writeFamilyParams(
    params,
    "fam",
    "ra",
    "rn",
    state.engineFamily,
    state.rotaryConfig,
    state.rotaryRotorCount,
  );
  if (state.comparisonConfig) {
    writeFamilyParams(
      params,
      "bfam",
      "rb",
      "brn",
      state.comparisonEngineFamily,
      state.comparisonRotaryConfig,
      state.comparisonRotaryRotorCount,
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

/** Reads a `fam`/`bfam` value: `"r"` rotary, `"p"` piston, else null. */
function parseFamilyParam(raw: string | null): EngineFamily | null {
  if (raw === "r") {
    return "rotary";
  }
  if (raw === "p") {
    return "piston";
  }
  return null;
}

/**
 * Reads one engine's family, rotary geometry, and rotor count back out of a
 * link (§27) — the inverse of `writeFamilyParams`.
 *
 * `ra`/`rn` (or `rb`/`brn`) are only consulted once their own `fam`/`bfam`
 * actually says "rotary" for *this* link: a link that names no family, or
 * explicitly names piston, says nothing about rotary geometry even if a
 * stray `ra` is present (a malformed or hand-edited link), so the current
 * session's rotary geometry is left standing rather than silently swapped in
 * for a family that isn't even showing. An absent `rn` defaults to whatever
 * `ra` implies (`defaultRotaryRotorCountFor`), the same "config, then implied
 * default" order `readLayoutParams` uses for `l`/`sv`.
 */
function readFamilyParams(
  familyParam: string | null,
  rotaryParam: string | null,
  rotorParam: string | null,
): {
  engineFamily?: EngineFamily;
  rotaryConfig?: RotaryConfig;
  rotaryRotorCount?: RotaryRotorCount;
} {
  const result: {
    engineFamily?: EngineFamily;
    rotaryConfig?: RotaryConfig;
    rotaryRotorCount?: RotaryRotorCount;
  } = {};

  const family = parseFamilyParam(familyParam);
  if (family !== null) {
    result.engineFamily = family;
  }
  if (family !== "rotary") {
    return result;
  }

  if (rotaryParam !== null) {
    const config = decodeRotaryConfig(rotaryParam);
    if (config) {
      result.rotaryConfig = config;
    }
  }

  // The rotor count is NOT gated on the geometry param: engine A's slot
  // always exists, so a valid explicit count applies on its own — the
  // `bl`-style "only alongside a decoded engine" guard is about engine B
  // not existing, and has no analog here. An explicit count wins; a link
  // that carried geometry but no count gets the count that geometry
  // implies (its preset's, else the single-rotor default); a link with
  // neither leaves the current session's count untouched.
  const rawRotorCount = rotorParam !== null ? Number(rotorParam) : NaN;
  if (isRotaryRotorCount(rawRotorCount)) {
    result.rotaryRotorCount = rawRotorCount;
  } else if (result.rotaryConfig) {
    result.rotaryRotorCount = defaultRotaryRotorCountFor(result.rotaryConfig);
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

  // Family/rotary-geometry/rotor-count params (§27): engine A's are read
  // unconditionally (a slot's family is meaningful with or without engine
  // B); engine B's only apply alongside a successfully decoded `b`, same
  // guard as `bl`/`bsv` above, so a stray `bfam`/`rb`/`brn` can never leave
  // a future comparison silently pre-configured with no engine B to show.
  const familyA = readFamilyParams(
    params.get("fam"),
    params.get("ra"),
    params.get("rn"),
  );
  if (familyA.engineFamily !== undefined) {
    state.engineFamily = familyA.engineFamily;
  }
  if (familyA.rotaryConfig !== undefined) {
    state.rotaryConfig = familyA.rotaryConfig;
  }
  if (familyA.rotaryRotorCount !== undefined) {
    state.rotaryRotorCount = familyA.rotaryRotorCount;
  }

  if (state.comparisonConfig) {
    const familyB = readFamilyParams(
      params.get("bfam"),
      params.get("rb"),
      params.get("brn"),
    );
    if (familyB.engineFamily !== undefined) {
      state.comparisonEngineFamily = familyB.engineFamily;
    }
    if (familyB.rotaryConfig !== undefined) {
      state.comparisonRotaryConfig = familyB.rotaryConfig;
    }
    if (familyB.rotaryRotorCount !== undefined) {
      state.comparisonRotaryRotorCount = familyB.rotaryRotorCount;
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
