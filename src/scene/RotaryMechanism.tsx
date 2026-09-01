/**
 * One complete rotor mechanism: housing, eccentric shaft, and rotor (§27) —
 * the rotary's `CrankMechanism`.
 *
 * Purely presentational and fully parameterized by its proportions and its
 * position, so the stage can instantiate one per rotor of an engine and one
 * per compared engine. It owns no animation state and reads nothing from the
 * store; the stage owns the moving groups' refs and passes them in, so a
 * single frame loop drives every mechanism on screen.
 *
 * Simpler than its piston counterpart by exactly the features a rotary does
 * not have: no bank tilt (`drawnRotationRad`), because a housing's major axis
 * is always along X and there is nothing to stand upright; no depth step
 * (`positionZ`), because two rotors never share a shaft center the way a V
 * pair shares a crank center; and no conditional crank, because every rotor
 * has its own lobe on the shaft.
 */

import type { RefObject } from "react";
import type { Group } from "three";
import { EccentricShaft } from "./EccentricShaft";
import { Rotor } from "./Rotor";
import { RotaryHousing } from "./RotaryHousing";
import type { RotaryProportions } from "./rotarySceneGeometry";

interface RotaryMechanismProps {
  p: RotaryProportions;
  /** Where this rotor's eccentric-shaft center sits, in scene millimeters. */
  positionX: number;
  /**
   * Height of this rotor's shaft center. Zero everywhere except the lower
   * engine of a stacked comparison (§24a).
   */
  positionY?: number;
  /** Stage-owned ref to the rotor group. */
  rotorRef: RefObject<Group | null>;
  /** Stage-owned ref to the rotating part of the eccentric shaft. */
  eccentricRef: RefObject<Group | null>;
  /** Stage-owned refs to the three tintable face skins, indexed by face. */
  faceRefs: readonly RefObject<Group | null>[];
}

export function RotaryMechanism({
  p,
  positionX,
  positionY = 0,
  rotorRef,
  eccentricRef,
  faceRefs,
}: RotaryMechanismProps) {
  return (
    <group position={[positionX, positionY, 0]}>
      <RotaryHousing p={p} />
      <Rotor p={p} ref={rotorRef} faceRefs={faceRefs} />
      <EccentricShaft p={p} ref={eccentricRef} />
    </group>
  );
}
