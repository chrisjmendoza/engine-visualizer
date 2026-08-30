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

import { useMemo, useRef } from "react";
import type { RefObject } from "react";
import type { Group, Object3D } from "three";
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

/**
 * The three moving groups of one mechanism, as React refs.
 *
 * Grouping them lets the stage own a set per engine and hand it to the
 * component that draws that engine, without either side reaching into the
 * other's internals.
 */
export interface MechanismRefs {
  crank: RefObject<Group | null>;
  rod: RefObject<Group | null>;
  piston: RefObject<Group | null>;
}

/** Creates one mechanism's group refs, stable for the component's lifetime. */
export function useMechanismRefs(): MechanismRefs {
  const crank = useRef<Group>(null);
  const rod = useRef<Group>(null);
  const piston = useRef<Group>(null);
  return useMemo(() => ({ crank, rod, piston }), [crank, rod, piston]);
}

/**
 * Reads the current group for each ref into a caller-owned carrier and applies
 * the state. The carrier is refilled in place, so a frame that drives several
 * mechanisms still allocates nothing (§11).
 *
 * A ref that is empty — a comparison engine that has not mounted yet, or has
 * just unmounted — simply leaves that slot null and is skipped.
 */
export function applyMechanismState(
  carrier: MechanismObjects,
  refs: MechanismRefs,
  state: MechanismState,
): void {
  carrier.crank = refs.crank.current;
  carrier.rod = refs.rod.current;
  carrier.piston = refs.piston.current;
  applyMechanismTransforms(carrier, state);
}
