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
import type { SupportedCylinderCount } from "../engine/engineLayout";
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
  /**
   * Number of cylinders in engine A's layout (§24a). This is geometry, like
   * `config`, so changing it must never touch `crankAngleRad` or playback
   * (§11.1's geometry-change rule).
   */
  cylinderCount: SupportedCylinderCount;
  /**
   * Engine B's cylinder count. `enableComparison` seeds it from engine A's
   * current `cylinderCount` (same pattern as `comparisonRpm`), so turning on
   * comparison shows two copies of the same layout before the user diverges
   * them. `disableComparison` leaves it alone, again like `comparisonRpm`,
   * so re-enabling comparison later re-seeds from A rather than restoring a
   * stale value.
   */
  comparisonCylinderCount: SupportedCylinderCount;
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
   * Which of the two crank revolutions in engine A's 720° four-stroke cycle
   * is current (`src/engine/cycle.ts`'s pedagogical overlay): 0 for the first
   * revolution since the last cycle boundary, 1 for the second. Like
   * `crankAngleRad`, this is authoritative while paused or scrubbing; while
   * playing, the animation loop owns it in the same ref as the live angle
   * and mirrors it here only at the throttled READOUT_SYNC_HZ cadence, never
   * per frame. Scrubbing (§11.1) deliberately never resets it: the scrub
   * slider is 0–360° and cannot express which of the two revolutions the
   * crank is on, so whatever parity was last playing is what resumes.
   */
  crankRevolutionParity: 0 | 1;
  /**
   * Engine B's parity bit. Equal to `crankRevolutionParity` while
   * rpm-linked; once unlinked the animation loop advances and mirrors it
   * independently, exactly like `comparisonCrankAngleRad`.
   */
  comparisonCrankRevolutionParity: 0 | 1;

  setConfig: (partial: Partial<CrankMechanismConfig>) => void;
  /**
   * Turns comparison on, seeding engine B's config (defaults to a copy of
   * engine A's), its speed (`comparisonRpm`), and its cylinder count
   * (`comparisonCylinderCount`) — all from engine A's current values, see
   * each field's doc comment.
   */
  enableComparison: (initial?: CrankMechanismConfig) => void;
  disableComparison: () => void;
  /** No-op while comparison is off. */
  setComparisonConfig: (partial: Partial<CrankMechanismConfig>) => void;
  /** Geometry change (§11.1): never resets crank angle or playback. */
  setCylinderCount: (count: SupportedCylinderCount) => void;
  /** Geometry change (§11.1): never resets crank angle or playback. */
  setComparisonCylinderCount: (count: SupportedCylinderCount) => void;
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
  setRpm: (rpm: number) => void;
  setComparisonRpm: (rpm: number) => void;
  /**
   * Linking re-synchronizes engine B onto engine A's angle (and cycle
   * parity) immediately, so the two mechanisms never sit visibly out of
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
  /** Throttled mirror of engine A's revolution-parity bit, alongside the angle. */
  syncCrankRevolutionParity: (parity: 0 | 1) => void;
  /**
   * Throttled mirror of engine B's revolution-parity bit; only meaningful
   * while unlinked, exactly like `syncComparisonCrankAngle`.
   */
  syncComparisonCrankRevolutionParity: (parity: 0 | 1) => void;
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
  cylinderCount: 1,
  comparisonCylinderCount: 1,
  preferences: { displayUnit: "mm", showLabels: true, showCycle: false },
  rpm: DEFAULT_ANIMATION.rpm,
  comparisonRpm: DEFAULT_ANIMATION.rpm,
  rpmLinked: true,
  playbackSpeed: DEFAULT_PLAYBACK_SPEED,
  isPlaying: initialIsPlaying(),
  crankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
  comparisonCrankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
  crankRevolutionParity: 0,
  comparisonCrankRevolutionParity: 0,

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
      // Same reasoning for cylinder count: comparison starts as two copies
      // of engine A's layout, not a snap back to a pristine single cylinder.
      comparisonCylinderCount: state.cylinderCount,
    })),
  disableComparison: () => set({ comparisonConfig: null }),
  setComparisonConfig: (partial) =>
    set((state) =>
      state.comparisonConfig
        ? { comparisonConfig: { ...state.comparisonConfig, ...partial } }
        : {},
    ),
  setCylinderCount: (count) => set({ cylinderCount: count }),
  setComparisonCylinderCount: (count) =>
    set({ comparisonCylinderCount: count }),
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
  setRpm: (rpm) => set({ rpm }),
  setComparisonRpm: (comparisonRpm) => set({ comparisonRpm }),
  setRpmLinked: (rpmLinked) =>
    set((state) =>
      rpmLinked
        ? {
            rpmLinked,
            comparisonCrankAngleRad: state.crankAngleRad,
            comparisonCrankRevolutionParity: state.crankRevolutionParity,
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
  syncCrankRevolutionParity: (parity) => set({ crankRevolutionParity: parity }),
  syncComparisonCrankRevolutionParity: (parity) =>
    set({ comparisonCrankRevolutionParity: parity }),
  hydrateFromShareState: (partial) =>
    set((state) => ({
      config: partial.config ?? state.config,
      // `??` (not `||`): a link can legitimately carry `comparisonConfig`
      // as any valid config object, but decodeShareState only ever puts a
      // real config or nothing (never `null`) into a decoded partial, so
      // "absent" is the only falsy-ish case to guard against here.
      comparisonConfig: partial.comparisonConfig ?? state.comparisonConfig,
      // Same `??` pattern as every other field here: a link either carried
      // a valid, supported count (decodeShareState already dropped anything
      // else) or it carried nothing, in which case the current value stands.
      cylinderCount: partial.cylinderCount ?? state.cylinderCount,
      comparisonCylinderCount:
        partial.comparisonCylinderCount ?? state.comparisonCylinderCount,
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
