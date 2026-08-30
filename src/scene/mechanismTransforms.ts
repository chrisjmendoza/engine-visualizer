/**
 * The one place calculated mechanism state becomes Three.js transforms.
 *
 * It contains no mechanism math: every number comes from a `MechanismState`
 * produced by `calculateMechanismState`. What it encodes is the mapping from
 * that state onto three object transforms, and the sign conventions that
 * mapping depends on (§8.2, §12).
 *
 * Called once per frame, so it performs scalar writes only — no allocation,
 * no React state.
 */

import type { Object3D } from "three";
import type { MechanismState } from "../engine/types";

export interface MechanismObjects {
  /** Rotating crank group; its local +Y axis points at the crankpin. */
  crank: Object3D | null;
  /** Rod group placed at the big end, local +Y pointing at the small end. */
  rod: Object3D | null;
  /** Piston group whose origin is the piston-pin center. */
  piston: Object3D | null;
}

/**
 * Applies one mechanism state to the scene objects.
 *
 * Crank: the crankpin is at (r·sin θ, r·cos θ). Rotating a local +Y axis by ψ
 * about Z gives (-sin ψ, cos ψ), so ψ = -θ.
 *
 * Rod: placed at the crankpin and rotated by `rodAngleRad`, whose sine is
 * crankPinXmm / l. Its local +Y axis therefore reaches the piston pin on the
 * cylinder centerline exactly, at every crank angle — both ends stay attached
 * by construction rather than by drawing them independently.
 *
 * Piston: slides along the centerline to the calculated piston-pin height.
 */
export function applyMechanismTransforms(
  objects: MechanismObjects,
  state: MechanismState,
): void {
  if (objects.crank) {
    objects.crank.rotation.z = -state.crankAngleRad;
  }

  if (objects.rod) {
    objects.rod.position.x = state.crankPinXmm;
    objects.rod.position.y = state.crankPinYmm;
    objects.rod.rotation.z = state.rodAngleRad;
  }

  if (objects.piston) {
    objects.piston.position.y = state.pistonPinYmm;
  }
}
