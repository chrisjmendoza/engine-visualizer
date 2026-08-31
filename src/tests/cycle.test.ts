import { describe, expect, it } from "vitest";
import {
  cycleAngleRad,
  cylinderCycleAngleRad,
  cylinderStrokePhaseAt,
  strokePhaseAt,
} from "../engine/cycle";
import type { StrokePhase } from "../engine/cycle";
import { TWO_PI } from "../engine/constants";
import {
  ENGINE_LAYOUT_IDS,
  createEngineLayout,
  cylinderCrankAngleRad,
  cylinderFiringAngleRad,
  firingIntervalsRad,
} from "../engine/engineLayout";
import type { EngineLayoutDefinition } from "../engine/engineLayout";
import { degToRad, radToDeg } from "../engine/units";

describe("cycleAngleRad", () => {
  it("returns the crank angle unchanged at parity 0", () => {
    expect(cycleAngleRad(0, 0)).toBeCloseTo(0, 12);
    expect(cycleAngleRad(Math.PI, 0)).toBeCloseTo(Math.PI, 12);
  });

  it("adds a full revolution at parity 1", () => {
    expect(cycleAngleRad(0, 1)).toBeCloseTo(TWO_PI, 12);
    expect(cycleAngleRad(Math.PI, 1)).toBeCloseTo(Math.PI + TWO_PI, 12);
  });

  it("wraps a crank angle outside [0, 2*PI) before combining with parity", () => {
    // Exactly one revolution past zero should read the same as zero itself.
    expect(cycleAngleRad(TWO_PI, 0)).toBeCloseTo(0, 9);
    expect(cycleAngleRad(TWO_PI, 1)).toBeCloseTo(TWO_PI, 9);

    // A negative angle (defensive input) wraps the same way.
    expect(cycleAngleRad(-Math.PI / 2, 0)).toBeCloseTo((3 * Math.PI) / 2, 9);
  });

  it("stays within [0, 4*PI) for any crank angle and either parity", () => {
    for (let deg = -720; deg <= 720; deg += 15) {
      const theta = (deg / 180) * Math.PI;
      for (const parity of [0, 1] as const) {
        const value = cycleAngleRad(theta, parity);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(2 * TWO_PI);
      }
    }
  });
});

describe("strokePhaseAt - quarter boundaries", () => {
  const cases: { cycleAngle: number; phase: StrokePhase; label: string }[] = [
    { cycleAngle: 0, phase: "intake", label: "0 (TDC, cycle start)" },
    { cycleAngle: Math.PI - 1e-9, phase: "intake", label: "just under PI" },
    { cycleAngle: Math.PI, phase: "compression", label: "PI exactly" },
    {
      cycleAngle: TWO_PI - 1e-9,
      phase: "compression",
      label: "just under 2*PI",
    },
    { cycleAngle: TWO_PI, phase: "power", label: "2*PI exactly" },
    {
      cycleAngle: 3 * Math.PI - 1e-9,
      phase: "power",
      label: "just under 3*PI",
    },
    { cycleAngle: 3 * Math.PI, phase: "exhaust", label: "3*PI exactly" },
    {
      cycleAngle: 4 * Math.PI - 1e-9,
      phase: "exhaust",
      label: "just under 4*PI",
    },
  ];

  for (const { cycleAngle, phase, label } of cases) {
    it(`reports "${phase}" at ${label}`, () => {
      expect(strokePhaseAt(cycleAngle)).toBe(phase);
    });
  }
});

describe("strokePhaseAt - wrap at 4*PI", () => {
  it("treats exactly 4*PI as the start of the next cycle's intake stroke", () => {
    expect(strokePhaseAt(4 * Math.PI)).toBe("intake");
  });

  it("treats 4*PI plus an angle the same as that angle alone", () => {
    for (const cycleAngle of [
      0,
      Math.PI / 2,
      Math.PI,
      2.5 * Math.PI,
      3.9 * Math.PI,
    ]) {
      expect(strokePhaseAt(4 * Math.PI + cycleAngle)).toBe(
        strokePhaseAt(cycleAngle),
      );
    }
  });

  it("treats a negative cycle angle by wrapping into [0, 4*PI) as well", () => {
    // -0.1 rad should read as just before the end of the cycle: exhaust.
    expect(strokePhaseAt(-0.1)).toBe("exhaust");
  });
});

describe("strokePhaseAt - full cycle sweep matches the quarter definition", () => {
  it("agrees with a direct quarter computation at every sampled angle", () => {
    for (let deg = 0; deg < 720; deg += 1) {
      const cycleAngle = (deg / 180) * Math.PI;
      const quarter = Math.floor(deg / 180);
      const expected: StrokePhase = (
        ["intake", "compression", "power", "exhaust"] as const
      )[quarter];

      expect(strokePhaseAt(cycleAngle)).toBe(expected);
    }
  });
});

