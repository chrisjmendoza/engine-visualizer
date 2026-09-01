import { describe, expect, it } from "vitest";
import { TWO_PI } from "../engine/constants";
import { strokePhaseAt } from "../engine/cycle";
import type { StrokePhase } from "../engine/cycle";
import { calculateChamberDisplacementCc } from "../engine/rotaryCalculations";
import {
  DEFAULT_ROTARY_CONFIG,
  ROTOR_FACE_COUNT,
} from "../engine/rotaryConstants";
import {
  ROTARY_CYCLE_SPAN_RAD,
  ROTARY_FIRING_CYCLE_ANGLE_RAD,
  ROTARY_PHASE_SPAN_RAD,
  ROTARY_ROTOR_PHASES,
  ROTOR_FACE_ANCHOR_SHAFT_ANGLE_RAD,
  ROTOR_FACE_PITCH_SHAFT_RAD,
  rotaryCycleAngleRad,
  rotaryFiringIntervalsRad,
  rotaryFiringSequenceRad,
  rotaryPhaseAt,
  rotorFaceCycleAngleRad,
  rotorFaceFiringShaftAngleRad,
  rotorFacePhaseAt,
} from "../engine/rotaryCycle";
import type {
  RotaryFiringEvent,
  RotorRevolutionIndex,
} from "../engine/rotaryCycle";
import { chamberAreaMm2 } from "../engine/rotaryGeometry";
import type { RotaryRotorCount } from "../engine/rotaryTypes";
import { degToRad, radToDeg } from "../engine/units";

const CONFIG = DEFAULT_ROTARY_CONFIG;
const ALL_PHASES: StrokePhase[] = ["intake", "compression", "power", "exhaust"];

/*
 * ---------------------------------------------------------------------------
 * Locating the cycle's anchor numerically.
 *
 * `rotaryCycle.ts` pins face 0's minimum-volume moment at a shaft angle of 90
 * degrees. That constant is not allowed to be an assumption: everything below
 * re-derives it from `chamberAreaMm2`, a shoelace over a sampled housing arc
 * that knows nothing about the cycle module. A coarse scan brackets every local
 * extremum (they land on multiples of 90 degrees of shaft -- alpha0 = PI/6 +
 * m*PI/2 -- whatever e and R are, so any divisor of 90 works as a grid), then a
 * ternary search refines each one to well under a thousandth of a degree.
 * ---------------------------------------------------------------------------
 */

/** Coarse scan resolution, degrees of shaft. Every extremum lands on a multiple
 * of 90, so a 5-degree grid brackets each one while keeping the sweep cheap and
 * well clear of the shoelace's own noise. */
const COARSE_STEP_DEG = 5;
const COARSE_STEPS = 1080 / COARSE_STEP_DEG;

function areaAtDeg(
  shaftDeg: number,
  faceIndex: number,
  rotorPhaseRad: number,
  samples: number,
): number {
  return chamberAreaMm2(
    CONFIG,
    degToRad(shaftDeg),
    faceIndex,
    rotorPhaseRad,
    samples,
  );
}

function refineExtremumDeg(
  faceIndex: number,
  rotorPhaseRad: number,
  loDeg: number,
  hiDeg: number,
  kind: "min" | "max",
): number {
  let lo = loDeg;
  let hi = hiDeg;
  // Ternary search: 50 iterations shrink the bracket by (2/3)^50, far below
  // the precision the shoelace itself supports.
  for (let i = 0; i < 50; i += 1) {
    const a = lo + (hi - lo) / 3;
    const b = hi - (hi - lo) / 3;
    const fa = areaAtDeg(a, faceIndex, rotorPhaseRad, 2048);
    const fb = areaAtDeg(b, faceIndex, rotorPhaseRad, 2048);
    if (kind === "min" ? fa < fb : fa > fb) {
      hi = b;
    } else {
      lo = a;
    }
  }
  return (lo + hi) / 2;
}

const extremaCache = new Map<string, number[]>();

