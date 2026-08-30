/**
 * Tests the frame-advance rule in isolation.
 *
 * `advanceCrankAngle` is pure, so the integration, clamping, wrapping, and
 * playback-speed scaling are all testable without a WebGL context. The parts
 * of the loop that need one — `useFrame` registration, the throttled store
 * sync — are not covered here.
 */

import { describe, expect, it } from "vitest";
import { PLAYBACK_SPEEDS, TWO_PI } from "../engine/constants";
import { MAX_FRAME_DELTA_S, advanceCrankAngle } from "./useMechanismAnimation";

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
    const slowed = advanceCrankAngle(0, 0.016, 600, 0.1);
    expect(slowed).toBeCloseTo(expectedDelta(0.016, 600, 0.1), 10);
    // A tenth of the real-time advance: visible rotation instead of strobing.
    expect(slowed).toBeCloseTo(advanceCrankAngle(0, 0.016, 600, 1) / 10, 10);
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
