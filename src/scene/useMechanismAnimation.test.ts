/**
 * Tests the frame-advance rule in isolation.
 *
 * `advanceCrankAngle` and `advanceEnginePair` are pure, so the integration,
 * clamping, wrapping, playback-speed scaling, and the linked/unlinked
 * two-engine rule are all testable without a WebGL context. The parts of the
 * loop that need one — `useFrame` registration, the throttled store sync, and
 * the paused-state reads — are not covered here.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANIMATION,
  DEFAULT_PLAYBACK_SPEED,
  PLAYBACK_SPEEDS,
  TWO_PI,
} from "../engine/constants";
import {
  MAX_FRAME_DELTA_S,
  advanceCrankAngle,
  advanceEnginePair,
} from "./useMechanismAnimation";
import type { FrameAngles } from "./useMechanismAnimation";

/** Δθ for one frame at full speed, straight from the design formula (§11). */
function expectedDelta(deltaS: number, rpm: number, speed: number): number {
  return (deltaS * rpm * speed * TWO_PI) / 60;
}

describe("advanceCrankAngle", () => {
  it("advances by Δt × RPM × 2π / 60 at full playback speed", () => {
    // 600 RPM is 10 rev/s, so half a revolution takes 0.05 s.
    expect(advanceCrankAngle(0, 0.05, 600, 1)).toBeCloseTo(Math.PI, 10);
  });

  it("scales the advance by the playback speed", () => {
    const full = advanceCrankAngle(0, 0.01, 600, 1);

    for (const speed of PLAYBACK_SPEEDS) {
      expect(advanceCrankAngle(0, 0.01, 600, speed)).toBeCloseTo(
        full * speed,
        10,
      );
    }
  });

  it("slows rendered motion at the default speed without changing the rule", () => {
    // Referenced from the constant rather than hardcoded: the default is a
    // presentation choice that may be retuned, but the rule must not change.
    const speed = DEFAULT_PLAYBACK_SPEED;
    const rpm = DEFAULT_ANIMATION.rpm;
    const slowed = advanceCrankAngle(0, 0.016, rpm, speed);

    expect(slowed).toBeCloseTo(expectedDelta(0.016, rpm, speed), 10);
    // A fraction of the real-time advance: visible rotation, not strobing.
    expect(slowed).toBeCloseTo(advanceCrankAngle(0, 0.016, rpm, 1) * speed, 10);
    expect(speed).toBeGreaterThan(0);
    expect(speed).toBeLessThanOrEqual(1);
  });

  it("clamps long frame deltas so an inactive tab cannot jump the mechanism", () => {
    const clamped = advanceCrankAngle(0, 30, 120, 1);
    expect(clamped).toBeCloseTo(
      advanceCrankAngle(0, MAX_FRAME_DELTA_S, 120, 1),
      10,
    );
  });

  it("wraps into [0, 2π)", () => {
    let angle = 0;
    for (let i = 0; i < 500; i += 1) {
      angle = advanceCrankAngle(angle, 0.016, 6000, 1);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThan(TWO_PI);
    }
  });

  it("holds the angle still at zero RPM", () => {
    expect(advanceCrankAngle(1.234, 0.016, 0, 1)).toBeCloseTo(1.234, 12);
  });

  it("is unaffected by the angle's starting point", () => {
    const delta = expectedDelta(0.01, 900, 0.25);
    expect(advanceCrankAngle(2, 0.01, 900, 0.25)).toBeCloseTo(2 + delta, 10);
  });
});

/**
 * Rotation between two wrapped angles, undoing the [0, 2π) wrap.
 *
 * Only recovers a single wrap, so callers must keep each frame's rotation
 * under one revolution — which is the regime playback speed exists to create.
 */
function unwrappedDelta(previous: number, next: number): number {
  return next >= previous ? next - previous : next + TWO_PI - previous;
}

/**
 * Runs both engines for a number of frames and returns the live angles plus
 * each engine's total unwrapped rotation, so revolutions can be counted across
 * the wrap that `advanceCrankAngle` applies.
 */
function runPair(options: {
  frames: number;
  deltaS: number;
  rpm: number;
  comparisonRpm: number;
  playbackSpeed: number;
  rpmLinked: boolean;
}) {
  const live: FrameAngles = { crankAngleRad: 0, comparisonCrankAngleRad: 0 };
  let totalA = 0;
  let totalB = 0;

  for (let i = 0; i < options.frames; i += 1) {
    const previousA = live.crankAngleRad;
    const previousB = live.comparisonCrankAngleRad;
    advanceEnginePair(
      live,
      options.deltaS,
      options.rpm,
      options.comparisonRpm,
      options.playbackSpeed,
      options.rpmLinked,
    );
    totalA += unwrappedDelta(previousA, live.crankAngleRad);
    totalB += unwrappedDelta(previousB, live.comparisonCrankAngleRad);
  }

  return { live, totalA, totalB };
}

