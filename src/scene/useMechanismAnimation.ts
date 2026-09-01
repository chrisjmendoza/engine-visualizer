/**
 * The animation loop for the crank mechanism (TECHNICAL_DESIGN.md §11, §18).
 *
 * Rules enforced here:
 * - The live crank angle lives in a ref, not in React state, so no component
 *   rerenders per frame.
 * - Playback advances the angle by Δθ = Δt × RPM × playbackSpeed × 2π / 60,
 *   with Δt clamped so an inactive browser tab cannot make the mechanism jump.
 *   `playbackSpeed` scales rendered motion only: every calculated readout
 *   still uses the true RPM, because 600 RPM is ten revolutions per second
 *   and would simply strobe at 60 fps.
 * - While paused (or scrubbing) the store is authoritative and the ref simply
 *   follows it, so play resumes from the scrubbed angle.
 * - The store is written at most READOUT_SYNC_HZ times per second, purely to
 *   mirror the angle into the readouts; it is never written per frame.
 * - The loop hands out the live angles and a store snapshot. Mechanism geometry
 *   comes from `calculateMechanismState`; this module never reimplements
 *   slider-crank math.
 *
 * One loop drives every mechanism on screen. While `rpmLinked` is set, engine
 * B's angle is *assigned* from engine A's rather than integrated separately:
 * two independent integrations of the same speed would accumulate different
 * floating-point error and slowly pull apart two engines the user was told are
 * locked together. Once unlinked, each engine integrates its own speed, which
 * is the whole point — a 9,000 rpm engine visibly outrunning a 7,000 rpm one.
 *
 * The same loop also tracks each engine's **revolution index**: which whole
 * shaft revolution, counted mod 6, the engine is currently on. Like the angle
 * itself it lives only in this loop's ref state and is mirrored into the store
 * at the throttled READOUT_SYNC_HZ cadence — never written per frame — and
 * engine B's index is assigned from engine A's while linked, exactly like its
 * angle. See `CrankRevolutionIndex` for why the counter is mod 6 and not the
 * parity bit it started life as.
 */

import { useFrame } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { READOUT_SYNC_HZ, TWO_PI } from "../engine/constants";
import type { RotorRevolutionIndex } from "../engine/rotaryCycle";
import { useEngineStore } from "../state/engineStore";

/** Largest frame delta the loop will integrate, in seconds. */
export const MAX_FRAME_DELTA_S = 0.1;

/**
 * Which whole shaft revolution of the current cycle an engine is on, counted
 * mod 6 — the one piece of cycle bookkeeping the wrapped angle cannot carry,
 * and the one counter both engine families read.
 *
 * A four-stroke piston engine's cycle is two crank revolutions, so it needs a
 * parity bit (`src/engine/cycle.ts`). A rotary's face cycle is three
 * eccentric-shaft revolutions, so it needs a mod-3 index
 * (`src/engine/rotaryCycle.ts`). Six is lcm(2, 3), so a single mod-6 counter
 * answers both questions exactly: `revolutionParityOf` takes `% 2` for the
 * piston side and `rotorRevolutionIndexOf` takes `% 3` for the rotary one.
 * Because 6 is even *and* divisible by 3, neither derivation loses anything to
 * the wrap — `(i mod 6) mod 2 = i mod 2` and `(i mod 6) mod 3 = i mod 3` — so
 * this generalization is exactly the old parity bit for every piston engine.
 *
 * One counter rather than two matters for more than tidiness: two counters
 * advanced side by side could disagree after a long clamped frame, and the
 * store would then have to mirror both.
 */
export type CrankRevolutionIndex = 0 | 1 | 2 | 3 | 4 | 5;

/** Revolutions in one full turn of the counter: lcm(2, 3). */
export const REVOLUTION_INDEX_SPAN = 6;

/**
 * Folds any integer revolution count into a `CrankRevolutionIndex`, negatives
 * included.
 *
 * Written as a switch rather than an index into a lookup table so that it is
 * total by construction and needs no type assertion: every branch returns a
 * literal the type already admits, and the modulo above it guarantees the
 * default is only ever reached for 0.
 */
export function revolutionIndexFrom(value: number): CrankRevolutionIndex {
  const wrapped =
    ((value % REVOLUTION_INDEX_SPAN) + REVOLUTION_INDEX_SPAN) %
    REVOLUTION_INDEX_SPAN;
  switch (wrapped) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    case 4:
      return 4;
    case 5:
      return 5;
    default:
      return 0;
  }
}

/**
 * The four-stroke revolution parity a piston engine reads from the shared
 * counter: which of the two crank revolutions of a 720° cycle is current.
 *
 * This is the whole of what `crankRevolutionParity` used to be, and every
 * consumer that wants a parity bit — the stroke badge, the chamber tint — goes
 * through here rather than taking `% 2` by hand.
 */
export function revolutionParityOf(index: CrankRevolutionIndex): 0 | 1 {
  return index % 2 === 0 ? 0 : 1;
}

