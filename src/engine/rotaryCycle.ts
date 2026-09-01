/**
 * The rotary four-phase cycle (TECHNICAL_DESIGN.md §27) — the rotary family's
 * `cycle.ts`, deliberately built to the same shape so that `src/scene/` can
 * tint rotor faces exactly the way `chamberTint.ts` tints cylinders.
 *
 * The correspondence is one-for-one:
 *
 *     piston                          rotary
 *     ──────────────────────────      ──────────────────────────────────
 *     cycle spans 720° of crank       cycle spans 1080° of eccentric shaft
 *     four 180° strokes               four 270° phases
 *     revolutionParity 0|1            rotorRevolutionIndex 0|1|2
 *     cycleAngleRad                   rotaryCycleAngleRad
 *     strokePhaseAt                   rotaryPhaseAt
 *     cylinderCycleAngleRad           rotorFaceCycleAngleRad
 *     cylinderStrokePhaseAt           rotorFacePhaseAt
 *     firingSequenceRad               rotaryFiringSequenceRad
 *
 * and the `StrokePhase` enum itself is *reused*, not duplicated: a rotary's
 * intake, compression, power, and exhaust are the same four events, however
 * differently they are swept. Only the arithmetic differs, and only because
 * the rotor turns once per three shaft revolutions rather than the piston
 * engine's one cycle per two.
 *
 * ## Why 1080°, and why the loop must supply a revolution index
 *
 * Each of a rotor's three faces completes one full four-phase cycle per
 * **rotor** revolution, and the rotor turns at a third of shaft speed, so one
 * face cycle is 3 × 360° = 1080° of eccentric shaft. The animation loop only
 * ever tracks θ wrapped into [0, 2π), which cannot tell the first shaft
 * revolution of a cycle from the third — the same blindness `cycle.ts`
 * solves with a parity bit, solved here with a mod-3 index. One counter serves
 * both families: the loop keeps a revolution index mod 6 (= lcm(2, 3)), the
 * piston side reads `% 2` and the rotary side `% 3`. Tracking that counter is
 * loop bookkeeping, so it lives in `src/scene/useMechanismAnimation.ts`; this
 * module only ever consumes it.
 *
 * ## Where the cycle is anchored, and how that was found
 *
 * Nothing above says *where* in the 1080° a face's power phase begins. That
 * comes from the geometry, and it was located numerically before it was
 * written down (`rotaryCycle.test.ts` re-locates it from
 * `chamberAreaMm2` rather than trusting the constant).
 *
 * Face k's chamber occupies the housing arc `α ∈ [α₀, α₀ + 2π/3]` with
 * α₀ = θ/3 + 2πk/3, and its area works out in closed form to
 *
 *     Area(α₀) = C − (3√3/2)·e·R·cos(2α₀ − π/3)
 *
 * — an exact sinusoid in α₀ (the derivation and its numerical confirmation are
 * in `rotaryCalculations.ts`). Three consequences follow, and all three are
 * asserted:
 *
 * 1. **Minimum volume** at `cos(2α₀ − π/3) = 1`, i.e. α₀ = π/6 (mod π), which
 *    for face 0 is **θ = 90°** (mod 540°). That is the chamber squeezed
 *    against the housing waist — the rotary's TDC.
 * 2. **Period 540° of shaft**, since α₀ advances π for every 3π of θ. So each
 *    face passes through *two* minima and two maxima per 1080° cycle, 270°
 *    apart, which is exactly where the four phase boundaries fall.
 * 3. Face k's minima sit at `θ = π/2 − 2πk` (mod 540°), so consecutive faces
 *    are **360° of shaft apart** in the cycle — one firing per shaft
 *    revolution per rotor.
 *
 * ### The one thing geometry cannot decide
 *
 * A face has two minima per cycle and they are geometrically identical (that
 * is what the 540° period *means*). Which one is the firing one is set by
 * where the intake and exhaust ports are cut, not by the trochoid — the same
 * kind of fact as a piston engine's firing order, which no crank table
 * implies. We fix the convention here, once: **face 0 fires at θ = 90°**, its
 * first minimum. Choosing the other would shift every face's cycle by 540°,
 * swapping intake with power; it would not change the firing *order* or the
 * intervals, both of which are geometric.
 *
 * ## The resulting cycle, and its fixed point
 *
 * A face's own cycle angle γ runs over [0, 1080°) with the phase boundaries at
 * quarters, matching `strokePhaseAt`'s layout exactly:
 *
 *     [0°,    270°)  intake       volume rising from minimum
 *     [270°,  540°)  compression  volume falling to minimum
 *     [540°,  810°)  power        fires at 540° — minimum volume
 *     [810°, 1080°)  exhaust      volume falling to minimum
 *
 * That puts the firing event at **half the cycle**, precisely where
 * `cycle.ts` puts a cylinder's (2π of 4π). So `rotorFaceCycleAngleRad` is the
 * shaft cycle angle shifted so that face k's minimum-volume moment lands on
 * 540°, and the volume closed form reduces to the pleasing
 * `V(γ) = Vc + (Vd/2)·(1 − cos(2γ/3))` — minimum at γ = 0 and γ = 540°,
 * maximum at 270° and 810°, exactly as the table says.
 */

