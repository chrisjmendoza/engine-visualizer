/**
 * The rotor: a three-sided body with circular-arc flanks, three tintable face
 * skins, and an apex marker at each corner (§27).
 *
 * Drawn entirely in the **rotor frame** — rotor center at the origin, apex k at
 * angle 2πk/3 and radius R — so every part of it is static geometry. The frame
 * loop moves the whole group to C(θ) and rotates it by φ(θ) through the ref
 * this component's parent hands in (`rotaryTransforms.ts`), which is what keeps
 * the per-frame work down to three scalar writes for the entire rotor.
 *
 * ## The three parts, and why they are three
 *
 * - **Core**: the rotor body, scaled in from the drawn outline by the skin
 *   thickness. Metal, never tinted.
 * - **Face skins**: one per face, each in its own group so the frame loop can
 *   repaint it independently. These are the rotary's combustion chambers'
 *   moving wall, and they are what makes a firing order visible — the same job
 *   `CylinderGuide`'s chamber group does, for the same reason and in the same
 *   declared color, so restoring the untinted state is exact.
 * - **Apex markers**: accent-colored, like the piston family's pins. They are
 *   the seals that make the whole mechanism work, and they are the one place a
 *   viewer can watch the rotor and the housing agree — every marker rides
 *   exactly on the trochoid at every shaft angle, which is the identity
 *   `rotaryGeometry.ts` proves.
 */

import { useMemo } from "react";
import type { RefObject } from "react";
import type { Group } from "three";
import { TWO_PI } from "../engine/constants";
import { ROTOR_FACE_COUNT } from "../engine/rotaryConstants";
import { rotorCoreShape, rotorFaceSkinShape } from "./rotaryShapes";
import type { RotaryProportions } from "./rotarySceneGeometry";
import { SCENE_COLORS } from "./sceneGeometry";

/** Angular pitch between adjacent faces in the rotor frame: 120°. */
const FACE_PITCH_RAD = TWO_PI / ROTOR_FACE_COUNT;

/** Face indices, so the three skins can be mapped rather than repeated. */
const FACE_INDEXES = [0, 1, 2] as const;

interface RotorProps {
  p: RotaryProportions;
  /** Stage-owned ref to the rotor group; the frame loop drives it. */
  ref: RefObject<Group | null>;
  /**
   * Stage-owned refs to the three face skins, indexed by face. Left unattached
   * when nobody is tinting, in which case each face simply keeps the
   * `SCENE_COLORS.clearance` it is declared with.
   */
  faceRefs: readonly RefObject<Group | null>[];
}

export function Rotor({ p, ref, faceRefs }: RotorProps) {
  const coreShape = useMemo(() => rotorCoreShape(p), [p]);
  const skinShape = useMemo(() => rotorFaceSkinShape(p), [p]);
  const extrudeOptions = useMemo(
    () => ({ depth: p.rotorDepthMm, bevelEnabled: false }),
    [p.rotorDepthMm],
  );

  return (
    <group ref={ref}>
      <group position={[0, 0, -p.rotorDepthMm / 2]}>
        <mesh>
          <extrudeGeometry args={[coreShape, extrudeOptions]} />
          <meshStandardMaterial
            color={SCENE_COLORS.piston}
            metalness={0.7}
            roughness={0.45}
          />
        </mesh>

        {/* One skin per face, each the face-0 shape turned onto its own face:
            face k's flank runs from apex k to apex k+1, and apex k sits at
            rotor angle 2πk/3, so a rotation is the whole difference. */}
        {FACE_INDEXES.map((face) => (
          <group
            key={face}
            ref={faceRefs[face]}
            rotation={[0, 0, FACE_PITCH_RAD * face]}
          >
            <mesh>
              <extrudeGeometry args={[skinShape, extrudeOptions]} />
              <meshStandardMaterial
                color={SCENE_COLORS.clearance}
                metalness={0.5}
                roughness={0.5}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Apex seals, in front of the rotor body so they stay readable — the
          same reason the piston family pushes its crankpin forward. */}
      {FACE_INDEXES.map((apex) => (
        <mesh
          key={apex}
          position={[
            p.generatingRadiusMm * Math.cos(FACE_PITCH_RAD * apex),
            p.generatingRadiusMm * Math.sin(FACE_PITCH_RAD * apex),
            p.apexZMm,
          ]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry
            args={[p.apexRadiusMm, p.apexRadiusMm, p.apexRadiusMm, 20]}
          />
          <meshStandardMaterial
            color={SCENE_COLORS.accent}
            metalness={0.6}
            roughness={0.35}
            emissive={SCENE_COLORS.accent}
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}
    </group>
  );
}
