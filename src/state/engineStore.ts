import { create } from "zustand";
import {
  DEFAULT_ANIMATION,
  DEFAULT_CONFIG,
  DEFAULT_PLAYBACK_SPEED,
} from "../engine/constants";
import type { PlaybackSpeed } from "../engine/constants";
import type {
  CrankMechanismConfig,
  DisplayUnit,
  UserPreferences,
} from "../engine/types";
import { DEFAULT_LAYOUT_ID } from "../engine/engineLayout";
import type { EngineLayoutId } from "../engine/engineLayout";
import type { EngineFamily, PartialShareState } from "../engine/shareLink";
import {
  DEFAULT_ROTARY_CONFIG,
  DEFAULT_ROTARY_ROTOR_COUNT,
} from "../engine/rotaryConstants";
import type { RotaryConfig, RotaryRotorCount } from "../engine/rotaryTypes";

/**
 * Global application store.
 *
 * `crankAngleRad` is authoritative while paused or scrubbing. While playing,
 * the animation loop owns the live angle in a local ref and mirrors it here
 * at a throttled rate (READOUT_SYNC_HZ) via `syncCrankAngle`, so the React
 * tree never rerenders per frame. Scene components read the live angle from
 * the loop, not from this store.
 */
interface EngineStore {
  config: CrankMechanismConfig;
  /**
   * Engine B for side-by-side comparison, or null when comparison is off.
   * Both engines share rpm, playback state, and crank angle, so visible
   * differences are purely geometric.
   */
  comparisonConfig: CrankMechanismConfig | null;
  /**
   * Engine A's layout (§24a) — a layout id, not a cylinder count, since a
   * count cannot tell a V8 from an inline-8. This is geometry, like
   * `config`, so changing it must never touch `crankAngleRad` or playback
   * (§11.1's geometry-change rule).
   */
  layoutId: EngineLayoutId;
  /**
   * Engine B's layout. `enableComparison` seeds it from engine A's current
   * `layoutId` (same pattern as `comparisonRpm`), so turning on comparison
   * shows two copies of the same layout before the user diverges them.
   * `disableComparison` leaves it alone, again like `comparisonRpm`, so
   * re-enabling comparison later re-seeds from A rather than restoring a
   * stale value.
   */
  comparisonLayoutId: EngineLayoutId;
  /**
   * Engine A's view (§24a): when true — the default, and how the app has
   * always opened — only cylinder 0 of `layoutId` is drawn and counted, so
   * one cylinder can be studied without forgetting which engine it belongs
   * to. This is a *view* preference, not an architecture: `layoutId` is
   * untouched by it, and so are the phases and bank tilt of the cylinder that
   * remains. It lives here beside `layoutId` rather than in `preferences`
   * because it is per-engine, exactly like the layout it filters.
   *
   * Like every other geometry/layout field it must never reset the crank
   * angle or playback (§11.1).
   */
  singleCylinderView: boolean;
  /**
   * Engine B's view. `enableComparison` seeds it from engine A's, alongside
   * `comparisonRpm` and `comparisonLayoutId`, so a comparison starts as two
   * copies of what engine A is showing.
   */
  comparisonSingleCylinderView: boolean;
  preferences: UserPreferences;
  rpm: number;
  /**
   * Engine B's speed, used only while `rpmLinked` is false. `enableComparison`
   * seeds it from engine A's current `rpm`, so the very first unlink starts
   * both engines at the shared speed instead of snapping engine B back to
   * the pristine default. Past that seed, keeping it in state even while
   * linked means unlinking restores whatever the user last chose for engine
   * B rather than re-snapping to engine A's value — `setRpmLinked` never
   * writes to it.
   */
  comparisonRpm: number;
  /**
   * When true (the default), engine B runs at engine A's `rpm` and shares
   * its crank angle exactly. When false, each engine advances at its own
   * speed — the point being to watch two redlines side by side — so their
   * crank angles drift apart and `comparisonCrankAngleRad` becomes live.
   */
  rpmLinked: boolean;
  /** Visual time scale for rendered motion only; readouts use true rpm. */
  playbackSpeed: PlaybackSpeed;
  isPlaying: boolean;
  crankAngleRad: number;
  /**
   * Engine B's crank angle. Equal to `crankAngleRad` while linked; once
   * unlinked the animation loop advances and mirrors it independently.
   */
  comparisonCrankAngleRad: number;
  /**
   * Which whole shaft revolution of engine A's cycle is current, counted mod
   * 6 (`CrankRevolutionIndex` in `src/scene/useMechanismAnimation.ts`, where
   * the counter lives and where the reason for 6 is set out).
   *
   * One counter serves both engine families: a piston engine reads `% 2` to
   * get the four-stroke revolution parity it used to keep here directly
   * (`src/engine/cycle.ts`), and a rotary reads `% 3` to get which of the
   * three eccentric-shaft revolutions of its 1080° face cycle is current
   * (`src/engine/rotaryCycle.ts`). Both derivations are exact, because 6 is
   * lcm(2, 3).
   *
   * Typed as a literal union here rather than imported from the scene layer:
   * the store must not depend on `src/scene/`, and the two declarations are
   * kept honest by the sync actions below, which only ever receive a value
   * the loop produced.
   *
   * Like `crankAngleRad`, this is authoritative while paused or scrubbing;
   * while playing, the animation loop owns it in the same ref as the live
   * angle and mirrors it here only at the throttled READOUT_SYNC_HZ cadence,
   * never per frame. Scrubbing (§11.1) deliberately never resets it: the
   * scrub slider is 0–360° and cannot express which revolution of a
   * multi-revolution cycle the shaft is on, so whatever was last playing is
   * what resumes.
   */
  crankRevolutionIndex: 0 | 1 | 2 | 3 | 4 | 5;
  /**
   * Engine B's revolution index. Equal to `crankRevolutionIndex` while
   * rpm-linked; once unlinked the animation loop advances and mirrors it
   * independently, exactly like `comparisonCrankAngleRad`.
   */
  comparisonCrankRevolutionIndex: 0 | 1 | 2 | 3 | 4 | 5;
  /**
   * Which engine family slot A shows (TECHNICAL_DESIGN.md §27): `"piston"`
   * (the default, `config`/`layoutId`/...) or `"rotary"` (`rotaryConfig`/
   * `rotaryRotorCount`). A second parallel set of fields, not a discriminated
   * union — every existing piston field stays exactly as it was, untouched by
   * a family switch, so a consumer that doesn't yet know about rotary keeps
   * working unmodified. Switching family is a geometry-class change (§11.1):
   * it must never reset `crankAngleRad` or playback, exactly like
   * `setLayoutId`. The store's `crankAngleRad` keeps meaning the ECCENTRIC-
   * SHAFT angle for a rotary slot — same field, same rpm semantics, same
   * scrub slider — because a rotary tachometer reads shaft rpm too; only the
   * scene's interpretation of that angle differs per family.
   */
  engineFamily: EngineFamily;
  /**
   * Engine B's family. `enableComparison` seeds it from engine A's current
   * `engineFamily`, alongside `comparisonLayoutId` and `comparisonRpm`, so a
   * comparison starts as two copies of what engine A is currently showing.
   * `disableComparison` leaves it alone, so a later re-enable re-seeds from
   * engine A's family at that time rather than restoring a stale value.
   */
  comparisonEngineFamily: EngineFamily;
  /**
   * Engine A's rotary geometry (R, e, rotor width, compression ratio,
   * redline). Carried regardless of `engineFamily` — exactly like `config`,
   * which is likewise kept even while a slot shows rotary — so switching a
   * slot's family back and forth never loses whichever geometry isn't
   * currently on screen.
   */
  rotaryConfig: RotaryConfig;
  /** Engine B's rotary geometry; seeded from `rotaryConfig` by `enableComparison`. */
  comparisonRotaryConfig: RotaryConfig;
  /** Engine A's rotor count (1, 2, or 3) — the rotary's architecture, alongside `rotaryConfig`. */
  rotaryRotorCount: RotaryRotorCount;
  /** Engine B's rotor count; seeded from `rotaryRotorCount` by `enableComparison`. */
  comparisonRotaryRotorCount: RotaryRotorCount;

