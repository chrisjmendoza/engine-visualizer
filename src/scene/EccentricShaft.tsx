/**
 * The eccentric shaft: the fixed main journal at the shaft center and the lobe
 * that orbits it, carrying the rotor (§27).
 *
 * The rotary's `CrankThrow`, and the analogy is exact — the lobe is a crankpin
 * whose throw is the eccentricity e, and the rotor rides on it the way a
 * connecting rod's big end rides on a crankpin. Watching this part is the
 * clearest way to see the 3:1 reduction: the lobe goes round three times for
 * every turn of the rotor it is inside.
 *
 * The outer group is static (the main journal, the rotation reference); the
 * inner one — the one the loop drives — carries the lobe and is rotated by the
 * shaft angle. **Positive**, unlike the piston crank's negative rotation:
 * `rotaryGeometry.ts` puts the rotor center at (e·cos θ, e·sin θ), so drawing
 * the lobe at local (e, 0) and rotating by +θ lands it exactly there. The
 * piston family needs the flip only because it draws its crankpin along local
 * +Y against a (r·sin θ, r·cos θ) convention.
 */

import type { RefObject } from "react";
import type { Group } from "three";
import type { RotaryProportions } from "./rotarySceneGeometry";
import { SCENE_COLORS } from "./sceneGeometry";

interface EccentricShaftProps {
  p: RotaryProportions;
  /** Stage-owned ref to the rotating group; the frame loop drives it. */
  ref: RefObject<Group | null>;
}

export function EccentricShaft({ p, ref }: EccentricShaftProps) {
  // The lobe is a short disc rather than a deep one: it only has to read as a
  // solid in front of the rotor, and a long cylinder would hide the rotor
  // behind it in this orthographic front view.
  const lobeLengthMm = 0.12 * p.housingDepthMm;

  return (
    <group>
      {/* Fixed main journal at the shaft center: the rotation reference, and
          the visible fact that the rotor's center is *not* on the axis. */}
      <mesh position={[0, 0, p.eccentricZMm]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry
          args={[
            p.shaftJournalRadiusMm,
            p.shaftJournalRadiusMm,
            lobeLengthMm * 1.4,
            32,
          ]}
        />
        <meshStandardMaterial
          color={SCENE_COLORS.crank}
          metalness={0.8}
          roughness={0.45}
        />
      </mesh>

      <group ref={ref}>
        {/* The lobe, drawn at local (e, 0). */}
        <mesh
          position={[p.eccentricityMm, 0, p.eccentricZMm]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry
            args={[
              p.eccentricLobeRadiusMm,
              p.eccentricLobeRadiusMm,
              lobeLengthMm,
              32,
            ]}
          />
          <meshStandardMaterial
            color={SCENE_COLORS.structureDark}
            metalness={0.75}
            roughness={0.5}
          />
        </mesh>

        {/* The rotor center itself: a moving joint, so it takes the accent
            color exactly as the crankpin does, and sits proud of the lobe. */}
        <mesh
          position={[p.eccentricityMm, 0, p.eccentricZMm + lobeLengthMm * 0.7]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry
            args={[
              p.apexRadiusMm * 0.8,
              p.apexRadiusMm * 0.8,
              lobeLengthMm * 0.6,
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