/** Every local minimum (or maximum) of face k's chamber area over one cycle. */
function locateAreaExtremaDeg(
  faceIndex: number,
  rotorPhaseRad: number,
  kind: "min" | "max",
): number[] {
  const key = `${faceIndex}|${rotorPhaseRad}|${kind}`;
  const cached = extremaCache.get(key);
  if (cached) return cached;

  const coarse = new Array<number>(COARSE_STEPS);
  for (let i = 0; i < COARSE_STEPS; i += 1) {
    coarse[i] = areaAtDeg(i * COARSE_STEP_DEG, faceIndex, rotorPhaseRad, 512);
  }

  const found: number[] = [];
  for (let i = 0; i < COARSE_STEPS; i += 1) {
    const previous = coarse[(i - 1 + COARSE_STEPS) % COARSE_STEPS] as number;
    const current = coarse[i] as number;
    const next = coarse[(i + 1) % COARSE_STEPS] as number;
    const isExtreme =
      kind === "min"
        ? current < previous && current < next
        : current > previous && current > next;
    if (isExtreme) {
      const refined = refineExtremumDeg(
        faceIndex,
        rotorPhaseRad,
        (i - 1) * COARSE_STEP_DEG,
        (i + 1) * COARSE_STEP_DEG,
        kind,
      );
      found.push(((refined % 1080) + 1080) % 1080);
    }
  }

  found.sort((a, b) => a - b);
  extremaCache.set(key, found);
  return found;
}

describe("rotaryCycleAngleRad", () => {
  it("returns the shaft angle unchanged on the first revolution of a cycle", () => {
    expect(rotaryCycleAngleRad(0, 0)).toBeCloseTo(0, 12);
    expect(rotaryCycleAngleRad(Math.PI, 0)).toBeCloseTo(Math.PI, 12);
  });

  it("adds one revolution per rotor-revolution index", () => {
    expect(rotaryCycleAngleRad(0, 1)).toBeCloseTo(TWO_PI, 12);
    expect(rotaryCycleAngleRad(0, 2)).toBeCloseTo(2 * TWO_PI, 12);
    expect(rotaryCycleAngleRad(Math.PI, 2)).toBeCloseTo(
      Math.PI + 2 * TWO_PI,
      12,
    );
  });

  it("wraps a shaft angle outside [0, 2*PI) before combining with the index", () => {
    expect(rotaryCycleAngleRad(TWO_PI, 0)).toBeCloseTo(0, 9);
    expect(rotaryCycleAngleRad(TWO_PI, 2)).toBeCloseTo(2 * TWO_PI, 9);
    expect(rotaryCycleAngleRad(-Math.PI / 2, 0)).toBeCloseTo(
      (3 * Math.PI) / 2,
      9,
    );
  });

  it("stays within [0, 6*PI) for any shaft angle and any index", () => {
    for (let deg = -1080; deg <= 1080; deg += 15) {
      for (const index of [0, 1, 2] as RotorRevolutionIndex[]) {
        const value = rotaryCycleAngleRad(degToRad(deg), index);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(ROTARY_CYCLE_SPAN_RAD);
      }
    }
  });

  it("spans 1080 degrees -- three shaft revolutions", () => {
    expect(radToDeg(ROTARY_CYCLE_SPAN_RAD)).toBeCloseTo(1080, 9);
    expect(radToDeg(ROTARY_PHASE_SPAN_RAD)).toBeCloseTo(270, 9);
    expect(radToDeg(ROTARY_FIRING_CYCLE_ANGLE_RAD)).toBeCloseTo(540, 9);
  });
});