  setConfig: (partial: Partial<CrankMechanismConfig>) => void;
  /**
   * Turns comparison on, seeding engine B's config (defaults to a copy of
   * engine A's), its speed (`comparisonRpm`), and its layout
   * (`comparisonLayoutId`) — all from engine A's current values, see
   * each field's doc comment.
   */
  enableComparison: (initial?: CrankMechanismConfig) => void;
  disableComparison: () => void;
  /** No-op while comparison is off. */
  setComparisonConfig: (partial: Partial<CrankMechanismConfig>) => void;
  /** Geometry change (§11.1): never resets crank angle or playback. */
  setLayoutId: (id: EngineLayoutId) => void;
  /** Geometry change (§11.1): never resets crank angle or playback. */
  setComparisonLayoutId: (id: EngineLayoutId) => void;
  /**
   * View change: shows one cylinder or the whole engine. Never touches
   * `layoutId` — the architecture and how much of it is on screen are
   * independent — and, like a geometry change, never resets crank angle or
   * playback.
   */
  setSingleCylinderView: (single: boolean) => void;
  /** Engine B's equivalent; no-op-safe while comparison is off. */
  setComparisonSingleCylinderView: (single: boolean) => void;
  /**
   * Family change (§27, §11.1): switches engine A between piston and
   * rotary. A geometry-class change like `setLayoutId` — it never resets
   * `crankAngleRad` or playback, and it never touches the piston or rotary
   * config fields themselves, so the geometry each family last had is
   * exactly what reappears when you switch back.
   */
  setEngineFamily: (family: EngineFamily) => void;
  /** Engine B's equivalent. */
  setComparisonEngineFamily: (family: EngineFamily) => void;
  /** Geometry change (§11.1): never resets crank angle or playback. */
  setRotaryConfig: (partial: Partial<RotaryConfig>) => void;
  /** Engine B's equivalent. */
  setComparisonRotaryConfig: (partial: Partial<RotaryConfig>) => void;
  /** Architecture change (§11.1), the rotary analog of `setLayoutId`: never resets crank angle or playback. */
  setRotaryRotorCount: (count: RotaryRotorCount) => void;
  /** Engine B's equivalent. */
  setComparisonRotaryRotorCount: (count: RotaryRotorCount) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setDisplayUnit: (unit: DisplayUnit) => void;
  setShowLabels: (show: boolean) => void;
  /**
   * "Four-stroke cycle" preference (`src/engine/cycle.ts`'s pedagogical
   * overlay): gates the stroke badge. Session-local, like `showLabels` was
   * before it — deliberately not wired into the share link tonight, since a
   * shared link is about geometry and speed, not which optional readout the
   * recipient happens to have open.
   */
  setShowCycle: (show: boolean) => void;
  /**
   * "Stand flat engines upright" preference (§24a): in the full-engine view
   * only, flat/boxer layouts are drawn rotated a further +90° so their pistons
   * move vertically like every other engine's, while the opposed pair stays
   * opposed. Purely presentational — it never touches `layoutId`, the layout's
   * real bank offsets, or any kinematics — and, like `showLabels` and
   * `showCycle`, session-local rather than carried by a share link.
   */
  setUprightFlatEngines: (upright: boolean) => void;
  setRpm: (rpm: number) => void;
  setComparisonRpm: (rpm: number) => void;
  /**
   * Linking re-synchronizes engine B onto engine A's angle (and revolution
   * index) immediately, so the two mechanisms never sit visibly out of
   * phase while claiming to share a speed.
   */
  setRpmLinked: (linked: boolean) => void;
  play: () => void;
  pause: () => void;
  /**
   * Sets the crank angle directly and pauses playback (scrubbing rule
   * §11.1). Both engines are phase-locked to the scrubbed angle, even when
   * unlinked; resuming lets them diverge again at their own speeds.
   */
  scrubTo: (angleRad: number) => void;
  /** Throttled mirror from the animation loop; must not pause or resume. */
  syncCrankAngle: (angleRad: number) => void;
  /** Throttled mirror of engine B's angle; only meaningful while unlinked. */
  syncComparisonCrankAngle: (angleRad: number) => void;
  /** Throttled mirror of engine A's revolution index, alongside the angle. */
  syncCrankRevolutionIndex: (index: 0 | 1 | 2 | 3 | 4 | 5) => void;
  /**
   * Throttled mirror of engine B's revolution index; only meaningful
   * while unlinked, exactly like `syncComparisonCrankAngle`.
   */
  syncComparisonCrankRevolutionIndex: (index: 0 | 1 | 2 | 3 | 4 | 5) => void;
  /**
   * Applies a decoded share link (`decodeShareState`) to the store. Every
   * field is optional and independent: whatever the link carried is
   * applied, whatever it didn't keeps its current value — most notably,
   * `comparisonConfig` is only touched (turning comparison mode on) when
   * the link actually included engine B, and `isPlaying` is only touched
   * when the link included a crank angle (a link with no angle must not
   * override the reduced-motion default's initial paused state).
   */
  hydrateFromShareState: (partial: PartialShareState) => void;
}

