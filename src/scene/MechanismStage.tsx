/**
 * The stage: owns the single animation loop and places one or two mechanisms
 * on it (§11, §12.1).
 *
 * React subscribes only to the configurations (through the layout passed in),
 * so geometry is rebuilt when a dimension changes or comparison is toggled.
 * Per frame nothing touches React: one loop computes each engine's mechanism
 * state at the same crank angle and mutates its Three.js groups through a
 * reusable carrier (§18).
 *
 * Both engines share the crank angle, RPM, and playback state, so any visible
 * difference between them is purely geometric.
 */

import { useCallback, useLayoutEffect, useRef } from "react";
import { calculateMechanismState } from "../engine/kinematics";
import { CrankMechanism } from "./CrankMechanism";
import type { MechanismObjects } from "./mechanismTransforms";
import { applyMechanismState, useMechanismRefs } from "./mechanismTransforms";
import type { SceneLayout } from "./sceneGeometry";
import type { EngineStoreState } from "./useMechanismAnimation";
import { useMechanismAnimation } from "./useMechanismAnimation";

interface MechanismStageProps {
  layout: SceneLayout;
}

export function MechanismStage({ layout }: MechanismStageProps) {
  const primaryRefs = useMechanismRefs();
  const secondaryRefs = useMechanismRefs();

  // One reusable carrier per mechanism, refilled in place each frame, so the
  // loop allocates nothing (§11).
  const primaryObjects = useRef<MechanismObjects>({
    crank: null,
    rod: null,
    piston: null,
  });
  const secondaryObjects = useRef<MechanismObjects>({
    crank: null,
    rod: null,
    piston: null,
  });

  /**
   * Drives every mechanism from one crank angle.
   *
   * The comparison engine is read from the store snapshot rather than from
   * props, so a frame landing between the store change and React's rerender
   * still behaves: if engine B has just appeared its groups are not mounted
   * yet and its refs are still empty, and if it has just been removed React
   * has already cleared them. Either way the transforms are a no-op.
   */
  const applyFrame = useCallback(
    (crankAngleRad: number, store: EngineStoreState) => {
      applyMechanismState(
        primaryObjects.current,
        primaryRefs,
        calculateMechanismState(store.config, crankAngleRad),
      );

      const comparison = store.comparisonConfig;
      if (comparison) {
        applyMechanismState(
          secondaryObjects.current,
          secondaryRefs,
          calculateMechanismState(comparison, crankAngleRad),
        );
      }
    },
    [primaryRefs, secondaryRefs],
  );

  const { applyCurrent } = useMechanismAnimation(applyFrame);

  // Place the parts before the first painted frame, and again whenever the
  // layout is rebuilt, so nothing is ever drawn at the untransformed origin.
  useLayoutEffect(() => {
    applyCurrent();
  }, [applyCurrent, layout]);

  return (
    <group>
      <CrankMechanism
        p={layout.primary.proportions}
        positionX={layout.primary.offsetXMm}
        crankRef={primaryRefs.crank}
        rodRef={primaryRefs.rod}
        pistonRef={primaryRefs.piston}
      />
      {layout.secondary && (
        <CrankMechanism
          p={layout.secondary.proportions}
          positionX={layout.secondary.offsetXMm}
          crankRef={secondaryRefs.crank}
          rodRef={secondaryRefs.rod}
          pistonRef={secondaryRefs.piston}
        />
      )}
    </group>
  );
}