describe("rotaryPhaseAt - quarter boundaries", () => {
  /*
   * Boundaries are expressed in multiples of the module's own phase span
   * rather than in degrees, for the same reason `cycle.test.ts` writes its
   * boundaries as `Math.PI` and `TWO_PI`: `degToRad(270)` and `3*PI/2` are not
   * bit-identical, so a degrees-based "exactly on the boundary" case would be
   * testing floating-point rounding rather than the phase split.
   */
  const cases: { cycleAngle: number; phase: StrokePhase; label: string }[] = [
    {
      cycleAngle: 0,
      phase: "intake",
      label: "0 (cycle start, minimum volume)",
    },
    {
      cycleAngle: ROTARY_PHASE_SPAN_RAD - 1e-9,
      phase: "intake",
      label: "just under 270",
    },
    {
      cycleAngle: ROTARY_PHASE_SPAN_RAD,
      phase: "compression",
      label: "270 exactly",
    },
    {
      cycleAngle: 2 * ROTARY_PHASE_SPAN_RAD - 1e-9,
      phase: "compression",
      label: "just under 540",
    },
    {
      cycleAngle: ROTARY_FIRING_CYCLE_ANGLE_RAD,
      phase: "power",
      label: "540 exactly (firing)",
    },
    {
      cycleAngle: 3 * ROTARY_PHASE_SPAN_RAD - 1e-9,
      phase: "power",
      label: "just under 810",
    },
    {
      cycleAngle: 3 * ROTARY_PHASE_SPAN_RAD,
      phase: "exhaust",
      label: "810 exactly",
    },
    {
      cycleAngle: ROTARY_CYCLE_SPAN_RAD - 1e-9,
      phase: "exhaust",
      label: "just under 1080",
    },
  ];

  for (const { cycleAngle, phase, label } of cases) {
    it(`reports "${phase}" at ${label}`, () => {
      expect(rotaryPhaseAt(cycleAngle)).toBe(phase);
    });
  }

  it("agrees with a degrees-based reading away from the boundaries", () => {
    expect(rotaryPhaseAt(degToRad(135))).toBe("intake");
    expect(rotaryPhaseAt(degToRad(405))).toBe("compression");
    expect(rotaryPhaseAt(degToRad(675))).toBe("power");
    expect(rotaryPhaseAt(degToRad(945))).toBe("exhaust");
  });

  it("folds angles at or past the cycle boundary back to intake", () => {
    expect(rotaryPhaseAt(ROTARY_CYCLE_SPAN_RAD)).toBe("intake");
    expect(rotaryPhaseAt(degToRad(1080 + 5))).toBe("intake");
    expect(rotaryPhaseAt(degToRad(-5))).toBe("exhaust");
  });

  it("reuses the piston family's StrokePhase, not a parallel enum", () => {
    // Assignable in both directions at compile time; the runtime check keeps
    // the two vocabularies honest if either ever grows a member.
    const fromRotary: StrokePhase = rotaryPhaseAt(0);
    const fromPiston: StrokePhase = strokePhaseAt(0);
    expect(ALL_PHASES).toContain(fromRotary);
    expect(ALL_PHASES).toContain(fromPiston);
    const seen = new Set<StrokePhase>();
    for (let deg = 0; deg < 1080; deg += 1) {
      seen.add(rotaryPhaseAt(degToRad(deg)));
    }
    expect([...seen].sort()).toEqual([...ALL_PHASES].sort());
  });
});