describe("advanceEnginePair", () => {
  const DT = 1 / 60;

  function angles(a = 0, b = 0): FrameAngles {
    return { crankAngleRad: a, comparisonCrankAngleRad: b };
  }

  it("advances both engines in place without allocating a new object", () => {
    const live = angles();
    advanceEnginePair(live, DT, 6000, 3000, 1, false);

    // The same object is carried across frames by the loop.
    expect(live.crankAngleRad).toBeGreaterThan(0);
    expect(live.comparisonCrankAngleRad).toBeGreaterThan(0);
  });

  describe("linked", () => {
    it("keeps both angles bit-identical over many frames", () => {
      const live = angles();

      for (let i = 0; i < 10_000; i += 1) {
        advanceEnginePair(live, DT, 7000, 3210, 0.1, true);
        // Exact equality, not approximate: linked engines must never drift
        // apart in the low bits over a long session.
        expect(live.comparisonCrankAngleRad).toBe(live.crankAngleRad);
      }
    });

    it("ignores engine B's own rpm entirely", () => {
      const shared = angles();
      const wildlyDifferent = angles();

      for (let i = 0; i < 200; i += 1) {
        advanceEnginePair(shared, DT, 5000, 5000, 1, true);
        advanceEnginePair(wildlyDifferent, DT, 5000, 9999, 1, true);
      }

      expect(wildlyDifferent.comparisonCrankAngleRad).toBe(
        shared.comparisonCrankAngleRad,
      );
      expect(wildlyDifferent.crankAngleRad).toBe(shared.crankAngleRad);
    });

    it("pulls a diverged engine B back onto engine A immediately", () => {
      // As if the user had just re-linked mid-run, with B far out of phase.
      const live = angles(0.25, 4.5);
      advanceEnginePair(live, DT, 6000, 1000, 1, true);

      expect(live.comparisonCrankAngleRad).toBe(live.crankAngleRad);
    });
  });

  describe("unlinked", () => {
    it("lets each engine run at its own speed", () => {
      // A tenth speed keeps one frame under a full revolution, so the raw
      // angles can be compared against the formula without unwrapping.
      const live = angles();
      advanceEnginePair(live, DT, 9000, 7000, 0.1, false);

      expect(live.crankAngleRad).toBeCloseTo(expectedDelta(DT, 9000, 0.1), 10);
      expect(live.comparisonCrankAngleRad).toBeCloseTo(
        expectedDelta(DT, 7000, 0.1),
        10,
      );
      expect(live.crankAngleRad).toBeGreaterThan(live.comparisonCrankAngleRad);
    });

    it("accumulates exactly twice the rotation at twice the rpm", () => {
      const { totalA, totalB } = runPair({
        frames: 600,
        deltaS: DT,
        rpm: 8000,
        comparisonRpm: 4000,
        playbackSpeed: 0.1,
        rpmLinked: false,
      });

      expect(totalA).toBeCloseTo(totalB * 2, 8);
      // Ten seconds of frames at a tenth speed: 8,000 rpm covers 1,333 rev.
      expect(totalA / TWO_PI).toBeCloseTo((8000 / 60) * (600 * DT) * 0.1, 8);
    });

    it("gains a full revolution on the slower engine at the expected rate", () => {
      // 9,000 rpm against 7,000 gains 2,000 rev/min: one revolution of lead
      // every 30 ms of engine time, or 300 ms at the tenth-speed default —
      // which is 18 frames at 60 fps.
      const { totalA, totalB } = runPair({
        frames: 18,
        deltaS: DT,
        rpm: 9000,
        comparisonRpm: 7000,
        playbackSpeed: 0.1,
        rpmLinked: false,
      });

      expect(totalA).toBeGreaterThan(totalB);
      expect(totalA - totalB).toBeCloseTo(TWO_PI, 8);
    });

    it("holds engine B still while engine A runs, at zero comparison rpm", () => {
      const live = angles();

      for (let i = 0; i < 50; i += 1) {
        advanceEnginePair(live, DT, 6000, 0, 1, false);
      }

      expect(live.comparisonCrankAngleRad).toBe(0);
      expect(live.crankAngleRad).toBeGreaterThan(0);
    });

    it("keeps both angles wrapped into [0, 2π)", () => {
      const live = angles();

      for (let i = 0; i < 500; i += 1) {
        advanceEnginePair(live, DT, 9000, 7000, 1, false);
        expect(live.crankAngleRad).toBeGreaterThanOrEqual(0);
        expect(live.crankAngleRad).toBeLessThan(TWO_PI);
        expect(live.comparisonCrankAngleRad).toBeGreaterThanOrEqual(0);
        expect(live.comparisonCrankAngleRad).toBeLessThan(TWO_PI);
      }
    });

    it("clamps a long frame delta for both engines", () => {
      const live = angles();
      advanceEnginePair(live, 30, 6000, 3000, 1, false);

      expect(live.crankAngleRad).toBeCloseTo(
        advanceCrankAngle(0, MAX_FRAME_DELTA_S, 6000, 1),
        10,
      );
      expect(live.comparisonCrankAngleRad).toBeCloseTo(
        advanceCrankAngle(0, MAX_FRAME_DELTA_S, 3000, 1),
        10,
      );
    });

    it("scales both engines by the shared playback speed", () => {
      // Both speeds keep a frame under one revolution, so the accumulated
      // totals stay recoverable; 0.05 is a quarter of 0.2.
      const faster = runPair({
        frames: 30,
        deltaS: DT,
        rpm: 9000,
        comparisonRpm: 7000,
        playbackSpeed: 0.2,
        rpmLinked: false,
      });
      const quarter = runPair({
        frames: 30,
        deltaS: DT,
        rpm: 9000,
        comparisonRpm: 7000,
        playbackSpeed: 0.05,
        rpmLinked: false,
      });

      expect(quarter.totalA).toBeCloseTo(faster.totalA * 0.25, 8);
      expect(quarter.totalB).toBeCloseTo(faster.totalB * 0.25, 8);
    });
  });
});