/**
 * Per-cylinder cycle phase (`cylinderStrokePhaseAt`).
 *
 * These tests deliberately do **not** read `cylinderFiringAngleRad` and
 * re-add 2π to predict the answer — that would only restate the derivation.
 * They sweep the 720° cycle, watch what the function actually reports for each
 * cylinder, and check the result against things known independently of it: the
 * layout's published `firingOrder`, its `firingIntervalsRad`, and the crank
 * geometry that says a cylinder can only start a power stroke at its own TDC.
 */

/**
 * Samples per 720° sweep. 14400 puts a sample every 0.05°, and — since every
 * firing angle in the roster is a whole multiple of a degree — lands exactly
 * on each stroke boundary, so a detected entry is never more than one step
 * late.
 */
const SWEEP_STEPS = 14400;
const SWEEP_STEP_DEG = 720 / SWEEP_STEPS;

/** The cycle angle of sample `i`, in degrees; exact for every i. */
function sampleDeg(i: number): number {
  return (i * 720) / SWEEP_STEPS;
}

interface PowerEntry {
  index: number;
  cycleDeg: number;
}

/**
 * Sweeps one full 720° cycle and records, in order, every cylinder's
 * transition *into* the power stroke — the moment it fires.
 *
 * The previous phase is seeded from the last sample of the cycle (the sweep is
 * a loop, not a line), so a cylinder that fires at cycle angle 0 is caught as
 * an entry rather than missed for having always been in power.
 */
function powerEntriesOverOneCycle(
  layout: EngineLayoutDefinition,
): PowerEntry[] {
  const previous: StrokePhase[] = layout.cylinders.map((cylinder) =>
    cylinderStrokePhaseAt(
      layout,
      cylinder.index,
      degToRad(sampleDeg(SWEEP_STEPS - 1)),
    ),
  );
  const entries: PowerEntry[] = [];

  for (let i = 0; i < SWEEP_STEPS; i += 1) {
    const cycleDeg = sampleDeg(i);
    const cycleRad = degToRad(cycleDeg);
    for (const cylinder of layout.cylinders) {
      const phase = cylinderStrokePhaseAt(layout, cylinder.index, cycleRad);
      if (phase === "power" && previous[cylinder.index] !== "power") {
        entries.push({ index: cylinder.index, cycleDeg });
      }
      previous[cylinder.index] = phase;
    }
  }

  return entries;
}

/** Rotates a cyclic sequence so it starts at `value`. */
function rotateToStartAt<T>(sequence: readonly T[], value: T): T[] {
  const at = sequence.indexOf(value);
  return [...sequence.slice(at), ...sequence.slice(0, at)];
}

/** Signed wrap into (−π, π], for comparing angles near zero. */
function signedWrapRad(rad: number): number {
  return Math.atan2(Math.sin(rad), Math.cos(rad));
}

describe("cylinderStrokePhaseAt - cylinder 0 is the badge's cylinder", () => {
  it("agrees with strokePhaseAt exactly, for every layout, at every sampled angle", () => {
    // The badge (`StrokeBadge`) calls `strokePhaseAt` with no layout at all.
    // If these two ever disagreed, a cylinder would be tinted red while the
    // badge beside it said "Intake".
    for (const id of ENGINE_LAYOUT_IDS) {
      const layout = createEngineLayout(id);
      for (let deg = 0; deg < 720; deg += 1) {
        const cycleRad = degToRad(deg);
        expect(cylinderStrokePhaseAt(layout, 0, cycleRad)).toBe(
          strokePhaseAt(cycleRad),
        );
      }
    }
  });

  it("leaves the single-cylinder layout running on nothing but its own cycle", () => {
    // The single-cylinder *view* draws only cylinder 0 of whatever the
    // architecture is, so this is the whole of its behavior: no special case
    // in the renderer, just cylinder 0's own phase.
    const layout = createEngineLayout("single");
    expect(layout.cylinders).toHaveLength(1);
    expect(cylinderFiringAngleRad(layout, 0)).toBe(0);

    const entries = powerEntriesOverOneCycle(layout);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.index).toBe(0);
    expect(entries[0]?.cycleDeg).toBeCloseTo(360, 6);
  });
});

