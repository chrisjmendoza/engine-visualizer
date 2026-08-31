/**
 * One complete single-cylinder slider-crank mechanism: cylinder guide, crank
 * throw, connecting rod, and piston (§12.1).
 *
 * Purely presentational and fully parameterized by its own proportions and X
 * offset, so the stage can instantiate it once per engine — today for a
 * side-by-side comparison, later for each cylinder of a multi-cylinder layout
 * (§24). It owns no animation state and reads nothing from the store.
 *
 * The stage owns the group refs and passes them in, so a single frame loop can
 * drive every mechanism on screen. Unmounting this component clears those refs,
 * which is how a comparison engine can disappear without the loop noticing.
 */

import { ConnectingRod } from "./ConnectingRod";
import { CrankThrow } from "./CrankThrow";
import { CylinderGuide } from "./CylinderGuide";
import type { MechanismRefs } from "./mechanismTransforms";
import { Piston } from "./Piston";
import type { MechanismProportions } from "./sceneGeometry";

interface CrankMechanismProps {
  p: MechanismProportions;
  /** Where this mechanism's crankshaft center sits, in scene millimeters. */
  positionX: number;
  /** Stage-owned refs to this mechanism's moving groups. */
  crankRef: MechanismRefs["crank"];
  rodRef: MechanismRefs["rod"];
  pistonRef: MechanismRefs["piston"];
  /** Forwarded to `CylinderGuide`: only cylinder 0 draws the crank-direction arrow. */
  isFrontCylinder?: boolean;
}

export function CrankMechanism({
  p,
  positionX,
  crankRef,
  rodRef,
  pistonRef,
  isFrontCylinder = false,
}: CrankMechanismProps) {
  return (
    <group position={[positionX, 0, 0]}>
      <CylinderGuide p={p} isFrontCylinder={isFrontCylinder} />
      <CrankThrow p={p} ref={crankRef} />
      <ConnectingRod p={p} ref={rodRef} />
      <Piston p={p} ref={pistonRef} />
    </group>
  );
}
