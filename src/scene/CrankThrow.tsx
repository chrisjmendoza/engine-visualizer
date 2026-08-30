/**
 * Crank throw, crankpin, and the fixed main journal (§12.1).
 *
 * The outer group is static and only pushes the crank assembly behind the rod
 * in Z. The inner group — the one the loop owner drives — carries the web,
 * counterweight, and crankpin, and is rotated by -crankAngleRad about Z.
 *
 * Why the negative sign: the kinematics places the crankpin at
 * (r·sin θ, r·cos θ), which is +Y at TDC and swings toward +X as θ grows.
 * Rotating local +Y by ψ about Z gives (-sin ψ, cos ψ), so ψ = -θ puts the
 * drawn crankpin exactly on the calculated crankpin. The crank therefore
 * turns clockwise in this front view, matching the rod-angle sign convention.
 */

import type { RefObject } from "react";
import type { Group } from "three";
import type { MechanismProportions } from "./sceneGeometry";
import { SCENE_COLORS } from "./sceneGeometry";

interface CrankThrowProps {
  p: MechanismProportions;
  ref: RefObject<Group | null>;
}

export function CrankThrow({ p, ref }: CrankThrowProps) {
  const webHeight = p.crankRadiusMm + p.crankWebWidthMm;
  const webCenterY = p.crankRadiusMm / 2;

  return (
    <group position={[0, 0, p.crankZMm]}>
      {/* Fixed main journal at the crankshaft center: the rotation reference. */}
      <mesh position={[0, 0, p.journalZMm]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry
          args={[p.journalRadiusMm, p.journalRadiusMm, p.journalLengthMm, 32]}
        />
        <meshStandardMaterial
          color={SCENE_COLORS.structure}
          metalness={0.7}
          roughness={0.5}
        />
      </mesh>

      <group ref={ref}>
        {/* Web from the main journal out to the crankpin. */}
        <mesh position={[0, webCenterY, 0]}>
          <boxGeometry
            args={[p.crankWebWidthMm, webHeight, p.crankWebDepthMm]}
          />
          <meshStandardMaterial
            color={SCENE_COLORS.crank}
            metalness={0.8}
            roughness={0.45}
          />
        </mesh>

        {/* Counterweight opposite the throw. */}
        <mesh position={[0, p.counterweightCenterYMm, 0]}>
          <boxGeometry
            args={[
              p.counterweightWidthMm,
              p.counterweightHeightMm,
              p.crankWebDepthMm,
            ]}
          />
          <meshStandardMaterial
            color={SCENE_COLORS.crank}
            metalness={0.75}
            roughness={0.55}
          />
        </mesh>

        {/* Crankpin: a moving joint, so it takes the accent color. Its front
            face sits ahead of the rod so the joint stays readable. */}
        <mesh
          position={[0, p.crankRadiusMm, p.crankPinZMm]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry
            args={[
              p.crankPinRadiusMm,
              p.crankPinRadiusMm,
              p.crankPinLengthMm,
              24,
            ]}
          />
          <meshStandardMaterial
            color={SCENE_COLORS.accent}
            metalness={0.6}
            roughness={0.35}
            emissive={SCENE_COLORS.accent}
            emissiveIntensity={0.15}
          />
        </mesh>
      </group>
    </group>
  );
}
