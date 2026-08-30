/**
 * The single-cylinder slider-crank mechanism: owns the animation loop and
 * composes the drawn parts (§11, §12.1).
 *
 * React subscribes only to the configuration (through
 * `useMechanismProportions`), so geometry is rebuilt when a dimension
 * changes. Per-frame motion never touches React: the loop mutates the crank,
 * rod, and piston groups through refs (§18).
 */

import { useCallback, useLayoutEffect, useRef } from "react";
import type { Group } from "three";
import type { MechanismState } from "../engine/types";
import { ConnectingRod } from "./ConnectingRod";
import { CrankThrow } from "./CrankThrow";
import { CylinderGuide } from "./CylinderGuide";
import type { MechanismObjects } from "./mechanismTransforms";
import { applyMechanismTransforms } from "./mechanismTransforms";
import { Piston } from "./Piston";
import { useMechanismProportions } from "./sceneGeometry";
import { useMechanismAnimation } from "./useMechanismAnimation";

export function SingleCylinderMechanism() {
  const p = useMechanismProportions();

  const crankRef = useRef<Group>(null);
  const rodRef = useRef<Group>(null);
  const pistonRef = useRef<Group>(null);

  // One reusable carrier, refilled in place, so the frame loop allocates
  // nothing (§11).
  const objectsRef = useRef<MechanismObjects>({
    crank: null,
    rod: null,
    piston: null,
  });

  /** Drives the Three.js objects from one calculated mechanism state. */
  const applyFrame = useCallback((m: MechanismState) => {
    const objects = objectsRef.current;
    objects.crank = crankRef.current;
    objects.rod = rodRef.current;
    objects.piston = pistonRef.current;
    applyMechanismTransforms(objects, m);
  }, []);

  const { applyCurrent } = useMechanismAnimation(applyFrame);

  // Place the parts before the first painted frame, and again whenever the
  // geometry is rebuilt, so nothing is ever drawn at the untransformed origin.
  useLayoutEffect(() => {
    applyCurrent();
  }, [applyCurrent, p]);

  return (
    <group>
      <CylinderGuide p={p} />
      <CrankThrow p={p} ref={crankRef} />
      <ConnectingRod p={p} ref={rodRef} />
      <Piston p={p} ref={pistonRef} />
    </group>
  );
}