/**
 * The rotor revolution a rotary engine reads from the shared counter: which of
 * the three eccentric-shaft revolutions of a 1080° face cycle is current
 * (`src/engine/rotaryCycle.ts`).
 *
 * This is also what places the rotor: its orientation is θ_total / 3, and a
 * wrapped θ alone puts the rotor 120° out for each revolution it has lost.
 */
export function rotorRevolutionIndexOf(
  index: CrankRevolutionIndex,
): RotorRevolutionIndex {
  switch (index % 3) {
    case 1:
      return 1;
    case 2:
      return 2;
    default:
      return 0;
  }
}

/** Snapshot of the global store, as read transiently inside the loop. */
export type EngineStoreState = ReturnType<typeof useEngineStore.getState>;

/** The live crank angle of each engine, in radians. */
export interface FrameAngles {
  crankAngleRad: number;
  /** Engine B's angle; identical to engine A's whenever the speeds are linked. */
  comparisonCrankAngleRad: number;
  /**
   * Which whole shaft revolution of engine A's cycle is current, mod 6
   * (`CrankRevolutionIndex`). Advanced alongside `crankAngleRad` by
   * `advanceRevolutionIndex`, never inferred from the angle alone — the
   * wrapped angle repeats every revolution and cannot say which one it is.
   */
  crankRevolutionIndex: CrankRevolutionIndex;
  /** Engine B's index; identical to engine A's whenever the speeds are linked. */
  comparisonCrankRevolutionIndex: CrankRevolutionIndex;
}

/**
 * Called once per frame with the live angles and the store snapshot the loop
 * read. Implementations are expected to mutate Three.js objects.
 *
 * The `angles` object is reused between frames — read from it, never retain it.
 */
export type MechanismFrameCallback = (
  angles: FrameAngles,
  store: EngineStoreState,
) => void;

export interface MechanismAnimation {
  /** The live angles, owned by the loop while playing. */
  anglesRef: RefObject<FrameAngles>;
  /** Recomputes and reapplies every mechanism at the current live angles. */
  applyCurrent: () => void;
}

/**
 * Advances the crank angle by one frame.
 *
 * Pure, so the integration rule can be tested without a WebGL context: the
 * frame delta is clamped, motion is scaled by the visual playback speed, and
 * the result is wrapped into [0, 2π).
 */
export function advanceCrankAngle(
  crankAngleRad: number,
  deltaS: number,
  rpm: number,
  playbackSpeed: number,
): number {
  const dt = Math.min(deltaS, MAX_FRAME_DELTA_S);
  const delta = (dt * rpm * playbackSpeed * TWO_PI) / 60;
  return (crankAngleRad + delta) % TWO_PI;
}

/**
 * Advances the shared revolution index for one frame, in lockstep with
 * `advanceCrankAngle`'s own integration (§11): recomputes the same clamped,
 * playback-scaled Δθ, counts how many whole revolutions it carries the shaft
 * through, and adds that count to the index mod 6.
 *
 * This deliberately does not just compare the old and new *wrapped* angle:
 * that can only ever detect a single wrap, but a long clamped frame delta (an
 * inactive tab, a high rpm, full playback speed) can carry the shaft through
 * several whole revolutions in one frame. Losing count by one is worse than a
 * merely late badge update — for a piston engine it would show two consecutive
 * strokes as the same one, and for a rotary it would draw the rotor 120° out
 * of place.
 *
 * Adding the whole-revolution count is the strict generalization of the parity
 * bit this replaced: that flipped when the count was odd, which is exactly
 * `(index + count) % 2` once the sum is taken mod an even number.
 */
export function advanceRevolutionIndex(
  crankAngleRad: number,
  revolutionIndex: CrankRevolutionIndex,
  deltaS: number,
  rpm: number,
  playbackSpeed: number,
): CrankRevolutionIndex {
  const dt = Math.min(deltaS, MAX_FRAME_DELTA_S);
  const delta = (dt * rpm * playbackSpeed * TWO_PI) / 60;
  const wholeRevolutions = Math.floor((crankAngleRad + delta) / TWO_PI);
  return revolutionIndexFrom(revolutionIndex + wholeRevolutions);
}

/**
 * Advances both engines by one frame, in place.
 *
 * `angles` is both the input and the output, so the loop can keep a single
 * object alive across frames and allocate nothing (§11).
 *
 * When `rpmLinked` is set, engine B is assigned engine A's new angle rather
 * than integrated at the same speed. Integrating twice would be mathematically
 * equivalent but not numerically identical — the two sums would diverge in the
 * low bits and, over minutes of playback, visibly desynchronize engines that
 * are supposed to be locked. Assignment makes the equality exact and free.
 *
 * Each engine's revolution index is advanced the same way its angle is:
 * integrated independently while unlinked, assigned from engine A while
 * linked. `advanceRevolutionIndex` reads `angles.crankAngleRad` *before* it is
 * overwritten below — how many revolutions a frame carries depends on where
 * the shaft started, not where it ends up.
 */
