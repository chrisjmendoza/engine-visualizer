/**
 * Four-stroke cycle overlay — a pedagogical layer, not new mechanism math
 * (§11 flags this as future work; this is its first slice).
 *
 * A four-stroke engine completes intake, compression, power, and exhaust
 * once each per *two* crank revolutions — 720°, not 360°. The animation loop
 * (`src/scene/useMechanismAnimation.ts`, §11) only ever tracks the crank
 * angle wrapped into [0, 2π): a second revolution looks identical to the
 * first at that level, so it cannot tell intake from power on its own. This
 * module's `cycleAngleRad` takes a second, single-bit input —
 * `revolutionParity` — that the animation loop flips each time the wrapped
 * angle passes back through zero, and folds the two together into the
 * cycle's own [0, 4π) domain. Tracking and flipping that bit is loop
 * bookkeeping, not cycle math, so it lives in `useMechanismAnimation.ts`
 * (`advanceRevolutionParity`), not here; this module only ever consumes the
 * bit, never mutates it.
 *
 * `strokePhaseAt` answers for cylinder 0, whose cycle angle *is* the engine's.
 * `cylinderStrokePhaseAt` (below) answers for any cylinder of a layout, which
 * takes one more input the crank angle cannot supply — the engine's firing
 * order — and whose convention is spelled out on `cylinderCycleAngleRad`.
 *
 * This is a textbook idealization, not a claim about any real engine's valve
 * timing: `strokePhaseAt` divides the 720° cycle into four exact quarters,
 * while a real camshaft opens and closes valves well before and after those
 * boundaries (an intake valve typically opens before TDC and closes well
 * after BDC, for instance) to use the intake charge's own momentum. The
 * overlay exists to teach the *count* — four strokes, two crank revolutions,
 * one cycle — not to model actual valve events.
 */

import { TWO_PI } from "./constants";
import { cylinderFiringAngleRad } from "./engineLayout";
import type { EngineLayoutDefinition } from "./engineLayout";

/** One quarter of the 720° four-stroke cycle. */
export type StrokePhase = "intake" | "compression" | "power" | "exhaust";

/**
 * Folds a crank angle (radians) and a revolution-parity bit into the cycle's
 * own domain, [0, 4π) — one complete four-stroke cycle. Parity 0 is the
 * crank's first revolution since the last cycle boundary; parity 1 is its
 * second.
 *
 * `crankAngleRad` is wrapped into [0, 2π) here rather than trusted as
 * pre-normalized: this function's job is combining an angle with the
 * cycle-level bookkeeping the caller tracks externally, and it should not
 * additionally require that caller to pre-wrap its input.
 */
export function cycleAngleRad(
  crankAngleRad: number,
  revolutionParity: 0 | 1,
): number {
  const wrapped = ((crankAngleRad % TWO_PI) + TWO_PI) % TWO_PI;
  return wrapped + revolutionParity * TWO_PI;
}

/** Length of the full four-stroke cycle in radians: two crank revolutions. */
const CYCLE_SPAN_RAD = 2 * TWO_PI;

/**
 * Which stroke a cycle angle (as returned by `cycleAngleRad`) falls in,
 * under the idealization that each stroke is exactly a quarter of the 720°
 * cycle, with TDC at parity 0 (crank angle 0) starting intake:
 *
 *     [0, π)    intake
 *     [π, 2π)   compression
 *     [2π, 3π)  power
 *     [3π, 4π)  exhaust
 *
 * The input is folded into [0, 4π) first — the same defensiveness
 * `cycleAngleRad` applies to its own input — so a value at or past a cycle
 * boundary (4π) reads as the start of the next cycle's intake stroke rather
 * than silently reporting "exhaust" past the end of its own domain.
 */
export function strokePhaseAt(cycleAngleRadValue: number): StrokePhase {
  const wrapped =
    ((cycleAngleRadValue % CYCLE_SPAN_RAD) + CYCLE_SPAN_RAD) % CYCLE_SPAN_RAD;

  if (wrapped < Math.PI) return "intake";
  if (wrapped < TWO_PI) return "compression";
  if (wrapped < TWO_PI + Math.PI) return "power";
  return "exhaust";
}

/**
 * ## Per-cylinder cycle phase, and the convention it rests on
 *
 * Everything above answers the four-stroke question for **cylinder 0** only,
 * because the engine's cycle angle *is* cylinder 0's: `strokePhaseAt` reads
 * crank angle 0 at parity 0 as the start of cylinder 0's intake stroke, which
 * puts cylinder 0's power stroke at [2π, 3π) and therefore its **firing event
 * at cycle angle 2π**. That is the fixed point every other cylinder is placed
 * against, and it is the piece a future reader cannot re-derive from the code.
 *
 * A cylinder's own cycle angle is the engine's, shifted back by that
 * cylinder's firing angle:
 *
 *     cylinderCycleAngleRad(cyl)
 *         = engineCycleAngle − cylinderFiringAngleRad(cyl)   (mod 4π)
 *
 * Check it against the fixed point: `cylinderFiringAngleRad` measures firings
 * from cylinder 0's, whose value is 0, so cylinder 0 comes out unshifted and
 * agrees with `strokePhaseAt` exactly — the badge and the scene can never
 * disagree. Cylinder *k* fires when its own cycle angle reaches 2π, i.e. at
 * engine cycle angle `firingAngle_k + 2π`; reduced mod 2π that is
 * `firingAngle_k`, which `firingSequenceRad` built as an occurrence of that
 * cylinder's own TDC angle. So every cylinder starts its power stroke at its
 * own TDC, as a real one does — the derivation answers to crank geometry, not
 * only to the firing order it came from, and the tests check both.
 *
 * **The shift cannot come from `crankPhaseRad`.** Crank phase is modulo 360°
 * while the cycle is 720°, so two cylinders whose pistons move identically —
 * an inline-4's cylinders 1 and 4, say — can be a full revolution apart in the
 * cycle. Only the layout's published `firingOrder`, walked into
 * `cylinderFiringAngleRad`, says which of a cylinder's two TDCs per cycle is
 * the firing one. That is engine-layer truth; how (or whether) it is *drawn*
 * is a separate, presentation-layer decision, made in `src/scene/`.
 *
 * Allocation-free and safe to call per cylinder per frame (§18): the firing
 * angles are a frozen lookup built once per layout.
 */
export function cylinderCycleAngleRad(
  layout: EngineLayoutDefinition,
  cylinderIndex: number,
  engineCycleAngleRadValue: number,
): number {
  const shifted =
    engineCycleAngleRadValue - cylinderFiringAngleRad(layout, cylinderIndex);
  return ((shifted % CYCLE_SPAN_RAD) + CYCLE_SPAN_RAD) % CYCLE_SPAN_RAD;
}

/**
 * Which stroke one cylinder of an engine is in, at an engine cycle angle (as
 * returned by `cycleAngleRad`). See `cylinderCycleAngleRad` for the convention
 * and its derivation; this is that shift followed by the same quarter split
 * `strokePhaseAt` applies, so cylinder 0 reduces to `strokePhaseAt` exactly.
 */
export function cylinderStrokePhaseAt(
  layout: EngineLayoutDefinition,
  cylinderIndex: number,
  engineCycleAngleRadValue: number,
): StrokePhase {
  return strokePhaseAt(
    cylinderCycleAngleRad(layout, cylinderIndex, engineCycleAngleRadValue),
  );
}