describe("the minimum-volume anchor, located from the geometry", () => {
  it("finds face 0's chamber minima at 90 and 630 degrees of shaft", () => {
    const minima = locateAreaExtremaDeg(0, 0, "min");
    expect(minima).toHaveLength(2);
    expect(minima[0] as number).toBeCloseTo(90, 3);
    expect(minima[1] as number).toBeCloseTo(630, 3);
  });

  it("finds face 0's chamber maxima at 360 and 900 degrees of shaft", () => {
    const maxima = locateAreaExtremaDeg(0, 0, "max");
    expect(maxima).toHaveLength(2);
    expect(maxima[0] as number).toBeCloseTo(360, 3);
    expect(maxima[1] as number).toBeCloseTo(900, 3);
  });

  it("pins ROTOR_FACE_ANCHOR_SHAFT_ANGLE_RAD to the located minimum", () => {
    const minima = locateAreaExtremaDeg(0, 0, "min");
    expect(radToDeg(ROTOR_FACE_ANCHOR_SHAFT_ANGLE_RAD)).toBeCloseTo(
      minima[0] as number,
      3,
    );
  });

  it("puts extrema exactly 270 degrees apart -- the four phase boundaries", () => {
    const boundaries = [
      ...locateAreaExtremaDeg(0, 0, "min"),
      ...locateAreaExtremaDeg(0, 0, "max"),
    ].sort((a, b) => a - b);
    expect(boundaries).toHaveLength(4);
    for (let i = 1; i < boundaries.length; i += 1) {
      expect(
        (boundaries[i] as number) - (boundaries[i - 1] as number),
      ).toBeCloseTo(270, 3);
    }
  });

  it("gives every face its own minima, 360 degrees of shaft apart", () => {
    // Face k's minima are at 90 - 360k (mod 540): {90,630}, {270,810},
    // {450,990}. This is the geometric fact behind "one firing per shaft
    // revolution per rotor".
    const expected = [
      [90, 630],
      [270, 810],
      [450, 990],
    ];
    for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
      const minima = locateAreaExtremaDeg(k, 0, "min");
      expect(minima).toHaveLength(2);
      expect(minima[0] as number).toBeCloseTo(
        (expected[k] as number[])[0] as number,
        3,
      );
      expect(minima[1] as number).toBeCloseTo(
        (expected[k] as number[])[1] as number,
        3,
      );
    }
  });

  it("places every face's declared firing angle on one of that face's own minima", () => {
    /*
     * The sign of ROTOR_FACE_PITCH_SHAFT_RAD is the part a "firings are evenly
     * spaced" test could not catch: get it backwards and the firings are still
     * 360 degrees apart, but each one is attributed to the wrong face and the
     * scene tints the wrong flank. So this checks each face's *declared*
     * firing angle against that face's *own* numerically located minima.
     */
    for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
      const minimaDeg = locateAreaExtremaDeg(k, 0, "min");
      const firingDeg = radToDeg(rotorFaceFiringShaftAngleRad(k));
      const distances = minimaDeg.map((deg) => Math.abs(deg - firingDeg));
      expect(Math.min(...distances)).toBeLessThan(0.01);
    }

    // ...and concretely: 90 for face 0, 810 for face 1, 450 for face 2.
    expect(radToDeg(rotorFaceFiringShaftAngleRad(0))).toBeCloseTo(90, 9);
    expect(radToDeg(rotorFaceFiringShaftAngleRad(1))).toBeCloseTo(810, 9);
    expect(radToDeg(rotorFaceFiringShaftAngleRad(2))).toBeCloseTo(450, 9);
  });

  it("swings by exactly Vd / b between the located extrema", () => {
    const minDeg = locateAreaExtremaDeg(0, 0, "min")[0] as number;
    const maxDeg = locateAreaExtremaDeg(0, 0, "max")[0] as number;
    const swingMm2 =
      areaAtDeg(maxDeg, 0, 0, 4096) - areaAtDeg(minDeg, 0, 0, 4096);
    const sweptAreaMm2 =
      (calculateChamberDisplacementCc(CONFIG) * 1000) / CONFIG.rotorWidthMm;
    expect(swingMm2).toBeCloseTo(sweptAreaMm2, 1);
  });

  it("shifts every anchor back by a rotor's phase", () => {
    // A phased rotor is an unphased one evaluated at theta + phase, so its
    // face-0 minimum moves from 90 to 90 - phase.
    const minima = locateAreaExtremaDeg(0, Math.PI, "min");
    expect(minima[0] as number).toBeCloseTo(450, 3);
    expect(minima[1] as number).toBeCloseTo(990, 3);
    expect(radToDeg(rotorFaceFiringShaftAngleRad(0, Math.PI))).toBeCloseTo(
      990,
      9,
    );
  });
});

describe("chamber volume period", () => {
  it("repeats every 540 degrees of shaft, not every 1080", () => {
    let worstMm2 = 0;
    for (let deg = 0; deg < 540; deg += 3) {
      const a = areaAtDeg(deg, 0, 0, 2048);
      const b = areaAtDeg(deg + 540, 0, 0, 2048);
      worstMm2 = Math.max(worstMm2, Math.abs(a - b));
    }
    expect(worstMm2).toBeLessThan(1e-6);
  });

  it("is not vacuous: a 270-degree shift does not repeat", () => {
    let worstMm2 = 0;
    for (let deg = 0; deg < 540; deg += 30) {
      worstMm2 = Math.max(
        worstMm2,
        Math.abs(areaAtDeg(deg, 0, 0, 512) - areaAtDeg(deg + 270, 0, 0, 512)),
      );
    }
    expect(worstMm2).toBeGreaterThan(1000);
  });

  it("gives two oscillations per 1080-degree cycle, which is why a face has four phases", () => {
    expect(locateAreaExtremaDeg(0, 0, "min")).toHaveLength(2);
    expect(locateAreaExtremaDeg(0, 0, "max")).toHaveLength(2);
  });
});