/** Reduced-motion users get a paused initial state (§14). */
function initialIsPlaying(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return DEFAULT_ANIMATION.isPlaying;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? false
    : DEFAULT_ANIMATION.isPlaying;
}

export const useEngineStore = create<EngineStore>((set) => ({
  config: DEFAULT_CONFIG,
  comparisonConfig: null,
  layoutId: DEFAULT_LAYOUT_ID,
  comparisonLayoutId: DEFAULT_LAYOUT_ID,
  singleCylinderView: true,
  comparisonSingleCylinderView: true,
  preferences: {
    displayUnit: "mm",
    showLabels: true,
    showCycle: false,
    uprightFlatEngines: false,
  },
  rpm: DEFAULT_ANIMATION.rpm,
  comparisonRpm: DEFAULT_ANIMATION.rpm,
  rpmLinked: true,
  playbackSpeed: DEFAULT_PLAYBACK_SPEED,
  isPlaying: initialIsPlaying(),
  crankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
  comparisonCrankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
  crankRevolutionIndex: 0,
  comparisonCrankRevolutionIndex: 0,
  engineFamily: "piston",
  comparisonEngineFamily: "piston",
  rotaryConfig: DEFAULT_ROTARY_CONFIG,
  comparisonRotaryConfig: DEFAULT_ROTARY_CONFIG,
  rotaryRotorCount: DEFAULT_ROTARY_ROTOR_COUNT,
  comparisonRotaryRotorCount: DEFAULT_ROTARY_ROTOR_COUNT,

  setConfig: (partial) =>
    set((state) => ({ config: { ...state.config, ...partial } })),
  enableComparison: (initial) =>
    set((state) => ({
      comparisonConfig: initial ?? { ...state.config },
      // Seed engine B's speed from engine A's current rpm so the first-ever
      // unlink starts both engines at the shared speed rather than snapping
      // engine B to the pristine default (DEFAULT_ANIMATION.rpm). A later
      // re-enable re-seeds from whatever engine A is running at then.
      comparisonRpm: state.rpm,
      // Same reasoning for the layout: comparison starts as two copies of
      // engine A's layout, not a snap back to a pristine default.
      comparisonLayoutId: state.layoutId,
      // ...and for how much of it is on screen, so turning comparison on
      // while studying one cylinder gives you two single cylinders, not one
      // cylinder beside a whole engine.
      comparisonSingleCylinderView: state.singleCylinderView,
      // §27: comparison starts as two copies of engine A's family and rotary
      // geometry too, same reasoning as the piston fields above — a fresh
      // comparison shows the same engine twice, whichever family that is.
      comparisonEngineFamily: state.engineFamily,
      comparisonRotaryConfig: state.rotaryConfig,
      comparisonRotaryRotorCount: state.rotaryRotorCount,
    })),
  disableComparison: () => set({ comparisonConfig: null }),
  setComparisonConfig: (partial) =>
    set((state) =>
      state.comparisonConfig
        ? { comparisonConfig: { ...state.comparisonConfig, ...partial } }
        : {},
    ),
  setLayoutId: (id) => set({ layoutId: id }),
  setComparisonLayoutId: (id) => set({ comparisonLayoutId: id }),
  setSingleCylinderView: (single) => set({ singleCylinderView: single }),
  setComparisonSingleCylinderView: (single) =>
    set({ comparisonSingleCylinderView: single }),
  setEngineFamily: (family) => set({ engineFamily: family }),
  setComparisonEngineFamily: (family) =>
    set({ comparisonEngineFamily: family }),
  setRotaryConfig: (partial) =>
    set((state) => ({ rotaryConfig: { ...state.rotaryConfig, ...partial } })),
  setComparisonRotaryConfig: (partial) =>
    set((state) => ({
      comparisonRotaryConfig: { ...state.comparisonRotaryConfig, ...partial },
    })),
  setRotaryRotorCount: (count) => set({ rotaryRotorCount: count }),
  setComparisonRotaryRotorCount: (count) =>
    set({ comparisonRotaryRotorCount: count }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setDisplayUnit: (unit) =>
    set((state) => ({
      preferences: { ...state.preferences, displayUnit: unit },
    })),
  setShowLabels: (show) =>
    set((state) => ({
      preferences: { ...state.preferences, showLabels: show },
    })),
  setShowCycle: (show) =>
    set((state) => ({
      preferences: { ...state.preferences, showCycle: show },
    })),
  setUprightFlatEngines: (upright) =>
    set((state) => ({
      preferences: { ...state.preferences, uprightFlatEngines: upright },
    })),
  setRpm: (rpm) => set({ rpm }),
  setComparisonRpm: (comparisonRpm) => set({ comparisonRpm }),
  setRpmLinked: (rpmLinked) =>
    set((state) =>
      rpmLinked
        ? {
            rpmLinked,
            comparisonCrankAngleRad: state.crankAngleRad,
            comparisonCrankRevolutionIndex: state.crankRevolutionIndex,
          }
        : { rpmLinked },
    ),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  scrubTo: (angleRad) =>
    set({
      isPlaying: false,
      crankAngleRad: angleRad,
      comparisonCrankAngleRad: angleRad,
    }),
  syncCrankAngle: (angleRad) => set({ crankAngleRad: angleRad }),
  syncComparisonCrankAngle: (angleRad) =>
    set({ comparisonCrankAngleRad: angleRad }),
  syncCrankRevolutionIndex: (index) => set({ crankRevolutionIndex: index }),
  syncComparisonCrankRevolutionIndex: (index) =>
    set({ comparisonCrankRevolutionIndex: index }),
  hydrateFromShareState: (partial) =>
    set((state) => ({
      config: partial.config ?? state.config,
      // `??` (not `||`): a link can legitimately carry `comparisonConfig`
      // as any valid config object, but decodeShareState only ever puts a
      // real config or nothing (never `null`) into a decoded partial, so
      // "absent" is the only falsy-ish case to guard against here.
      comparisonConfig: partial.comparisonConfig ?? state.comparisonConfig,
      // Same `??` pattern as every other field here: a link either carried
      // a known layout id (decodeShareState already dropped anything else)
      // or it carried nothing, in which case the current value stands.
      layoutId: partial.layoutId ?? state.layoutId,
      comparisonLayoutId:
        partial.comparisonLayoutId ?? state.comparisonLayoutId,
      // Same `??` pattern again: a link either said which cylinders to show
      // (explicitly via `sv`, or by implication from `l`/`c`) or said nothing,
      // in which case the current view stands.
      singleCylinderView:
        partial.singleCylinderView ?? state.singleCylinderView,
      // §27: same `??` pattern once more — a link either named a family
      // (`fam`/`bfam`) or it didn't, in which case the current family
      // stands (a legacy link with no family params therefore leaves a
      // fresh session on its default, piston). Rotary geometry and rotor
      // count follow the same rule, independent of which family is actually
      // showing right now — they are carried, not gated, exactly like
      // `config`/`comparisonConfig` above.
      engineFamily: partial.engineFamily ?? state.engineFamily,
      comparisonEngineFamily:
        partial.comparisonEngineFamily ?? state.comparisonEngineFamily,
      rotaryConfig: partial.rotaryConfig ?? state.rotaryConfig,
      comparisonRotaryConfig:
        partial.comparisonRotaryConfig ?? state.comparisonRotaryConfig,
      rotaryRotorCount: partial.rotaryRotorCount ?? state.rotaryRotorCount,
      comparisonRotaryRotorCount:
        partial.comparisonRotaryRotorCount ?? state.comparisonRotaryRotorCount,
      comparisonSingleCylinderView:
        partial.comparisonSingleCylinderView ??
        state.comparisonSingleCylinderView,
      preferences:
        partial.displayUnit !== undefined
          ? { ...state.preferences, displayUnit: partial.displayUnit }
          : state.preferences,
      rpm: partial.rpm ?? state.rpm,
      // `rpmLinked` only ever arrives as `false` (decodeShareState sets it
      // when the link carried engine B's speed), so an absent value leaves
      // the current linking untouched rather than forcing it back on.
      comparisonRpm: partial.comparisonRpm ?? state.comparisonRpm,
      rpmLinked: partial.rpmLinked ?? state.rpmLinked,
      playbackSpeed: partial.playbackSpeed ?? state.playbackSpeed,
      crankAngleRad: partial.crankAngleRad ?? state.crankAngleRad,
      // While linked the two angles are the same by definition, so a link
      // carrying only engine A's angle must move engine B's with it.
      comparisonCrankAngleRad:
        partial.comparisonCrankAngleRad ??
        (partial.rpmLinked === false
          ? state.comparisonCrankAngleRad
          : (partial.crankAngleRad ?? state.comparisonCrankAngleRad)),
      // `??` preserves an explicit `false` (set together with a decoded
      // angle) while leaving `isPlaying` untouched when the link had no
      // angle at all — see the reduced-motion note on this method above.
      isPlaying: partial.isPlaying ?? state.isPlaying,
    })),
}));
