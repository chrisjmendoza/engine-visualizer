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
  REVOLUTION_INDEX_SPAN,
  advanceCrankAngle,
  advanceEnginePair,
  advanceRevolutionIndex,
  revolutionIndexFrom,
  revolutionParityOf,
  rotorRevolutionIndexOf,
} from "./useMechanismAnimation";
import type {
  CrankRevolutionIndex,
  FrameAngles,
} from "./useMechanismAnimation";

/**
 * The four-stroke parity the piston family reads out of the shared mod-6
 * counter, applied to one frame's advance.
 *
 * Every assertion in the parity suite below was written against the counter
 * this replaced, `advanceRevolutionParity`, and is preserved verbatim through
 * this shim: if the generalization changed piston behavior by so much as a
 * flip, these fail.
 */
function advanceParity(
  crankAngleRad: number,
  parity: 0 | 1,
  deltaS: number,
  rpm: number,
  playbackSpeed: number,
): 0 | 1 {
  return revolutionParityOf(
    advanceRevolutionIndex(crankAngleRad, parity, deltaS, rpm, playbackSpeed),
  );
}

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
  const live: FrameAngles = {
    crankAngleRad: 0,
    comparisonCrankAngleRad: 0,
    crankRevolutionIndex: 0,
    comparisonCrankRevolutionIndex: 0,
  };
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

/** Builds a `FrameAngles` literal, defaulting both engines to angle 0 / index 0. */
function angles(
  a = 0,
  b = 0,
  indexA: CrankRevolutionIndex = 0,
  indexB: CrankRevolutionIndex = 0,
): FrameAngles {
  return {
    crankAngleRad: a,
    comparisonCrankAngleRad: b,
    crankRevolutionIndex: indexA,
    comparisonCrankRevolutionIndex: indexB,
  };
}

