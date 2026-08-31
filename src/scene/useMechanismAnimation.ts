/**
 * The animation loop for the crank mechanism (TECHNICAL_DESIGN.md §11, §18).
 *
 * Rules enforced here:
 * - The live crank angle lives in a ref, not in React state, so no component
 *   rerenders per frame.
 * - Playback advances the angle by Δθ = Δt × RPM × playbackSpeed × 2π / 60,
 *   with Δt clamped so an inactive browser tab cannot make the mechanism jump.
 *   `playbackSpeed` scales rendered motion only: every calculated readout
 *   still uses the true RPM, because 600 RPM is ten revolutions per second
 *   and would simply strobe at 60 fps.
 * - While paused (or scrubbing) the store is authoritative and the ref simply
 *   follows it, so play resumes from the scrubbed angle.
 * - The store is written at most READOUT_SYNC_HZ times per second, purely to
 *   mirror the angle into the readouts; it is never written per frame.
 * - The loop hands out the live angles and a store snapshot. Mechanism geometry
 *   comes from `calculateMechanismState`; this module never reimplements
 *   slider-crank math.
 *
 * One loop drives every mechanism on screen. While `rpmLinked` is set, engine
 * B's angle is *assigned* from engine A's rather than integrated separately:
 * two independent integrations of the same speed would accumulate different
 * floating-point error and slowly pull apart two engines the user was told are
 * locked together. Once unlinked, each engine integrates its own speed, which
 * is the whole point — a 9,000 rpm engine visibly outrunning a 7,000 rpm one.
 */

import { useFrame } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { READOUT_SYNC_HZ, TWO_PI } from "../engine/constants";
import { useEngineStore } from "../state/engineStore";

/** Largest frame delta the loop will integrate, in seconds. */
export const MAX_FRAME_DELTA_S = 0.1;

/** Snapshot of the global store, as read transiently inside the loop. */
export type EngineStoreState = ReturnType<typeof useEngineStore.getState>;

/** The live crank angle of each engine, in radians. */
export interface FrameAngles {
  crankAngleRad: number;
  /** Engine B's angle; identical to engine A's whenever the speeds are linked. */
  comparisonCrankAngleRad: number;
}

/**
 * Called once per frame with the live angles and the store snapshot the loop
 * read. Implementations are expected to mutate Three.js objects.
 *
 * The `angles` object is reused between frames — read from it, never retain it.
 */
export type MechanismFrameCallback = (
  angles: FrameAngles,
  store: EngineStoreState,
) => void;

export interface MechanismAnimation {
  /** The live angles, owned by the loop while playing. */
  anglesRef: RefObject<FrameAngles>;
  /** Recomputes and reapplies every mechanism at the current live angles. */
  applyCurrent: () => void;
}

/**
 * Advances the crank angle by one frame.
 *
 * Pure, so the integration rule can be tested without a WebGL context: the
 * frame delta is clamped, motion is scaled by the visual playback speed, and
 * the result is wrapped into [0, 2π).
 */
export function advanceCrankAngle(
  crankAngleRad: number,
  deltaS: number,
  rpm: number,
  playbackSpeed: number,
): number {
  const dt = Math.min(deltaS, MAX_FRAME_DELTA_S);
  const delta = (dt * rpm * playbackSpeed * TWO_PI) / 60;
  return (crankAngleRad + delta) % TWO_PI;
}

/**
 * Advances both engines by one frame, in place.
 *
 * `angles` is both the input and the output, so the loop can keep a single
 * object alive across frames and allocate nothing (§11).
 *
 * When `rpmLinked` is set, engine B is assigned engine A's new angle rather
 * than integrated at the same speed. Integrating twice would be mathematically
 * equivalent but not numerically identical — the two sums would diverge in the
 * low bits and, over minutes of playback, visibly desynchronize engines that
 * are supposed to be locked. Assignment makes the equality exact and free.
 */
export function advanceEnginePair(
  angles: FrameAngles,
  deltaS: number,
  rpm: number,
  comparisonRpm: number,
  playbackSpeed: number,
  rpmLinked: boolean,
): void {
  angles.crankAngleRad = advanceCrankAngle(
    angles.crankAngleRad,
    deltaS,
    rpm,
    playbackSpeed,
  );
  angles.comparisonCrankAngleRad = rpmLinked
    ? angles.crankAngleRad
    : advanceCrankAngle(
        angles.comparisonCrankAngleRad,
        deltaS,
        comparisonRpm,
        playbackSpeed,
      );
}

/**
 * Runs the crank animation and hands each frame to `onFrame`.
 *
 * `onFrame` may change identity between renders; the latest one is always
 * used without re-registering the frame callback.
 */
export function useMechanismAnimation(
  onFrame: MechanismFrameCallback,
): MechanismAnimation {
  const anglesRef = useRef<FrameAngles>({
    crankAngleRad: useEngineStore.getState().crankAngleRad,
    comparisonCrankAngleRad: useEngineStore.getState().comparisonCrankAngleRad,
  });
  const lastSyncRef = useRef(0);
  const onFrameRef = useRef(onFrame);

  useLayoutEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useFrame((state, delta) => {
    // Transient read: no React subscription, so config, both RPMs, the link
    // state, playback speed, and the comparison engine are all picked up
    // immediately without rerendering the scene.
    const store = useEngineStore.getState();
    const angles = anglesRef.current;

    if (store.isPlaying) {
      advanceEnginePair(
        angles,
        delta,
        store.rpm,
        store.comparisonRpm,
        store.playbackSpeed,
        store.rpmLinked,
      );

      if (state.clock.elapsedTime - lastSyncRef.current > 1 / READOUT_SYNC_HZ) {
        lastSyncRef.current = state.clock.elapsedTime;
        store.syncCrankAngle(angles.crankAngleRad);
        // While linked the store keeps engine B's angle equal to engine A's
        // itself, so mirroring it here every tick would be a redundant write
        // (and a redundant rerender of everything reading it).
        if (!store.rpmLinked) {
          store.syncComparisonCrankAngle(angles.comparisonCrankAngleRad);
        }
      }
    } else {
      readPausedAngles(angles, store);
    }

    onFrameRef.current(angles, store);
  });

  const applyCurrent = useCallback(() => {
    const store = useEngineStore.getState();
    const angles = anglesRef.current;
    if (!store.isPlaying) {
      readPausedAngles(angles, store);
    }
    onFrameRef.current(angles, store);
  }, []);

  return { anglesRef, applyCurrent };
}

/**
 * Paused or scrubbed: the store owns both angles exactly, so playback resumes
 * from whatever was scrubbed to.
 *
 * While linked, engine B is taken from engine A rather than from its own store
 * field. Every store action keeps the two equal while linked, so this normally
 * reads the same value either way — but it also holds the guarantee if a
 * partial update (a share link carrying only engine A's angle, say) leaves
 * engine B's field behind. Linked engines are never drawn out of phase.
 */
function readPausedAngles(angles: FrameAngles, store: EngineStoreState): void {
  angles.crankAngleRad = store.crankAngleRad;
  angles.comparisonCrankAngleRad = store.rpmLinked
    ? store.crankAngleRad
    : store.comparisonCrankAngleRad;
}
