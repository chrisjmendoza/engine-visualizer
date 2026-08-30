/**
 * Connecting rod (§12.1).
 *
 * The group origin is the big-end (crankpin) center and local +Y points along
 * the rod toward the small end. The loop owner places this group at
 * (crankPinXmm, crankPinYmm) and rotates it by `rodAngleRad`.
 *
 * Why that keeps both ends attached: rotating the local +Y axis by φ about Z
 * gives the world direction (-sin φ, cos φ). The kinematics defines
 * sin φ = crankPinXmm / l, so the small end lands at
 * (crankPinXmm - l·sin φ, crankPinYmm + l·cos φ) = (0, pistonPinYmm) — on the
 * cylinder centerline at the piston pin, exactly, at every crank angle. The
 * shank is therefore drawn at the true center-to-center rod length.
 */

import type { Ref } from "react";
import type { Group } from "three";
import type { MechanismProportions } from "./sceneGeometry";
import { SCENE_COLORS } from "./sceneGeometry";

interface ConnectingRodProps {
  p: MechanismProportions;
  /** Stage-owned ref to this part's group; the frame loop drives it. */
  ref: Ref<Group>;
}

export function ConnectingRod({ p, ref }: ConnectingRodProps) {
  return (
    <group ref={ref}>
      {/* Shank spanning big-end center to small-end center. */}
      <mesh position={[0, p.rodLengthMm / 2, 0]}>
        <boxGeometry args={[p.rodWidthMm, p.rodLengthMm, p.rodDepthMm]} />
        <meshStandardMaterial
          color={SCENE_COLORS.rod}
          metalness={0.85}
          roughness={0.4}
        />
      </mesh>

      {/* Big end, around the crankpin. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry
          args={[
            p.rodBigEndRadiusMm,
            p.rodBigEndRadiusMm,
            p.rodDepthMm * 1.4,
            28,
          ]}
        />
        <meshStandardMaterial
          color={SCENE_COLORS.rod}
          metalness={0.85}
          roughness={0.45}
        />
      </mesh>

      {/* Small end, around the piston pin. */}
      <mesh position={[0, p.rodLengthMm, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry
          args={[
            p.rodSmallEndRadiusMm,
            p.rodSmallEndRadiusMm,
            p.rodDepthMm * 1.3,
            24,
          ]}
        />
        <meshStandardMaterial
          color={SCENE_COLORS.rod}
          metalness={0.85}
          roughness={0.45}
        />
      </mesh>
    </group>
  );
}