describe("rotorFaceCycleAngleRad", () => {
  it("reads 540 degrees -- the first instant of power -- at a face's firing angle", () => {
    for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
      const firingRad = rotorFaceFiringShaftAngleRad(k);
      expect(rotorFaceCycleAngleRad(k, firingRad)).toBeCloseTo(
        ROTARY_FIRING_CYCLE_ANGLE_RAD,
        9,
      );
      expect(rotorFacePhaseAt(k, firingRad)).toBe("power");
    }
  });

  it("offsets consecutive faces by exactly 360 degrees of shaft", () => {
    for (let deg = 0; deg < 1080; deg += 17) {
      const shaftRad = degToRad(deg);
      for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
        const delta =
          rotorFaceCycleAngleRad(k + 1, shaftRad) -
          rotorFaceCycleAngleRad(k, shaftRad);
        const wrapped =
          ((delta % ROTARY_CYCLE_SPAN_RAD) + ROTARY_CYCLE_SPAN_RAD) %
          ROTARY_CYCLE_SPAN_RAD;
        expect(wrapped).toBeCloseTo(ROTOR_FACE_PITCH_SHAFT_RAD, 9);
      }
    }
  });

  it("stays within [0, 1080 degrees) for any input", () => {
    for (let deg = -2000; deg <= 2000; deg += 37) {
      for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
        const value = rotorFaceCycleAngleRad(k, degToRad(deg), Math.PI);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(ROTARY_CYCLE_SPAN_RAD);
      }
    }
  });

  it("advances one-for-one with the shaft cycle angle", () => {
    // The face shift is a constant offset, so a 10-degree shaft advance is a
    // 10-degree cycle advance -- unlike the rotor's own angle, which moves a
    // third as fast.
    const a = rotorFaceCycleAngleRad(1, degToRad(100));
    const b = rotorFaceCycleAngleRad(1, degToRad(110));
    expect(b - a).toBeCloseTo(degToRad(10), 9);
  });
});

describe("rotorFacePhaseAt", () => {
  it("walks intake, compression, power, exhaust in order across the cycle", () => {
    const observed: StrokePhase[] = [];
    for (let deg = 0; deg < 1080; deg += 1) {
      const phase = rotorFacePhaseAt(0, degToRad(deg));
      if (observed[observed.length - 1] !== phase) observed.push(phase);
    }
    // Face 0's cycle angle at shaft angle 0 is 450 degrees -- inside
    // compression -- so the cycle is observed starting there and wrapping.
    expect(observed).toEqual([
      "compression",
      "power",
      "exhaust",
      "intake",
      "compression",
    ]);
  });

  it("spends exactly a quarter of the cycle in each phase", () => {
    for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
      const counts: Record<StrokePhase, number> = {
        intake: 0,
        compression: 0,
        power: 0,
        exhaust: 0,
      };
      const steps = 10800;
      for (let i = 0; i < steps; i += 1) {
        counts[rotorFacePhaseAt(k, (ROTARY_CYCLE_SPAN_RAD * i) / steps)] += 1;
      }
      for (const phase of ALL_PHASES) {
        // Exact quarters up to which side of a boundary a floating-point
        // sample lands on.
        expect(Math.abs(counts[phase] - steps / 4)).toBeLessThanOrEqual(2);
      }
    }
  });

  it("repeats every 1080 degrees of shaft cycle angle", () => {
    for (let deg = 0; deg < 1080; deg += 13) {
      for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
        expect(rotorFacePhaseAt(k, degToRad(deg + 1080))).toBe(
          rotorFacePhaseAt(k, degToRad(deg)),
        );
      }
    }
  });

  it("has the chamber growing through intake and power, shrinking through compression and exhaust", () => {
    /*
     * The phase *names* have to mean something. Sampled at the middle of each
     * phase, the numerically differentiated chamber area must have the sign
     * the name implies -- which also re-proves that the anchor sits on a
     * minimum rather than a maximum.
     */
    const growing: Record<StrokePhase, boolean> = {
      intake: true,
      compression: false,
      power: true,
      exhaust: false,
    };

    for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
      const firingDeg = radToDeg(rotorFaceFiringShaftAngleRad(k));
      for (let quarter = 0; quarter < 4; quarter += 1) {
        // Cycle angle at the middle of each quarter, converted back to shaft
        // angle via the face's own firing anchor (cycle 540 -> firing angle).
        const cycleDeg = quarter * 270 + 135;
        const shaftDeg = firingDeg + (cycleDeg - 540);
        const phase = rotorFacePhaseAt(k, degToRad(shaftDeg));
        const slope =
          areaAtDeg(shaftDeg + 0.5, k, 0, 2048) -
          areaAtDeg(shaftDeg - 0.5, k, 0, 2048);
        expect(slope > 0).toBe(growing[phase]);
      }
    }
  });

  it("gives the three faces three different phases at almost every angle", () => {
    // Faces are 360 degrees of shaft apart in a 1080-degree cycle, so their
    // phases are 90 degrees of cycle apart -- never all equal, and distinct
    // except where a 270-degree phase boundary lines up.
    let allDistinct = 0;
    for (let deg = 0; deg < 1080; deg += 1) {
      const phases = [0, 1, 2].map((k) => rotorFacePhaseAt(k, degToRad(deg)));
      if (new Set(phases).size === 3) allDistinct += 1;
      expect(new Set(phases).size).toBeGreaterThanOrEqual(2);
    }
    expect(allDistinct).toBeGreaterThan(700);
  });
});

