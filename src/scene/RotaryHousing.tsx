/**
 * The fixed housing of one rotor: the peritrochoid working surface and the
 * wall around it, extruded to the rotor width (§27).
 *
 * The rotary's `CylinderGuide` — the static structure the moving part works
 * inside — and drawn as the same kind of cutaway, a band rather than a solid,
 * so the rotor stays visible from the fixed front viewpoint. Nothing here
 * moves, so this rerenders only when the configuration changes; the outline is
 * sampled once in `deriveRotaryProportions` and turned into a `Shape` once
 * here, never per frame (§18).
 *
 * There is no tinting on the housing. A rotary's chambers travel *with* the
 * rotor — the same patch of housing is intake, then compression, then power,
 * then exhaust as three different chambers sweep past it — so painting the
 * housing by phase would be meaningless. The moving faces carry the tint
 * instead (`Rotor`), which is the rotary's whole point.
 */

import { useMemo } from "react";
import { housingShape } from "./rotaryShapes";
import type { RotaryProportions } from "./rotarySceneGeometry";
import { SCENE_COLORS } from "./sceneGeometry";

interface RotaryHousingProps {
  p: RotaryProportions;
}

export function RotaryHousing({ p }: RotaryHousingProps) {
  const shape = useMemo(() => housingShape(p), [p]);

  return (
    <group>
      {/* Extrusion runs from z = 0 forward, so the group is pushed back by
          half the depth to center the housing on the drawing plane — the same
          convention every other part of the scene is drawn on. */}
      <mesh position={[0, 0, -p.housingDepthMm / 2]}>
        <extrudeGeometry
          args={[shape, { depth: p.housingDepthMm, bevelEnabled: false }]}
        />
        <meshStandardMaterial
          color={SCENE_COLORS.structure}
          metalness={0.55}
          roughness={0.6}
        />
      </mesh>
    </group>
  );
}
