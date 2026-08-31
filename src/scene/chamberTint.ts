/**
 * The four-stroke tint: what a cylinder's combustion chamber is *painted*
 * while it fires and while it exhausts (§24a).
 *
 * This is the presentation half of a split the note on
 * `cylinderCycleAngleRad` makes: which stroke a cylinder is in is engine-layer
 * truth, derived from the layout's real firing order; that a power stroke is
 * drawn red and an exhaust stroke blue — and that intake and compression are
 * drawn exactly as an untinted cylinder always was — is a decision made here
 * and nowhere else, in the same spirit as `drawnRotationRad`. Nothing in
 * `src/engine/` knows a color exists.
 *
 * ## Why this is a mutation and not a prop
 *
 * The phase changes with the crank, so binding it to React state would rerender
 * a component per cylinder several times per revolution, which §11 forbids just
 * as firmly as a per-frame setter. The frame loop instead calls
 * `applyChamberPhase` per cylinder per frame and it writes **only on a change**
 * — a handful of writes per 720° cycle rather than sixty per second — so the
 * per-frame cost of the tint is one comparison per cylinder, and nothing here
 * allocates: the three colors are module-level singletons and the write is a
 * `Color.copy`.
 */

import { Color } from "three";
import type { Mesh, MeshStandardMaterial, Object3D } from "three";
import type { StrokePhase } from "../engine/cycle";
import { SCENE_COLORS } from "./sceneGeometry";

/**
 * The untinted chamber: exactly `SCENE_COLORS.clearance`, the color the
 * chamber meshes are declared with, so restoring it is a genuine restore
 * rather than an approximation of one.
 */
const NEUTRAL_COLOR = new Color(SCENE_COLORS.clearance);
const FIRING_COLOR = new Color(SCENE_COLORS.chamberFiring);
const EXHAUST_COLOR = new Color(SCENE_COLORS.chamberExhaust);

/**
 * The chamber color for a stroke phase, or for `null` — "no phase", which is
 * what the loop passes while the "Four-stroke cycle" preference is off.
 *
 * Intake and compression share the neutral deliberately: tinting all four
 * strokes would leave a cylinder permanently colored and say nothing, while
 * coloring only the two strokes that *do* something visible (burn, then blow
 * down) is what makes a firing order read as a wave travelling down the engine.
 */
export function chamberTintColor(phase: StrokePhase | null): Color {
  if (phase === "power") return FIRING_COLOR;
  if (phase === "exhaust") return EXHAUST_COLOR;
  return NEUTRAL_COLOR;
}

/**
 * The last phase written to one cylinder's chamber. Owned by that cylinder (a
 * ref), passed back in on every call, and initialized to `null` — the same
 * value a preference-off frame passes — so a session that never turns the
 * preference on never writes a material at all.
 */
export interface ChamberTintState {
  phase: StrokePhase | null;
}

/** A fresh tint state: no phase written yet, chamber at its declared color. */
export function createChamberTintState(): ChamberTintState {
  return { phase: null };
}

/**
 * Paints one cylinder's chamber for `phase`, if that is not already what it is
 * showing. Returns whether it actually wrote, which is what the tests assert
 * on: with the preference off this must never write, and with it on it must
 * write once per stroke boundary and not once per frame.
 *
 * `group` is the chamber group `CylinderGuide` marks — its children are the
 * meshes that make up the chamber's surfaces. A null group (a cylinder not
 * mounted yet, or already unmounted) is skipped *without* recording the phase,
 * so the tint lands on the frame after the group appears rather than never.
 */
export function applyChamberPhase(
  group: Object3D | null,
  state: ChamberTintState,
  phase: StrokePhase | null,
): boolean {
  if (phase === state.phase) {
    return false;
  }
  if (!group) {
    return false;
  }

  const color = chamberTintColor(phase);
  const children = group.children;
  // Indexed loop and no closures: this runs at most a few times per cycle, but
  // it shares the frame loop's no-allocation budget (§18).
  for (let i = 0; i < children.length; i += 1) {
    const material = (children[i] as Mesh).material as
      MeshStandardMaterial | MeshStandardMaterial[] | undefined;
    // A chamber mesh has exactly one colored material; anything else — a
    // multi-material mesh, a helper without one — is left alone rather than
    // guessed at.
    if (material && !Array.isArray(material) && material.color) {
      material.color.copy(color);
    }
  }

  state.phase = phase;
  return true;
}
