import { create } from "zustand";
import { DEFAULT_ANIMATION, DEFAULT_CONFIG } from "../engine/constants";
import type {
  CrankMechanismConfig,
  DisplayUnit,
  UserPreferences,
} from "../engine/types";

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
  preferences: UserPreferences;
  rpm: number;
  isPlaying: boolean;
  crankAngleRad: number;

  setConfig: (partial: Partial<CrankMechanismConfig>) => void;
  setDisplayUnit: (unit: DisplayUnit) => void;
  setShowLabels: (show: boolean) => void;
  setRpm: (rpm: number) => void;
  play: () => void;
  pause: () => void;
  /** Sets the crank angle directly and pauses playback (scrubbing rule §11.1). */
  scrubTo: (angleRad: number) => void;
  /** Throttled mirror from the animation loop; must not pause or resume. */
  syncCrankAngle: (angleRad: number) => void;
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
  preferences: { displayUnit: "mm", showLabels: true },
  rpm: DEFAULT_ANIMATION.rpm,
  isPlaying: initialIsPlaying(),
  crankAngleRad: DEFAULT_ANIMATION.crankAngleRad,

  setConfig: (partial) =>
    set((state) => ({ config: { ...state.config, ...partial } })),
  setDisplayUnit: (unit) =>
    set((state) => ({
      preferences: { ...state.preferences, displayUnit: unit },
    })),
  setShowLabels: (show) =>
    set((state) => ({
      preferences: { ...state.preferences, showLabels: show },
    })),
  setRpm: (rpm) => set({ rpm }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  scrubTo: (angleRad) => set({ isPlaying: false, crankAngleRad: angleRad }),
  syncCrankAngle: (angleRad) => set({ crankAngleRad: angleRad }),
}));