describe("rotor phasing and firing", () => {
  it("spaces rotors evenly around the eccentric shaft", () => {
    const expectedDeg: Record<RotaryRotorCount, number[]> = {
      1: [0],
      2: [0, 180],
      3: [0, 120, 240],
    };
    for (const rotorCount of [1, 2, 3] as RotaryRotorCount[]) {
      const phases = ROTARY_ROTOR_PHASES[rotorCount];
      expect(phases).toHaveLength(rotorCount);
      phases.forEach((rad, index) => {
        expect(radToDeg(rad)).toBeCloseTo(
          (expectedDeg[rotorCount] as number[])[index] as number,
          9,
        );
      });
    }
  });

  it("produces three firings per rotor per cycle", () => {
    for (const rotorCount of [1, 2, 3] as RotaryRotorCount[]) {
      expect(rotaryFiringSequenceRad(rotorCount)).toHaveLength(
        ROTOR_FACE_COUNT * rotorCount,
      );
    }
  });

  it("fires evenly at 360 / rotorCount degrees of shaft", () => {
    const expectedDeg: Record<RotaryRotorCount, number> = {
      1: 360,
      2: 180,
      3: 120,
    };
    for (const rotorCount of [1, 2, 3] as RotaryRotorCount[]) {
      const intervals = rotaryFiringIntervalsRad(rotorCount);
      for (const interval of intervals) {
        expect(radToDeg(interval)).toBeCloseTo(expectedDeg[rotorCount], 9);
      }
      const sum = intervals.reduce((total, value) => total + value, 0);
      expect(sum).toBeCloseTo(ROTARY_CYCLE_SPAN_RAD, 9);
    }
  });

  it("returns firings in shaft-angle order, all inside one cycle", () => {
    for (const rotorCount of [1, 2, 3] as RotaryRotorCount[]) {
      const events = rotaryFiringSequenceRad(rotorCount);
      let previous = -1;
      for (const event of events) {
        expect(event.shaftAngleRad).toBeGreaterThanOrEqual(0);
        expect(event.shaftAngleRad).toBeLessThan(ROTARY_CYCLE_SPAN_RAD);
        expect(event.shaftAngleRad).toBeGreaterThan(previous);
        previous = event.shaftAngleRad;
      }
    }
  });

  it("alternates rotors on a two-rotor engine, as a 13B does", () => {
    const events = rotaryFiringSequenceRad(2);
    const rotorOrder = events.map((event) => event.rotorIndex);
    expect(rotorOrder).toEqual([0, 1, 0, 1, 0, 1]);
    expect(
      radToDeg((events[0] as RotaryFiringEvent).shaftAngleRad),
    ).toBeCloseTo(90, 9);
    expect(
      radToDeg((events[1] as RotaryFiringEvent).shaftAngleRad),
    ).toBeCloseTo(270, 9);
  });

  it("cycles all three rotors on a three-rotor engine, as a 20B does", () => {
    const events = rotaryFiringSequenceRad(3);
    expect(events).toHaveLength(9);
    const rotorOrder = events.map((event) => event.rotorIndex);
    // Every consecutive triple visits each rotor exactly once.
    for (let i = 0; i + 3 <= rotorOrder.length; i += 3) {
      expect(new Set(rotorOrder.slice(i, i + 3)).size).toBe(3);
    }
  });

  it("agrees with rotorFacePhaseAt: every listed firing starts a power phase", () => {
    for (const rotorCount of [1, 2, 3] as RotaryRotorCount[]) {
      const phases = ROTARY_ROTOR_PHASES[rotorCount];
      for (const event of rotaryFiringSequenceRad(rotorCount)) {
        const rotorPhaseRad = phases[event.rotorIndex] as number;
        expect(
          rotorFacePhaseAt(event.faceIndex, event.shaftAngleRad, rotorPhaseRad),
        ).toBe("power");
        // ...and the instant before it is still compression.
        expect(
          rotorFacePhaseAt(
            event.faceIndex,
            event.shaftAngleRad - degToRad(0.5),
            rotorPhaseRad,
          ),
        ).toBe("compression");
      }
    }
  });
});