import { TWO_PI } from "./constants";
import type { StrokePhase } from "./cycle";
import { ROTOR_FACE_COUNT, SHAFT_REVS_PER_ROTOR_REV } from "./rotaryConstants";
import type { RotaryRotorCount } from "./rotaryTypes";

/**
 * One complete rotary cycle: three eccentric-shaft revolutions, 1080°. The
 * analog of `cycle.ts`'s 720° `CYCLE_SPAN_RAD`.
 */
export const ROTARY_CYCLE_SPAN_RAD = SHAFT_REVS_PER_ROTOR_REV * TWO_PI;

/** One of the four phases: a quarter of the cycle, 270° of shaft. */
export const ROTARY_PHASE_SPAN_RAD = ROTARY_CYCLE_SPAN_RAD / 4;

/**
 * Which shaft revolution of the current cycle we are in. The piston family's
 * `revolutionParity: 0 | 1` generalized: the loop's mod-6 counter feeds `% 2`
 * to one family and `% 3` to this one.
 */
export type RotorRevolutionIndex = 0 | 1 | 2;

/**
 * The shaft angle at which face 0 reaches minimum chamber volume and begins
 * its power phase: 90°.
 *
 * Located from the geometry (see the header), not assumed — and re-located by
 * the tests from a numerical area sweep, so a change to the coordinate
 * convention cannot silently leave this stale.
 */
export const ROTOR_FACE_ANCHOR_SHAFT_ANGLE_RAD = Math.PI / 2;

/**
 * Shaft-angle spacing between consecutive faces' firings: face k fires 360°
 * of shaft *before* face k−1, i.e. its anchor is `anchor₀ − 2πk`.
 *
 * The sign is not free — it follows from indexing face k as the flank between
 * apex k and apex k+1, with apex k at rotor angle φ + 2πk/3. Getting it
 * backwards would still produce evenly spaced firings, which is why the tests
 * check each face's anchor against that face's *own* numerically located area
 * minimum rather than merely checking the intervals.
 */
export const ROTOR_FACE_PITCH_SHAFT_RAD = TWO_PI;

/** Cycle angle at which a face fires: half the cycle, mirroring `cycle.ts`. */
export const ROTARY_FIRING_CYCLE_ANGLE_RAD = ROTARY_CYCLE_SPAN_RAD / 2;

/**
 * Rotor phase offsets, in **shaft** radians, for each supported rotor count —
 * the rotary's `firingOrder` analog, and like it, a statement about a real
 * engine rather than something derived.
 *
 * The eccentric shaft's lobes are spaced evenly around it, so an n-rotor
 * engine phases its rotors at 360°/n of shaft: a two-rotor 13B at 0°/180°, a
 * three-rotor 20B at 0°/120°/240°. Each rotor fires three times per 1080°
 * cycle, so n rotors give 3n evenly spaced firings — one every 360°/n of
 * shaft. That is the 180° firing interval a 13B is known for and the 120° of a
 * 20B, and `rotaryFiringIntervalsRad` derives both rather than asserting them.
 *
 * The *sign* of a phase only permutes which rotor fires when; it cannot make
 * the intervals uneven, so the choice below is a convention, not data.
 */
export const ROTARY_ROTOR_PHASES: Readonly<
  Record<RotaryRotorCount, readonly number[]>
