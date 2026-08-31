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
import type { PartialShareState } from "../engine/shareLink";

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
  preferences: UserPreferences;
  rpm: number;
  /**
   * Engine B's speed, used only while `rpmLinked` is false. Keeping it in
   * state even when linked means unlinking restores whatever the user last
   * chose rather than snapping to engine A's value.
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

  setConfig: (partial: Partial<CrankMechanismConfig>) => void;
  /** Turns comparison on, seeding engine B (defaults to a copy of engine A). */
  enableComparison: (initial?: CrankMechanismConfig) => void;
  disableComparison: () => void;
  /** No-op while comparison is off. */
  setComparisonConfig: (partial: Partial<CrankMechanismConfig>) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setDisplayUnit: (unit: DisplayUnit) => void;
  setShowLabels: (show: boolean) => void;
  setRpm: (rpm: number) => void;
  setComparisonRpm: (rpm: number) => void;
  /**
   * Linking re-synchronizes engine B onto engine A's angle immediately, so
   * the two mechanisms never sit visibly out of phase while claiming to
   * share a speed.
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
  preferences: { displayUnit: "mm", showLabels: true },
  rpm: DEFAULT_ANIMATION.rpm,
  comparisonRpm: DEFAULT_ANIMATION.rpm,
  rpmLinked: true,
  playbackSpeed: DEFAULT_PLAYBACK_SPEED,
  isPlaying: initialIsPlaying(),
  crankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
  comparisonCrankAngleRad: DEFAULT_ANIMATION.crankAngleRad,

  setConfig: (partial) =>
    set((state) => ({ config: { ...state.config, ...partial } })),
  enableComparison: (initial) =>
    set((state) => ({
      comparisonConfig: initial ?? { ...state.config },
    })),
  disableComparison: () => set({ comparisonConfig: null }),
  setComparisonConfig: (partial) =>
    set((state) =>
      state.comparisonConfig
        ? { comparisonConfig: { ...state.comparisonConfig, ...partial } }
        : {},
    ),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setDisplayUnit: (unit) =>
    set((state) => ({
      preferences: { ...state.preferences, displayUnit: unit },
    })),
  setShowLabels: (show) =>
    set((state) => ({
      preferences: { ...state.preferences, showLabels: show },
    })),
  setRpm: (rpm) => set({ rpm }),
  setComparisonRpm: (comparisonRpm) => set({ comparisonRpm }),
  setRpmLinked: (rpmLinked) =>
    set((state) =>
      rpmLinked
        ? { rpmLinked, comparisonCrankAngleRad: state.crankAngleRad }
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
  hydrateFromShareState: (partial) =>
    set((state) => ({
      config: partial.config ?? state.config,
      // `??` (not `||`): a link can legitimately carry `comparisonConfig`
      // as any valid config object, but decodeShareState only ever puts a
      // real config or nothing (never `null`) into a decoded partial, so
      // "absent" is the only falsy-ish case to guard against here.
      comparisonConfig: partial.comparisonConfig ?? state.comparisonConfig,
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
