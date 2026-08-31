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
 *
 * Two of these can share one crank center — the two cylinders of a V or flat
 * throw, drawn in one cutaway plane (§24a). They are still two independent
 * instances, differing only in bank tilt, depth (`positionZ`), and whether the
 * crank throw itself is drawn (`drawsCrank`); nothing here knows about pairing.
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
  /**
   * Height of this mechanism's crankshaft center, in scene millimeters. Zero
   * everywhere except the lower engine of a stacked comparison (§24a).
   */
  positionY?: number;
  /**
   * Depth of this mechanism's whole drawing, in scene millimeters
   * (`PlacedCylinder.offsetZMm`, §24a). Non-zero only for the second cylinder
   * of a throw pair, which shares a crank center with its partner and would
   * otherwise put coincident faces at identical depths. Defaults to 0.
   */
  positionZ?: number;
  /**
   * This cylinder's bank tilt (`CylinderDefinition.bankOffsetRad`, §24a):
   * the whole mechanism — bore, piston, rod, crank, and reference marks
   * alike — is rotated by it about the crankshaft center, which is what makes
   * a V8 alternate its bores left and right and lays a flat engine's bores
   * out horizontally. The mechanism's internal math is untouched: the crank
   * still turns through the same angles, the piston still slides along its
   * own bore axis. Defaults to 0 (upright) for inline layouts.
   */
  bankOffsetRad?: number;
  /** Stage-owned refs to this mechanism's moving groups. */
  crankRef: MechanismRefs["crank"];
  rodRef: MechanismRefs["rod"];
  pistonRef: MechanismRefs["piston"];
  /** Forwarded to `CylinderGuide`: only cylinder 0 draws the crank-direction arrow. */
  isFrontCylinder?: boolean;
  /**
   * Whether to draw the crank throw at all (`PlacedCylinder.drawsCrank`, §24a).
   *
   * False for the bank-1 cylinder of a shared-pin V pair, whose crank drawing
   * would coincide with its partner's at every crank angle: the two are drawn
   * around one crank center and rotate by the same expression, so drawing both
   * would put two identical cranks in the same place. Omitting this one leaves
   * a single crankpin carrying both rods, which is what a real V engine has.
   *
   * `crankRef` is then simply never attached, and the frame loop skips a null
   * group exactly as it does for a cylinder that has not mounted yet — which is
   * why this is a prop rather than a second component. Defaults to true.
   */
  drawsCrank?: boolean;
}

export function CrankMechanism({
  p,
  positionX,
  positionY = 0,
  positionZ = 0,
  bankOffsetRad = 0,
  crankRef,
  rodRef,
  pistonRef,
  isFrontCylinder = false,
  drawsCrank = true,
}: CrankMechanismProps) {
  // Two nested groups, not one: the outer one puts this cylinder's crankshaft
  // center on the stage, the inner one tilts everything about that center. A
  // single group could not do both, since a rotation applies about the
  // group's own origin.
  return (
    <group position={[positionX, positionY, positionZ]}>
      <group rotation={[0, 0, bankOffsetRad]}>
        <CylinderGuide p={p} isFrontCylinder={isFrontCylinder} />
        {drawsCrank && <CrankThrow p={p} ref={crankRef} />}
        <ConnectingRod p={p} ref={rodRef} />
        <Piston p={p} ref={pistonRef} />
      </group>
    </group>
  );
}