> = Object.freeze({
  1: Object.freeze([0]),
  2: Object.freeze([0, Math.PI]),
  3: Object.freeze([0, TWO_PI / 3, (2 * TWO_PI) / 3]),
});

/**
 * Folds any angle into [0, 1080°).
 *
 * Written as a conditional rather than the usual `((x % s) + s) % s` because
 * that idiom is not exact: for an angle already in range it adds a full cycle
 * and takes it away again, and the round trip can cost a ulp — enough to read
 * an angle sitting exactly on a phase boundary as belonging to the phase
 * before it. Same shape as `normalizeAngleRad`, one cycle instead of one
 * revolution.
 */
function wrapCycle(angleRad: number): number {
  const wrapped = angleRad % ROTARY_CYCLE_SPAN_RAD;
  return wrapped < 0 ? wrapped + ROTARY_CYCLE_SPAN_RAD : wrapped;
}

/**
 * Folds an eccentric-shaft angle and a rotor-revolution index into the cycle's
 * own domain, [0, 6π) — one complete rotary cycle. The direct analog of
 * `cycleAngleRad`, including its defensiveness: `shaftAngleRad` is wrapped
 * into [0, 2π) here rather than trusted as pre-normalized, because this
 * function's job is combining an angle with bookkeeping the caller tracks
 * externally and it should not additionally constrain that caller's input.
 */
export function rotaryCycleAngleRad(
  shaftAngleRad: number,
  rotorRevolutionIndex: RotorRevolutionIndex,
): number {
  const wrapped = ((shaftAngleRad % TWO_PI) + TWO_PI) % TWO_PI;
  return wrapped + rotorRevolutionIndex * TWO_PI;
}

/**
 * Which phase a *face cycle angle* (as returned by `rotorFaceCycleAngleRad`)
 * falls in, under the idealization that each phase is exactly a quarter of the
 * 1080° cycle — the same idealization, and the same caveat, as
 * `strokePhaseAt`: a real rotary's port timing opens and closes well away from
 * these boundaries, and this overlay exists to teach the *count*, not to model
 * port events.
 *
 * The input is folded into [0, 1080°) first, so a value at or past the cycle
 * boundary reads as the start of the next cycle's intake rather than silently
 * reporting "exhaust" past the end of its domain.
 */
export function rotaryPhaseAt(faceCycleAngleRad: number): StrokePhase {
  const wrapped = wrapCycle(faceCycleAngleRad);

  if (wrapped < ROTARY_PHASE_SPAN_RAD) return "intake";
  if (wrapped < 2 * ROTARY_PHASE_SPAN_RAD) return "compression";
  if (wrapped < 3 * ROTARY_PHASE_SPAN_RAD) return "power";
  return "exhaust";
}

/**
 * The shaft angle within the cycle, in [0, 1080°), at which one face of one
 * rotor fires — i.e. reaches the minimum-volume moment that begins its power
 * phase.
 *
 * `rotorPhaseRad` shifts the whole rotor: a phased rotor is an unphased rotor
 * evaluated at `θ + phase` (see `rotorAngleRad`), so its anchors move *back*
 * by the phase.
 */
export function rotorFaceFiringShaftAngleRad(
  faceIndex: number,
  rotorPhaseRad = 0,
): number {
  return wrapCycle(
    ROTOR_FACE_ANCHOR_SHAFT_ANGLE_RAD -
      ROTOR_FACE_PITCH_SHAFT_RAD * faceIndex -
      rotorPhaseRad,
  );
}

/**
 * One face's own cycle angle, in [0, 1080°), from the engine's shaft cycle
 * angle — the analog of `cylinderCycleAngleRad`, and built from the same
 * relation:
 *
 *     faceCycleAngle = shaftCycleAngle − firingShaftAngle + firingCycleAngle
 *
 * Check it against the fixed point: at the shaft angle where face k fires, the
 * first two terms cancel and the result is `ROTARY_FIRING_CYCLE_ANGLE_RAD`
 * (540°), the middle of the cycle, which `rotaryPhaseAt` reads as the first
 * instant of the power phase. Face 0 of an unphased rotor therefore fires at
 * shaft angle 90° and nowhere else, which is precisely the anchor the area
 * sweep located.
 *
 * Allocation-free and safe to call per face per frame (§18) — it is three
 * additions and a modulo, with no lookup table needed, because unlike a piston
 * engine's firing order the face offsets are pure geometry.
 */
