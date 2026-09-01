/**
 * The one place calculated rotary state becomes Three.js transforms, and the
 * one place a rotor face's phase becomes a material write (§27).
 *
 * The rotary counterpart of `mechanismTransforms.ts` + the face half of
 * `chamberTint.ts`, and it holds to the same two rules: it contains no
 * mechanism math — every number comes from `src/engine/rotaryGeometry.ts` and
 * `src/engine/rotaryCycle.ts` — and it allocates nothing per frame, writing
 * scalars into caller-owned carriers instead.
 *
 * ## Why the shaft angle handed in here is a *cycle* angle
 *
 * A rotor's orientation is θ_total / 3, so the wrapped θ the loop keeps is not
 * enough: θ and θ + 2π put the rotor 120° apart, and both wrap to the same
 * number. The loop's mod-6 revolution counter is what supplies the missing
 * revolutions, and `rotaryCycleAngleRad(θ, index % 3)` is exactly the
 * combination — an angle in [0, 6π) that carries both. Dividing *that* by three
 * gives the true rotor angle, modulo a whole turn.
 *
 * The same number drives the face tint, and deliberately so: rotor placement
 * and face phase are two readings of one clock, and computing them from
 * different quantities is how they would drift apart. `MechanismStage` computes
 * it once per engine per frame and hands it to both.
 */

import type { Object3D } from "three";
import type { StrokePhase } from "../engine/cycle";
import { ROTOR_FACE_COUNT } from "../engine/rotaryConstants";
import { rotorFacePhaseAt } from "../engine/rotaryCycle";
import { rotorAngleRad, rotorCenterMm } from "../engine/rotaryGeometry";
import type { RotaryConfig, RotaryPointMm } from "../engine/rotaryTypes";
import { applyChamberPhase, createChamberTintState } from "./chamberTint";
import type { ChamberTintState } from "./chamberTint";

/** The moving groups of one rotor, as the frame loop sees them. */
export interface RotorObjects {
  /**
   * The rotor body: the group whose origin is the rotor center and whose local
   * frame puts apex k at angle 2πk/3. Both translated and rotated per frame.
   */
  rotor: Object3D | null;
  /**
   * The eccentric shaft assembly: a group at the shaft center carrying the
   * lobe at local (e, 0), so rotating it by the shaft angle walks the lobe
   * around the orbit C(θ). Rotated per frame; never moved.
   */
  eccentric: Object3D | null;
}

/**
 * One rotor's placement at one instant — the rotary's `MechanismState`, but
 * caller-owned and refilled in place so the loop allocates nothing (§18).
 */
export interface RotorPlacement {
  /**
   * The phased eccentric-shaft angle θ + phase, radians. What the eccentric
   * group is rotated by, and — divided by three — where the rotor points.
   */
  shaftAngleRad: number;
  /** Rotor center C(θ + phase), written in place by `rotorCenterMm`. */
  centerMm: RotaryPointMm;
  /** Rotor orientation φ = (θ + phase) / 3, radians. */
  rotorAngleRad: number;
}

/** A fresh, reusable placement carrier for one rotor. */
export function createRotorPlacement(): RotorPlacement {
  return {
    shaftAngleRad: 0,
    centerMm: { xMm: 0, yMm: 0 },
    rotorAngleRad: 0,
  };
}

/**
 * Fills `out` with one rotor's placement at a shaft cycle angle.
 *
 * `shaftCycleAngleRad` is the engine's angle in the cycle's own [0, 6π)
 * domain (`rotaryCycleAngleRad`), not the wrapped θ — see this module's
 * header for why that distinction is the whole reason the revolution counter
 * exists. `rotorPhaseRad` is this rotor's offset in shaft terms, divided by
 * three inside `rotorAngleRad` along with everything else.
 *
 * Allocation-free: `rotorCenterMm` writes into `out.centerMm` rather than
 * returning a fresh point.
 */
