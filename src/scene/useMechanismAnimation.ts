/**
 * The animation loop for the crank mechanism (TECHNICAL_DESIGN.md §11, §18).
 *
 * Rules enforced here:
 * - The live crank angle lives in a ref, not in React state, so no component
 *   rerenders per frame.
 * - Playback advances the angle by Δθ = Δt × RPM × 2π / 60, with Δt clamped
 *   so an inactive browser tab cannot make the mechanism jump.
 * - While paused (or scrubbing) the store is authoritative and the ref simply
 *   follows it, so play resumes from the scrubbed angle.
 * - The store is written at most READOUT_SYNC_HZ times per second, purely to
 *   mirror the angle into the readouts; it is never written per frame.
 * - The mechanism geometry itself comes from `calculateMechanismState`. The
 *   loop never reimplements slider-crank math.
 */

import { useFrame } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { READOUT_SYNC_HZ, TWO_PI } from "../engine/constants";
import { calculateMechanismState } from "../engine/kinematics";
import type { MechanismState } from "../engine/types";
import { useEngineStore } from "../state/engineStore";

/** Largest frame delta the loop will integrate, in seconds. */
const MAX_FRAME_DELTA_S = 0.1;

export interface MechanismAnimation {
  /** The live crank angle in radians, owned by the loop while playing. */
  angleRef: RefObject<number>;
  /** Recomputes and reapplies the mechanism at the current live angle. */
  applyCurrent: () => void;
}

/**
 * Runs the crank animation and hands each frame's mechanism state to
 * `onFrame`, which is expected to mutate Three.js objects imperatively.
 *
 * `onFrame` may change identity between renders; the latest one is always
 * used without re-registering the frame callback.
 */
export function useMechanismAnimation(
  onFrame: (state: MechanismState) => void,
): MechanismAnimation {
  const angleRef = useRef(useEngineStore.getState().crankAngleRad);
  const lastSyncRef = useRef(0);
  const onFrameRef = useRef(onFrame);

  useLayoutEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useFrame((state, delta) => {
    // Transient read: no React subscription, so config/RPM/play changes are
    // picked up immediately without rerendering the scene.
    const store = useEngineStore.getState();

    if (store.isPlaying) {
      const dt = Math.min(delta, MAX_FRAME_DELTA_S);
      angleRef.current =
        (angleRef.current + (dt * store.rpm * TWO_PI) / 60) % TWO_PI;

      if (state.clock.elapsedTime - lastSyncRef.current > 1 / READOUT_SYNC_HZ) {
        lastSyncRef.current = state.clock.elapsedTime;
        store.syncCrankAngle(angleRef.current);
      }
    } else {
      // Paused or scrubbed: the store owns the angle exactly.
      angleRef.current = store.crankAngleRad;
    }

    onFrameRef.current(calculateMechanismState(store.config, angleRef.current));
  });

  const applyCurrent = useCallback(() => {
    const store = useEngineStore.getState();
    if (!store.isPlaying) {
      angleRef.current = store.crankAngleRad;
    }
    onFrameRef.current(calculateMechanismState(store.config, angleRef.current));
  }, []);

  return { angleRef, applyCurrent };
}
