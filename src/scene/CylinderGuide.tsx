/**
 * Fixed cylinder structure and reference indicators (§12.1).
 *
 * Drawn as a cutaway: only the two bore walls and the deck above them, so the
 * piston and rod remain visible from the fixed front viewpoint. Nothing here
 * moves, so this component rerenders only when the configuration changes.
 *
 * The bore walls run from the skirt clearance below up to the deck face, and
 * are split at the piston crown's TDC height: the band above that point is the
 * clearance volume, shaded slightly lighter so the compression space reads as
 * a distinct volume that grows and shrinks with the compression ratio.
 */

import type { RefObject } from "react";
import type { Group } from "three";
import { SCENE_COLORS } from "./sceneGeometry";
import type { MechanismProportions } from "./sceneGeometry";

interface CylinderGuideProps {
  p: MechanismProportions;
  /**
   * Stage-owned ref to the combustion chamber's surfaces, so the frame loop
   * can tint them for the four-stroke phase without rerendering this component
   * (`chamberTint.ts`, §24a). Left unattached when nobody is tinting; the
   * chamber then simply keeps the `SCENE_COLORS.clearance` it is declared
   * with, which is exactly how it has always been drawn.
   */
  chamberRef?: RefObject<Group | null>;
}

export function CylinderGuide({ p, chamberRef }: CylinderGuideProps) {
  const wallCenterX = p.boreMm / 2 + p.cylinderWallThicknessMm / 2;

  // Wall below the TDC crown: the swept section the piston travels through.
  const travelHeight = p.crownAtTdcYMm - p.cylinderWallBottomYMm;
  const travelCenterY = (p.crownAtTdcYMm + p.cylinderWallBottomYMm) / 2;
  // Wall beside the clearance volume, from the TDC crown up to the deck face.
  const clearanceCenterY = p.crownAtTdcYMm + p.clearanceHeightMm / 2;

  const deckWidth = p.boreMm + 2 * p.cylinderWallThicknessMm;
  const deckCenterY = p.cylinderWallTopYMm + p.deckThicknessMm / 2;
  // Head face plate, hanging just under the deck inside the clearance disc.
  const headFaceCenterY = p.cylinderWallTopYMm - p.headFaceThicknessMm / 2;

  const centerlineHeight = p.bounds.maxY - p.bounds.minY;
  const centerlineCenterY = (p.bounds.maxY + p.bounds.minY) / 2;
  const markerCenterX = p.markerInnerXMm + p.markerLengthMm / 2;
  // TDC and BDC are told apart by tick length as well as position, so the
  // markers do not rely on color alone (§19).
  const bdcMarkerLength = p.markerLengthMm * 0.6;
  const bdcMarkerCenterX = p.markerInnerXMm + bdcMarkerLength / 2;

  return (
    <group>
      {/* Bore walls beside the piston's travel. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * wallCenterX, travelCenterY, 0]}
          castShadow={false}
        >
          <boxGeometry
            args={[p.cylinderWallThicknessMm, travelHeight, p.cylinderDepthMm]}
          />
          <meshStandardMaterial
            color={SCENE_COLORS.structure}
            metalness={0.55}
            roughness={0.6}
          />
        </mesh>
      ))}

      {/* The combustion chamber's own surfaces: the two bore walls beside the
          clearance volume and the head face closing its top. Grouped, and only
          these three, because the four-stroke tint repaints exactly this group
          (`chamberTint.ts`) — the space above the piston is what is burning, so
          the walls of the swept travel below and the deck above stay structural
          whatever the cylinder is doing. The group is otherwise inert: an
          identity transform, so the drawing is unchanged when nothing tints it. */}
      <group ref={chamberRef}>
        {[-1, 1].map((side) => (
          <mesh
            key={`clearance${side}`}
            position={[side * wallCenterX, clearanceCenterY, 0]}
          >
            <boxGeometry
              args={[
                p.cylinderWallThicknessMm,
                p.clearanceHeightMm,
                p.cylinderDepthMm,
              ]}
            />
            <meshStandardMaterial
              color={SCENE_COLORS.clearance}
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>
        ))}

        <mesh position={[0, headFaceCenterY, 0]}>
          <boxGeometry
            args={[p.boreMm, p.headFaceThicknessMm, p.cylinderDepthMm * 0.98]}
          />
          <meshStandardMaterial
            color={SCENE_COLORS.clearance}
            metalness={0.45}
            roughness={0.55}
          />
        </mesh>
      </group>

      {/* Deck / cylinder head above the clearance volume. */}
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
