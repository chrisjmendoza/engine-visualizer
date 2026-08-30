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
 * - The loop hands out the live angle and a store snapshot. Mechanism geometry
 *   comes from `calculateMechanismState`; this module never reimplements
 *   slider-crank math.
 *
 * One loop drives every mechanism on screen, so a comparison pair always
 * shares an exact crank angle.
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

/**
 * Called once per frame with the live crank angle and the store snapshot the
 * loop read. Implementations are expected to mutate Three.js objects.
 */
export type MechanismFrameCallback = (
  crankAngleRad: number,
  store: EngineStoreState,
) => void;

export interface MechanismAnimation {
  /** The live crank angle in radians, owned by the loop while playing. */
  angleRef: RefObject<number>;
  /** Recomputes and reapplies every mechanism at the current live angle. */
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
 * Runs the crank animation and hands each frame to `onFrame`.
 *
 * `onFrame` may change identity between renders; the latest one is always
 * used without re-registering the frame callback.
 */
export function useMechanismAnimation(
  onFrame: MechanismFrameCallback,
): MechanismAnimation {
  const angleRef = useRef(useEngineStore.getState().crankAngleRad);
  const lastSyncRef = useRef(0);
  const onFrameRef = useRef(onFrame);

  useLayoutEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useFrame((state, delta) => {
    // Transient read: no React subscription, so config, RPM, playback speed,
    // and the comparison engine are all picked up immediately without
    // rerendering the scene.
    const store = useEngineStore.getState();

    if (store.isPlaying) {
      angleRef.current = advanceCrankAngle(
        angleRef.current,
        delta,
        store.rpm,
        store.playbackSpeed,
      );

      if (state.clock.elapsedTime - lastSyncRef.current > 1 / READOUT_SYNC_HZ) {
        lastSyncRef.current = state.clock.elapsedTime;
        store.syncCrankAngle(angleRef.current);
      }
    } else {
      // Paused or scrubbed: the store owns the angle exactly.
      angleRef.current = store.crankAngleRad;
    }

    onFrameRef.current(angleRef.current, store);
  });

  const applyCurrent = useCallback(() => {
    const store = useEngineStore.getState();
    if (!store.isPlaying) {
      angleRef.current = store.crankAngleRad;
    }
    onFrameRef.current(angleRef.current, store);
  }, []);

  return { angleRef, applyCurrent };
}