export function rotorFaceCycleAngleRad(
  faceIndex: number,
  shaftCycleAngleRad: number,
  rotorPhaseRad = 0,
): number {
  return wrapCycle(
    shaftCycleAngleRad -
      rotorFaceFiringShaftAngleRad(faceIndex, rotorPhaseRad) +
      ROTARY_FIRING_CYCLE_ANGLE_RAD,
  );
}

/**
 * Which phase one rotor face is in, at an engine shaft cycle angle (as
 * returned by `rotaryCycleAngleRad`).
 *
 * This is the function the scene's face tint is driven from — the rotary's
 * `cylinderStrokePhaseAt`. It is pure, configuration-independent (chamber
 * *shape* varies with R, e, and b; chamber *timing* does not), and cheap
 * enough to call for every face of every rotor on every frame, though the
 * scene should still write to materials only on a phase *change*, exactly as
 * `chamberTint.ts` does.
 */
export function rotorFacePhaseAt(
  faceIndex: number,
  shaftCycleAngleRad: number,
  rotorPhaseRad = 0,
): StrokePhase {
  return rotaryPhaseAt(
    rotorFaceCycleAngleRad(faceIndex, shaftCycleAngleRad, rotorPhaseRad),
  );
}

/** One face's power phase beginning, within the 1080° cycle. */
export interface RotaryFiringEvent {
  /** Index of the rotor that fires, 0-based along the shaft. */
  rotorIndex: number;
  /** Which of that rotor's three faces fires. */
  faceIndex: number;
  /** Shaft angle of that firing, radians in [0, 6π). */
  shaftAngleRad: number;
}

/**
 * Every firing in one 1080° cycle for an engine of `rotorCount` rotors, in
 * shaft-angle order — the analog of `firingSequenceRad`.
 *
 * Unlike the piston version there is no published firing order to walk: a
 * rotary's firing sequence is fully determined by its rotor phasing and the
 * geometric face anchors, so this *derives* the sequence and the tests check
 * the derivation against the known 180°-per-firing 13B and 120°-per-firing
 * 20B behavior.
 *
 * Allocates; call once per rotor count, not per frame.
 */
export function rotaryFiringSequenceRad(
  rotorCount: RotaryRotorCount,
): readonly RotaryFiringEvent[] {
  const phases = ROTARY_ROTOR_PHASES[rotorCount];
  const events: RotaryFiringEvent[] = [];

  phases.forEach((rotorPhaseRad, rotorIndex) => {
    for (let faceIndex = 0; faceIndex < ROTOR_FACE_COUNT; faceIndex += 1) {
      events.push({
        rotorIndex,
        faceIndex,
        shaftAngleRad: rotorFaceFiringShaftAngleRad(faceIndex, rotorPhaseRad),
      });
    }
  });

  events.sort((a, b) => a.shaftAngleRad - b.shaftAngleRad);
  return events;
}

/**
 * The gaps between consecutive firings over one 1080° cycle, including the
 * wrap from the last firing back to the first of the next cycle. Always sums
 * to 6π, and — because rotor phases are evenly spaced and face anchors are
 * 360° apart — always comes out even at 360°/rotorCount.
 */
export function rotaryFiringIntervalsRad(
  rotorCount: RotaryRotorCount,
): readonly number[] {
  const events = rotaryFiringSequenceRad(rotorCount);
  // The wrap term differs from `firingIntervalsRad`'s: a piston layout's
  // cylinder 0 fires at exactly 0, so its wrap is just the cycle span minus
  // the last firing. A rotary's first firing sits wherever the geometric
  // anchor puts it (90° for an unphased rotor), so the first firing's angle
  // has to be added back in.
  const first = events[0] as RotaryFiringEvent;
  return events.map((event, i) =>
    i + 1 < events.length
      ? (events[i + 1] as RotaryFiringEvent).shaftAngleRad - event.shaftAngleRad
      : ROTARY_CYCLE_SPAN_RAD - event.shaftAngleRad + first.shaftAngleRad,
  );
}