export function computeRotorPlacement(
  config: RotaryConfig,
  shaftCycleAngleRad: number,
  rotorPhaseRad: number,
  out: RotorPlacement,
): RotorPlacement {
  out.shaftAngleRad = shaftCycleAngleRad + rotorPhaseRad;
  rotorCenterMm(config, shaftCycleAngleRad, rotorPhaseRad, out.centerMm);
  out.rotorAngleRad = rotorAngleRad(shaftCycleAngleRad, rotorPhaseRad);
  return out;
}

/**
 * Applies one rotor's placement to its scene objects.
 *
 * **Rotor**: moved to C and rotated by +φ. The sign is positive, unlike the
 * piston crank's `-crankAngleRad`, and for a reason worth stating: the piston
 * family draws its crankpin along the group's local +Y and places it at
 * (r·sin θ, r·cos θ), a clockwise convention that needs the sign flip. The
 * rotary's apex k is defined at rotor angle φ + 2πk/3 measured from +X in the
 * standard sense, so rotating the group by +φ puts every drawn apex exactly on
 * its calculated position with no flip.
 *
 * **Eccentric**: rotated by the shaft angle. Its lobe is drawn at local
 * (e, 0), and rotating that by θ gives (e·cos θ, e·sin θ) — which is C(θ)
 * itself, so the lobe and the rotor center coincide at every angle by
 * construction rather than by being placed twice.
 *
 * A null object — a rotor that has not mounted yet, or has just unmounted — is
 * skipped, exactly as on the piston side.
 */
export function applyRotorPlacement(
  objects: RotorObjects,
  placement: RotorPlacement,
): void {
  if (objects.rotor) {
    objects.rotor.position.x = placement.centerMm.xMm;
    objects.rotor.position.y = placement.centerMm.yMm;
    objects.rotor.rotation.z = placement.rotorAngleRad;
  }

  if (objects.eccentric) {
    objects.eccentric.rotation.z = placement.shaftAngleRad;
  }
}

/**
 * The last phase written to each of one rotor's three faces.
 *
 * Three independent `ChamberTintState`s rather than one: a rotor's faces are
 * its cylinders, they are 360° of shaft apart in the cycle, and they change
 * phase at three different moments.
 */
export interface RotorFaceTintState {
  faces: readonly ChamberTintState[];
}

/** A fresh tint state for one rotor: no phase written to any face yet. */
export function createRotorFaceTintState(): RotorFaceTintState {
  const faces = new Array<ChamberTintState>(ROTOR_FACE_COUNT);
  for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
    faces[k] = createChamberTintState();
  }
  return { faces };
}

/**
 * Tints one rotor's three faces for the phases they are in, writing a material
 * only where a face's phase actually changed — the same discipline, and the
 * same `applyChamberPhase`, as a piston cylinder's chamber.
 *
 * `shaftCycleAngleRad` is null exactly when the "Four-stroke cycle" preference
 * is off, and then every face is handed `null`: no material is ever written and
 * the rotor is drawn exactly as it would be if the tint did not exist.
 *
 * Returns how many faces were written, which is what the tests assert on: over
 * a 1080° cycle this must total twelve writes per rotor (three faces × four
 * phase boundaries), not sixty per second.
 */
export function applyRotorFacePhases(
  faceGroups: readonly (Object3D | null)[],
  state: RotorFaceTintState,
  shaftCycleAngleRad: number | null,
  rotorPhaseRad: number,
): number {
  let writes = 0;
  // Indexed loop, no closures, no allocation: this runs per rotor per frame
  // and shares the frame loop's budget (§18). `rotorFacePhaseAt` is pure
  // arithmetic returning a string literal, so the only cost of a frame where
  // nothing changed is three comparisons.
  for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
    const phase: StrokePhase | null =
      shaftCycleAngleRad === null
        ? null
        : rotorFacePhaseAt(k, shaftCycleAngleRad, rotorPhaseRad);
    if (applyChamberPhase(faceGroups[k] ?? null, state.faces[k], phase)) {
      writes += 1;
    }
  }
  return writes;
}
