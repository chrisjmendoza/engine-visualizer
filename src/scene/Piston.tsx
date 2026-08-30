/**
 * Piston and piston pin (§12.1).
 *
 * The group origin is the piston-pin center, which is exactly the point the
 * kinematics reports as `pistonPinYmm`; the loop owner sets this group's Y
 * each frame. Everything below is drawn relative to that pin.
 *
 * The body is drawn as a cutaway — crown plate plus two skirts — so the rod's
 * small end and the pin stay visible from the fixed front viewpoint.
 */

import type { Ref } from "react";
import type { Group } from "three";
import type { MechanismProportions } from "./sceneGeometry";
import { SCENE_COLORS } from "./sceneGeometry";

interface PistonProps {
  p: MechanismProportions;
  /** Stage-owned ref to this part's group; the frame loop drives it. */
  ref: Ref<Group>;
}

export function Piston({ p, ref }: PistonProps) {
  const crownPlateHeight = 0.3 * p.pistonHeightMm;
  const crownPlateCenterY = p.pistonCrownAbovePinMm - crownPlateHeight / 2;
  const skirtHeight =
    p.pistonCrownAbovePinMm - crownPlateHeight + p.pistonSkirtBelowPinMm;
  const skirtCenterY =
    (p.pistonCrownAbovePinMm - crownPlateHeight - p.pistonSkirtBelowPinMm) / 2;
  const skirtWidth = 0.16 * p.pistonWidthMm;
  const skirtCenterX = (p.pistonWidthMm - skirtWidth) / 2;
  const ringHeight = 0.045 * p.pistonHeightMm;
  const ringYs = [0.58 * p.pistonHeightMm, 0.47 * p.pistonHeightMm];

  return (
    <group ref={ref}>
      {/* Crown plate. */}
      <mesh position={[0, crownPlateCenterY, 0]}>
        <boxGeometry
          args={[p.pistonWidthMm, crownPlateHeight, p.pistonDepthMm]}
        />
        <meshStandardMaterial
          color={SCENE_COLORS.piston}
          metalness={0.8}
          roughness={0.32}
        />
      </mesh>

      {/* Ring grooves. */}
      {ringYs.map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry
            args={[
              p.pistonWidthMm * 1.008,
              ringHeight,
              p.pistonDepthMm * 1.008,
            ]}
          />
          <meshStandardMaterial
            color={SCENE_COLORS.ring}
            metalness={0.3}
            roughness={0.8}
          />
        </mesh>
      ))}

      {/* Skirts, left and right of the open cutaway center. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * skirtCenterX, skirtCenterY, 0]}>
          <boxGeometry args={[skirtWidth, skirtHeight, p.pistonDepthMm]} />
          <meshStandardMaterial
            color={SCENE_COLORS.piston}
            metalness={0.8}
            roughness={0.38}
          />
        </mesh>
      ))}

      {/* Piston pin: a moving joint, so it takes the accent color. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry
          args={[
            p.pistonPinRadiusMm,
            p.pistonPinRadiusMm,
            p.pistonPinLengthMm,
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
  );
}