describe("cylinderStrokePhaseAt - the swept firing order is the layout's own", () => {
  // The load-bearing test. A wrong per-cylinder offset produces a tint rhythm
  // that looks entirely plausible on screen and describes an engine that does
  // not exist; this is what catches it.
  for (const id of ENGINE_LAYOUT_IDS) {
    it(`${id}: cylinders enter the power stroke in firingOrder`, () => {
      const layout = createEngineLayout(id);
      const entries = powerEntriesOverOneCycle(layout);

      // Every cylinder fires exactly once per 720°, no more and no less.
      expect(entries).toHaveLength(layout.cylinders.length);

      // The sweep starts at cycle angle 0, which is cylinder 0's *intake*
      // start — its power stroke does not begin until 360° — so the swept
      // sequence is the firing order read from some other starting point.
      // Firing order is inherently cyclic, so rotate to cylinder 0 and
      // compare; the cyclic content is the claim being made.
      const swept = entries.map((entry) => entry.index);
      expect(rotateToStartAt(swept, 0)).toEqual([...layout.firingOrder]);
    });
  }

  it("inline-4's paired cylinders share a crank throw but fire a revolution apart", () => {
    // Cylinders 1 and 4 (indices 0 and 3) have the same TDC angle: their
    // pistons move identically, so no amount of `crankPhaseRad` arithmetic can
    // tell them apart. Only the firing order can, and it puts them exactly two
    // strokes — one whole crank revolution — apart in the cycle. This is the
    // case that fails outright if the phase is derived from crank phase alone.
    const layout = createEngineLayout("inline-4");
    expect(layout.cylinders[0]?.crankPhaseRad).toBe(
      layout.cylinders[3]?.crankPhaseRad,
    );

    const order: StrokePhase[] = ["intake", "compression", "power", "exhaust"];
    for (let deg = 0; deg < 720; deg += 5) {
      const cycleRad = degToRad(deg);
      const a = order.indexOf(cylinderStrokePhaseAt(layout, 0, cycleRad));
      const b = order.indexOf(cylinderStrokePhaseAt(layout, 3, cycleRad));
      expect((b - a + 4) % 4).toBe(2);
    }
  });
});

describe("cylinderStrokePhaseAt - a power stroke can only begin at that cylinder's TDC", () => {
  // Independent of the firing order the offsets came from: this checks the
  // derivation against crank *geometry*. A cylinder that lit up half a stroke
  // from its own top dead center would be physically impossible, however
  // plausible the sequence looked.
  for (const id of ENGINE_LAYOUT_IDS) {
    it(`${id}: every power entry lands on that cylinder's own TDC`, () => {
      const layout = createEngineLayout(id);

      for (const entry of powerEntriesOverOneCycle(layout)) {
        const cylinder = layout.cylinders[entry.index];
        expect(cylinder).toBeDefined();
        // The engine crank angle at that cycle angle is it modulo one
        // revolution; the cylinder's own crank angle adds its throw phase.
        const engineCrankRad = degToRad(entry.cycleDeg % 360);
        const ownCrankRad = cylinderCrankAngleRad(
          engineCrankRad,
          cylinder as (typeof layout.cylinders)[number],
        );
        // Detection is at most one sweep step from the true boundary, so the
        // cylinder's own crank angle at that sample is within one step of 0.
        // A wrong offset would put it a whole stroke or more away.
        expect(Math.abs(radToDeg(signedWrapRad(ownCrankRad)))).toBeLessThan(
          SWEEP_STEP_DEG + 1e-6,
        );
      }
    });
  }
});

describe("cylinderStrokePhaseAt - firing intervals survive the trip through the cycle", () => {
  it("v6-90-odd keeps its real 150/90 alternation, never an even 120", () => {
    // The odd-fire Buick V6 is the case where an "even fire, 720/N" shortcut
    // would silently model a different engine. The gaps between power-stroke
    // entries must reproduce its lumpy beat exactly.
    const layout = createEngineLayout("v6-90-odd");
    const entries = powerEntriesOverOneCycle(layout);
    expect(entries).toHaveLength(6);

    const gaps = entries.map((entry, i) =>
      i + 1 < entries.length
        ? (entries[i + 1] as PowerEntry).cycleDeg - entry.cycleDeg
        : 720 - entry.cycleDeg + (entries[0] as PowerEntry).cycleDeg,
    );

    // Six gaps alternating 150 and 90 — starting on whichever of the two the
    // sweep's own start lands in, since the sweep begins mid-sequence.
    expect(gaps).toHaveLength(6);
    for (let i = 0; i < gaps.length; i += 1) {
      expect(gaps[i]).toBeCloseTo(i % 2 === 0 ? 90 : 150, 1);
    }
    expect(gaps.reduce((sum, gap) => sum + gap, 0)).toBeCloseTo(720, 6);

    // And they are the same gaps `firingIntervalsRad` derives straight from
    // the crank table, in the same cyclic order.
    const declared = firingIntervalsRad(layout).map((rad) =>
      Math.round(radToDeg(rad)),
    );
    expect(rotateToStartAt(declared, 90)).toEqual([90, 150, 90, 150, 90, 150]);
  });

  for (const id of ENGINE_LAYOUT_IDS) {
    if (id === "v6-90-odd" || id === "single") continue;
    it(`${id}: swept power entries are evenly spaced at 720/N`, () => {
      const layout = createEngineLayout(id);
      const entries = powerEntriesOverOneCycle(layout);
      const expected = 720 / layout.cylinders.length;

      for (let i = 1; i < entries.length; i += 1) {
        const gap =
          (entries[i] as PowerEntry).cycleDeg -
          (entries[i - 1] as PowerEntry).cycleDeg;
        expect(gap).toBeCloseTo(expected, 1);
      }
    });
  }
});

