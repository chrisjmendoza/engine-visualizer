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
 * This is a textbook idealization, not a claim about any real engine's valve
 * timing: `strokePhaseAt` divides the 720° cycle into four exact quarters,
 * while a real camshaft opens and closes valves well before and after those
 * boundaries (an intake valve typically opens before TDC and closes well
 * after BDC, for instance) to use the intake charge's own momentum. The
 * overlay exists to teach the *count* — four strokes, two crank revolutions,
 * one cycle — not to model actual valve events.
 */

import { TWO_PI } from "./constants";

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
