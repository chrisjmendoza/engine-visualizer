/**
 * Fixed cylinder structure and reference indicators (§12.1).
 *
 * Drawn as a cutaway: only the two bore walls and the deck above them, so the
 * piston and rod remain visible from the fixed front viewpoint. Nothing here
 * moves, so this component rerenders only when the configuration changes.
 */

import type { MechanismProportions } from "./sceneGeometry";
import { SCENE_COLORS } from "./sceneGeometry";

interface CylinderGuideProps {
  p: MechanismProportions;
}

export function CylinderGuide({ p }: CylinderGuideProps) {
  const wallHeight = p.cylinderWallTopYMm - p.cylinderWallBottomYMm;
  const wallCenterY = (p.cylinderWallTopYMm + p.cylinderWallBottomYMm) / 2;
  const wallCenterX = p.boreMm / 2 + p.cylinderWallThicknessMm / 2;
  const deckWidth = p.boreMm + 2 * p.cylinderWallThicknessMm;
  const deckCenterY = p.cylinderWallTopYMm + p.deckThicknessMm / 2;

  const centerlineHeight = p.bounds.maxY - p.bounds.minY;
  const centerlineCenterY = (p.bounds.maxY + p.bounds.minY) / 2;
  const markerCenterX = p.markerInnerXMm + p.markerLengthMm / 2;
  // TDC and BDC are told apart by tick length as well as position, so the
  // markers do not rely on color alone (§19).
  const bdcMarkerLength = p.markerLengthMm * 0.6;
  const bdcMarkerCenterX = p.markerInnerXMm + bdcMarkerLength / 2;

  return (
    <group>
      {/* Bore walls: the piston travels between them. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * wallCenterX, wallCenterY, 0]}
          castShadow={false}
        >
          <boxGeometry
            args={[p.cylinderWallThicknessMm, wallHeight, p.cylinderDepthMm]}
          />
          <meshStandardMaterial
            color={SCENE_COLORS.structure}
            metalness={0.55}
            roughness={0.6}
          />
        </mesh>
      ))}

      {/* Deck / head face closing the top of the bore. */}
      <mesh position={[0, deckCenterY, 0]}>
        <boxGeometry args={[deckWidth, p.deckThicknessMm, p.cylinderDepthMm]} />
        <meshStandardMaterial
          color={SCENE_COLORS.structureDark}
          metalness={0.5}
          roughness={0.65}
        />
      </mesh>

      {/* Cylinder centerline. Unlit so reference lines read consistently. */}
      <mesh position={[0, centerlineCenterY, p.referenceZMm]}>
        <boxGeometry
          args={[p.centerlineWidthMm, centerlineHeight, p.centerlineWidthMm]}
        />
        <meshBasicMaterial color={SCENE_COLORS.reference} />
      </mesh>

      {/* Top dead center: full-length ticks at the piston-pin TDC height. */}
      {[-1, 1].map((side) => (
        <mesh
          key={`tdc${side}`}
          position={[side * markerCenterX, p.tdcPinYMm, p.referenceZMm]}
        >
          <boxGeometry
            args={[p.markerLengthMm, p.markerThicknessMm, p.markerThicknessMm]}
          />
          <meshBasicMaterial color={SCENE_COLORS.accentDim} />
        </mesh>
      ))}

      {/* Bottom dead center: shorter ticks at the piston-pin BDC height. */}
      {[-1, 1].map((side) => (
        <mesh
          key={`bdc${side}`}
          position={[side * bdcMarkerCenterX, p.bdcPinYMm, p.referenceZMm]}
        >
          <boxGeometry
            args={[bdcMarkerLength, p.markerThicknessMm, p.markerThicknessMm]}
          />
          <meshBasicMaterial color={SCENE_COLORS.accentDim} />
        </mesh>
      ))}
    </group>
  );
}