export function advanceEnginePair(
  angles: FrameAngles,
  deltaS: number,
  rpm: number,
  comparisonRpm: number,
  playbackSpeed: number,
  rpmLinked: boolean,
): void {
  angles.crankRevolutionIndex = advanceRevolutionIndex(
    angles.crankAngleRad,
    angles.crankRevolutionIndex,
    deltaS,
    rpm,
    playbackSpeed,
  );
  angles.crankAngleRad = advanceCrankAngle(
    angles.crankAngleRad,
    deltaS,
    rpm,
    playbackSpeed,
  );

  if (rpmLinked) {
    angles.comparisonCrankAngleRad = angles.crankAngleRad;
    angles.comparisonCrankRevolutionIndex = angles.crankRevolutionIndex;
  } else {
    angles.comparisonCrankRevolutionIndex = advanceRevolutionIndex(
      angles.comparisonCrankAngleRad,
      angles.comparisonCrankRevolutionIndex,
      deltaS,
      comparisonRpm,
      playbackSpeed,
    );
    angles.comparisonCrankAngleRad = advanceCrankAngle(
      angles.comparisonCrankAngleRad,
      deltaS,
      comparisonRpm,
      playbackSpeed,
    );
  }
}

/**
 * Runs the crank animation and hands each frame to `onFrame`.
 *
 * `onFrame` may change identity between renders; the latest one is always
 * used without re-registering the frame callback.
 */
export function useMechanismAnimation(
  onFrame: MechanismFrameCallback,
): MechanismAnimation {
  const anglesRef = useRef<FrameAngles>({
    crankAngleRad: useEngineStore.getState().crankAngleRad,
    comparisonCrankAngleRad: useEngineStore.getState().comparisonCrankAngleRad,
    crankRevolutionIndex: useEngineStore.getState().crankRevolutionIndex,
    comparisonCrankRevolutionIndex:
      useEngineStore.getState().comparisonCrankRevolutionIndex,
  });
  const lastSyncRef = useRef(0);
  const onFrameRef = useRef(onFrame);

  useLayoutEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useFrame((state, delta) => {
    // Transient read: no React subscription, so config, both RPMs, the link
    // state, playback speed, and the comparison engine are all picked up
    // immediately without rerendering the scene.
    const store = useEngineStore.getState();
    const angles = anglesRef.current;

    if (store.isPlaying) {
      advanceEnginePair(
        angles,
        delta,
        store.rpm,
        store.comparisonRpm,
        store.playbackSpeed,
        store.rpmLinked,
      );

      if (state.clock.elapsedTime - lastSyncRef.current > 1 / READOUT_SYNC_HZ) {
        lastSyncRef.current = state.clock.elapsedTime;
        store.syncCrankAngle(angles.crankAngleRad);
        store.syncCrankRevolutionIndex(angles.crankRevolutionIndex);
        // While linked the store keeps engine B's angle (and revolution index)
        // equal to engine A's itself, so mirroring them here every tick would
        // be a redundant write (and a redundant rerender of everything reading
        // it).
        if (!store.rpmLinked) {
          store.syncComparisonCrankAngle(angles.comparisonCrankAngleRad);
          store.syncComparisonCrankRevolutionIndex(
            angles.comparisonCrankRevolutionIndex,
          );
        }
      }
    } else {
      readPausedAngles(angles, store);
    }

    onFrameRef.current(angles, store);
  });

  const applyCurrent = useCallback(() => {
    const store = useEngineStore.getState();
    const angles = anglesRef.current;
    if (!store.isPlaying) {
      readPausedAngles(angles, store);
    }
    onFrameRef.current(angles, store);
  }, []);

  return { anglesRef, applyCurrent };
}

/**
 * Paused or scrubbed: the store owns both angles exactly, so playback resumes
 * from whatever was scrubbed to.
 *
 * While linked, engine B is taken from engine A rather than from its own store
 * field. Every store action keeps the two equal while linked, so this normally
 * reads the same value either way — but it also holds the guarantee if a
 * partial update (a share link carrying only engine A's angle, say) leaves
 * engine B's field behind. Linked engines are never drawn out of phase.
 *
 * The revolution index is read the same way, and deliberately *not* touched by
 * scrubbing itself: `scrubTo` (§11.1's scrub rule) only ever writes the
 * angle, never the index, so scrubbing to a new point on the 0–360° slider
 * keeps whichever revolution of the cycle was already current — which half of
 * a 720° four-stroke cycle, or which third of a rotary's 1080° one. A
 * multi-revolution scrub control is out of scope for this overlay.
 */
function readPausedAngles(angles: FrameAngles, store: EngineStoreState): void {
  angles.crankAngleRad = store.crankAngleRad;
  angles.comparisonCrankAngleRad = store.rpmLinked
    ? store.crankAngleRad
    : store.comparisonCrankAngleRad;
  angles.crankRevolutionIndex = store.crankRevolutionIndex;
  angles.comparisonCrankRevolutionIndex = store.rpmLinked
    ? store.crankRevolutionIndex
    : store.comparisonCrankRevolutionIndex;
}