describe("advanceEnginePair", () => {
  const DT = 1 / 60;

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

/**
 * Tests the four-stroke revolution-parity bit (`src/engine/cycle.ts`'s
 * overlay) in isolation, mirroring the `advanceCrankAngle` tests above:
 * `advanceRevolutionIndex` is pure, so the wrap-counting rule it derives the
 * parity from is testable without a WebGL context. Every case here predates
 * the mod-6 generalization and is kept in `% 2` form (`advanceParity`), which
 * is what proves the piston family's behavior is unchanged.
 */
describe("advanceRevolutionIndex — four-stroke parity", () => {
  it("does not flip when the frame's advance stays within the current revolution", () => {
    // 90 degrees at 600 rpm, well short of a full revolution.
    expect(advanceParity(0, 0, 0.025, 600, 1)).toBe(0);
    expect(advanceParity(0, 1, 0.025, 600, 1)).toBe(1);
  });

  it("flips exactly once when the frame's advance crosses a single revolution boundary", () => {
    // Starting just before a full turn and advancing past it.
    const justBeforeWrap = TWO_PI - 0.01;
    expect(advanceParity(justBeforeWrap, 0, 0.025, 600, 1)).toBe(1);
    expect(advanceParity(justBeforeWrap, 1, 0.025, 600, 1)).toBe(0);
  });

  it("does not flip when the frame's advance crosses two revolution boundaries", () => {
    // 6,000 rpm is 100 rev/s, so 0.025 s (under the clamp) covers 2.5
    // revolutions — comfortably past two boundaries (floor 2, even) and
    // clear of the next one, so floating-point rounding cannot tip this
    // into the odd case.
    expect(advanceParity(0, 0, 0.025, 6000, 1)).toBe(0);
    expect(advanceParity(0, 1, 0.025, 6000, 1)).toBe(1);
  });

  it("resolves several whole revolutions within one frame correctly, even vs odd", () => {
    // 6,000 rpm is 100 rev/s. 0.085 s covers 8.5 revolutions (floors to 8,
    // even: no flip); 0.095 s covers 9.5 (floors to 9, odd: flips). Both
    // sit half a revolution clear of an integer boundary, so floating-point
    // rounding cannot tip either result the wrong way — this is the
    // inactive-tab scenario a single old/new wrapped-angle comparison could
    // not resolve at all.
    expect(advanceParity(0, 0, 0.085, 6000, 1)).toBe(0);
    expect(advanceParity(0, 0, 0.095, 6000, 1)).toBe(1);
  });

  it("never flips at zero rpm", () => {
    expect(advanceParity(1.23, 0, 0.5, 0, 1)).toBe(0);
    expect(advanceParity(1.23, 1, 0.5, 0, 1)).toBe(1);
  });

  it("clamps the frame delta exactly like advanceCrankAngle", () => {
    // A huge, unclamped delta at this rpm would cross far more boundaries
    // than the clamped one; the two must agree once both are clamped.
    const long = advanceParity(0, 0, 30, 6000, 1);
    const clamped = advanceParity(0, 0, MAX_FRAME_DELTA_S, 6000, 1);
    expect(long).toBe(clamped);
  });
});

describe("advanceEnginePair — revolution index", () => {
  const DT = 1 / 60;

  it("flips engine A's parity exactly once per crank revolution", () => {
    const live = angles();
    let flips = 0;
    let previousParity = revolutionParityOf(live.crankRevolutionIndex);

    // 360 rpm is 6 rev/s, so each 1/60 s frame covers a tenth of a
    // revolution — comfortably under one full turn, so each frame crosses
    // at most one boundary and every flip is caught by a plain consecutive
    // comparison. 100 frames cover exactly 10 revolutions, so parity must
    // flip exactly 10 times.
    for (let i = 0; i < 100; i += 1) {
      advanceEnginePair(live, DT, 360, 360, 1, true);
      if (revolutionParityOf(live.crankRevolutionIndex) !== previousParity) {
        flips += 1;
        previousParity = revolutionParityOf(live.crankRevolutionIndex);
      }
    }

    expect(flips).toBe(10);
  });

  describe("linked", () => {
    it("assigns engine B's parity from engine A's, not integrating it separately", () => {
      const live = angles(0, 0, 0, 1);
      advanceEnginePair(live, DT, 9000, 1234, 1, true);

      expect(live.comparisonCrankRevolutionIndex).toBe(
        live.crankRevolutionIndex,
      );
    });

    it("pulls a diverged engine B's parity back onto engine A's immediately", () => {
      const live = angles(0.25, 4.5, 0, 1);
      advanceEnginePair(live, DT, 6000, 1000, 1, true);

      expect(live.comparisonCrankRevolutionIndex).toBe(
        live.crankRevolutionIndex,
      );
    });
  });

  describe("unlinked", () => {
    it("advances each engine's parity from its own speed, independently", () => {
      const live = angles();

      // Engine A at 180 rpm (0.05 rev/frame) covers 200 * 0.05 = 10 whole
      // revolutions over 200 frames — an even count, so parity returns to
      // 0. Engine B at 90 rpm (0.025 rev/frame) covers 200 * 0.025 = 5
      // whole revolutions — an odd count, so parity flips to 1. Sharing a
      // frame loop but not a speed, and ending up with different parities
      // as a result, is exactly what "unlinked" means.
      for (let i = 0; i < 200; i += 1) {
        advanceEnginePair(live, DT, 180, 90, 1, false);
      }

      expect(revolutionParityOf(live.crankRevolutionIndex)).toBe(0);
      expect(revolutionParityOf(live.comparisonCrankRevolutionIndex)).toBe(1);
    });

    it("reads engine A's angle before it is overwritten, so parity reflects where the frame started", () => {
      // Starting just before a wrap: the parity update must see the
      // pre-advance angle, not the already-wrapped post-advance one.
      const live = angles(TWO_PI - 0.001, 0, 0, 0);
      advanceEnginePair(live, DT, 600, 600, 1, false);

      expect(live.crankAngleRad).toBeLessThan(TWO_PI - 0.001);
      expect(revolutionParityOf(live.crankRevolutionIndex)).toBe(1);
    });
  });
});

/**
 * The mod-6 counter's own arithmetic (§27): the two derivations it exists to
 * serve, and the multi-wrap safety the parity bit already had.
 *
 * A piston engine only ever needed `% 2`, so nothing above could tell a
 * counter that runs 0,1,0,1 from one that runs 0..5. These do.
 */
describe("revolutionIndexFrom", () => {
  it("is the identity on its own domain", () => {
    for (const index of [0, 1, 2, 3, 4, 5] as const) {
      expect(revolutionIndexFrom(index)).toBe(index);
    }
  });

  it("folds counts above and below the domain, including negatives", () => {
    expect(revolutionIndexFrom(REVOLUTION_INDEX_SPAN)).toBe(0);
    expect(revolutionIndexFrom(REVOLUTION_INDEX_SPAN + 4)).toBe(4);
    expect(revolutionIndexFrom(3 * REVOLUTION_INDEX_SPAN + 2)).toBe(2);
    expect(revolutionIndexFrom(-1)).toBe(5);
    expect(revolutionIndexFrom(-REVOLUTION_INDEX_SPAN)).toBe(0);
    expect(revolutionIndexFrom(-8)).toBe(4);
  });
});

describe("revolutionParityOf / rotorRevolutionIndexOf", () => {
  it("reads the counter as `% 2` for the piston family and `% 3` for the rotary", () => {
    const parities = [0, 1, 0, 1, 0, 1];
    const rotorIndexes = [0, 1, 2, 0, 1, 2];

    for (const index of [0, 1, 2, 3, 4, 5] as const) {
      expect(revolutionParityOf(index)).toBe(parities[index]);
      expect(rotorRevolutionIndexOf(index)).toBe(rotorIndexes[index]);
    }
  });

  it("loses nothing to the wrap, because 6 is a multiple of both 2 and 3", () => {
    // The property the choice of 6 rests on: folding a running revolution
    // count into [0, 6) before taking `% 2` or `% 3` gives the same answer as
    // taking it from the raw count. Any other span would desynchronize one of
    // the two families every time the counter wrapped.
    for (let revolutions = 0; revolutions < 200; revolutions += 1) {
      const index = revolutionIndexFrom(revolutions);
      expect(revolutionParityOf(index)).toBe(revolutions % 2);
      expect(rotorRevolutionIndexOf(index)).toBe(revolutions % 3);
    }
  });
});

describe("advanceRevolutionIndex — rotary's mod-3 reading", () => {
  it("advances one step per whole shaft revolution", () => {
    // 360 rpm is 6 rev/s, so a 1/60 s frame is a tenth of a revolution: each
    // group of ten frames crosses exactly one boundary.
    let angle = 0;
    let index: CrankRevolutionIndex = 0;
    const seen: number[] = [];

    for (let frame = 0; frame < 60; frame += 1) {
      index = advanceRevolutionIndex(angle, index, 1 / 60, 360, 1);
      angle = advanceCrankAngle(angle, 1 / 60, 360, 1);
      if ((frame + 1) % 10 === 0) seen.push(rotorRevolutionIndexOf(index));
    }

    // Six revolutions: the rotor index cycles 1,2,0,1,2,0 and the counter has
    // wrapped exactly once, which a mod-3-only counter would have hidden.
    expect(seen).toEqual([1, 2, 0, 1, 2, 0]);
    expect(index).toBe(0);
  });

  it("counts every revolution of a multi-revolution frame, not just one wrap", () => {
    // The inactive-tab case. 6,000 rpm is 100 rev/s, so a clamped 0.085 s
    // frame covers 8.5 revolutions: the index must advance by 8, not by 1.
    // Under `% 3` that is a two-step advance — a rotor drawn 240° out of place
    // if the wrap were only ever counted once.
    expect(advanceRevolutionIndex(0, 0, 0.085, 6000, 1)).toBe(
      revolutionIndexFrom(8),
    );
    expect(
      rotorRevolutionIndexOf(advanceRevolutionIndex(0, 0, 0.085, 6000, 1)),
    ).toBe(2);
    expect(advanceRevolutionIndex(0, 0, 0.095, 6000, 1)).toBe(
      revolutionIndexFrom(9),
    );
  });

  it("clamps the frame delta exactly like advanceCrankAngle", () => {
    expect(advanceRevolutionIndex(0, 0, 30, 6000, 1)).toBe(
      advanceRevolutionIndex(0, 0, MAX_FRAME_DELTA_S, 6000, 1),
    );
  });

  it("holds still at zero rpm, whatever the index", () => {
    for (const index of [0, 1, 2, 3, 4, 5] as const) {
      expect(advanceRevolutionIndex(1.23, index, 0.5, 0, 1)).toBe(index);
    }
  });
});

describe("advanceEnginePair — the rotary's third of the counter", () => {
  const DT = 1 / 60;

  it("assigns engine B's index from engine A's while linked, not just its parity", () => {
    // Indexes 1 and 3 share a parity, so the pre-generalization assignment
    // would have looked correct here while leaving the two rotors 120° apart.
    const live = angles(0, 0, 0, 3);
    advanceEnginePair(live, DT, 9000, 1234, 1, true);

    expect(live.comparisonCrankRevolutionIndex).toBe(live.crankRevolutionIndex);
  });

  it("lets two unlinked engines diverge by a rotor revolution, not only by a parity", () => {
    // Engine A at 180 rpm covers 10 whole revolutions over 200 frames, engine
    // B at 90 rpm covers 5 — indexes 4 and 5, which differ under `% 3` as
    // well as under `% 2`.
    const live = angles();
    for (let i = 0; i < 200; i += 1) {
      advanceEnginePair(live, DT, 180, 90, 1, false);
    }

    expect(live.crankRevolutionIndex).toBe(revolutionIndexFrom(10));
    expect(live.comparisonCrankRevolutionIndex).toBe(revolutionIndexFrom(5));
    expect(rotorRevolutionIndexOf(live.crankRevolutionIndex)).toBe(1);
    expect(rotorRevolutionIndexOf(live.comparisonCrankRevolutionIndex)).toBe(2);
  });
});