describe("cylinderStrokePhaseAt - how many cylinders are in each phase", () => {
  const PHASES: readonly StrokePhase[] = [
    "intake",
    "compression",
    "power",
    "exhaust",
  ];

  for (const id of ENGINE_LAYOUT_IDS) {
    it(`${id}: every cylinder is in exactly one phase, and the split is as even as the count allows`, () => {
      const layout = createEngineLayout(id);
      const n = layout.cylinders.length;
      // A stroke spans a quarter of the cycle and firings are spaced 720/N
      // apart, so a phase holds either floor(N/4) or ceil(N/4) cylinders at
      // every instant — exactly N/4 when 4 divides N (an inline-4 always has
      // exactly one cylinder in each of the four strokes).
      const low = Math.floor(n / 4);
      const high = Math.ceil(n / 4);

      // Sampled half a degree off the whole-degree grid on purpose. Every
      // firing angle in the roster is a whole number of degrees, so every
      // stroke boundary is too; landing a sample exactly on one asks floating
      // point which side of a boundary a value that *is* the boundary falls,
      // and on a V12 (three cylinders on a boundary at once, every 60°) the
      // answer can legitimately go either way. The counts are a statement
      // about the interior of the strokes, not about their edges.
      for (let step = 0; step * 3 + 0.5 < 720; step += 1) {
        const cycleRad = degToRad(step * 3 + 0.5);
        const counts = new Map<StrokePhase, number>(
          PHASES.map((phase) => [phase, 0]),
        );
        for (const cylinder of layout.cylinders) {
          const phase = cylinderStrokePhaseAt(layout, cylinder.index, cycleRad);
          counts.set(phase, (counts.get(phase) as number) + 1);
        }

        let total = 0;
        for (const phase of PHASES) {
          const count = counts.get(phase) as number;
          expect(count).toBeGreaterThanOrEqual(low);
          expect(count).toBeLessThanOrEqual(high);
          total += count;
        }
        expect(total).toBe(n);
      }
    });
  }
});

describe("cylinderCycleAngleRad", () => {
  it("stays in [0, 4*PI) for every cylinder, layout, and input angle", () => {
    for (const id of ENGINE_LAYOUT_IDS) {
      const layout = createEngineLayout(id);
      for (const cylinder of layout.cylinders) {
        for (let deg = -720; deg <= 1440; deg += 17) {
          const value = cylinderCycleAngleRad(
            layout,
            cylinder.index,
            degToRad(deg),
          );
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(2 * TWO_PI);
        }
      }
    }
  });

  it("returns the engine's own cycle angle for cylinder 0", () => {
    const layout = createEngineLayout("v8-cross");
    for (let deg = 0; deg < 720; deg += 11) {
      expect(cylinderCycleAngleRad(layout, 0, degToRad(deg))).toBeCloseTo(
        degToRad(deg),
        9,
      );
    }
  });

  it("falls back to cylinder 0's offset for an index outside the layout", () => {
    const layout = createEngineLayout("inline-4");
    expect(cylinderFiringAngleRad(layout, 99)).toBe(0);
    expect(cylinderFiringAngleRad(layout, -1)).toBe(0);
  });
});

describe("cycleAngleRad + strokePhaseAt - parity flips the reported stroke", () => {
  it("the same wrapped crank angle reports the opposite stroke pair under each parity", () => {
    // At the crank angle where parity 0 reads intake, parity 1 must read
    // power - the phase four quarters ahead, i.e. the same point one full
    // crank revolution into the cycle.
    const crankAngleRad = Math.PI / 4; // well inside intake at parity 0
    expect(strokePhaseAt(cycleAngleRad(crankAngleRad, 0))).toBe("intake");
    expect(strokePhaseAt(cycleAngleRad(crankAngleRad, 1))).toBe("power");
  });

  it("a parity flip at the same wrapped angle moves compression to exhaust", () => {
    const crankAngleRad = Math.PI + Math.PI / 4; // inside compression at parity 0
    expect(strokePhaseAt(cycleAngleRad(crankAngleRad, 0))).toBe("compression");
    expect(strokePhaseAt(cycleAngleRad(crankAngleRad, 1))).toBe("exhaust");
  });
});
