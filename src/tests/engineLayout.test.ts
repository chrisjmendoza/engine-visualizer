import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT_ID,
  ENGINE_ARCHITECTURE_IDS,
  ENGINE_LAYOUT_IDS,
  createEngineLayout,
  cylinderCrankAngleRad,
  cylinderTdcAngleRad,
  firingIntervalsRad,
  firingSequenceRad,
  isEngineLayoutId,
  sharesCrankpin,
  visibleCylinderCount,
  visibleCylinders,
  type CylinderDefinition,
  type EngineLayoutDefinition,
  type EngineLayoutId,
  type EngineLayoutKind,
} from "../engine/engineLayout";
import { TWO_PI } from "../engine/constants";

const DEG = Math.PI / 180;

/**
 * The documented layout roster, restated in degrees (§24a).
 *
 * `crankPhaseDeg` is the negation of each cylinder's TDC angle, exactly as
 * `engineLayout.ts` derives it, and `firingIntervalsDeg` is the firing pattern
 * that layout's comment claims. Keeping both here means a table transcribed
 * wrong in the module fails against numbers written independently of it.
 */
interface ExpectedLayout {
  kind: EngineLayoutKind;
  bankAngleDeg: number;
  crankPhaseDeg: readonly number[];
  firingIntervalsDeg: readonly number[];
}

const even = (count: number): number[] => Array(count).fill(720 / count);

const EXPECTED: Record<EngineLayoutId, ExpectedLayout> = {
  single: {
    kind: "single",
    bankAngleDeg: 0,
    crankPhaseDeg: [0],
    firingIntervalsDeg: [720],
  },
  "inline-3": {
    kind: "inline",
    bankAngleDeg: 0,
    crankPhaseDeg: [0, 240, 120],
    firingIntervalsDeg: even(3),
  },
  "inline-4": {
    kind: "inline",
    bankAngleDeg: 0,
    crankPhaseDeg: [0, 180, 180, 0],
    firingIntervalsDeg: even(4),
  },
  "inline-5": {
    kind: "inline",
    bankAngleDeg: 0,
    crankPhaseDeg: [0, 216, 144, 72, 288],
    firingIntervalsDeg: even(5),
  },
  "inline-6": {
    kind: "inline",
    bankAngleDeg: 0,
    crankPhaseDeg: [0, 240, 120, 120, 240, 0],
    firingIntervalsDeg: even(6),
  },
  "v6-60": {
    kind: "v",
    bankAngleDeg: 60,
    crankPhaseDeg: [0, 120, 240, 0, 120, 240],
    firingIntervalsDeg: even(6),
  },
  "v6-90-odd": {
    kind: "v",
    bankAngleDeg: 90,
    crankPhaseDeg: [0, 90, 240, 330, 120, 210],
    // The odd-fire beat: never even, never 120°.
    firingIntervalsDeg: [150, 90, 150, 90, 150, 90],
  },
  "v8-cross": {
    kind: "v",
    bankAngleDeg: 90,
    crankPhaseDeg: [0, 90, 90, 180, 270, 0, 180, 270],
    firingIntervalsDeg: even(8),
  },
  "v8-flat": {
    kind: "v",
    bankAngleDeg: 90,
    crankPhaseDeg: [0, 90, 180, 270, 180, 270, 0, 90],
    firingIntervalsDeg: even(8),
  },
  "v10-72": {
    kind: "v",
    bankAngleDeg: 72,
    crankPhaseDeg: [0, 72, 216, 288, 144, 216, 72, 144, 288, 0],
    firingIntervalsDeg: even(10),
  },
  "v12-60": {
    kind: "v",
    bankAngleDeg: 60,
    crankPhaseDeg: [0, 60, 240, 300, 120, 180, 120, 180, 240, 300, 0, 60],
    firingIntervalsDeg: even(12),
  },
  "flat-4": {
    kind: "flat",
    bankAngleDeg: 180,
    crankPhaseDeg: [0, 0, 180, 180],
    firingIntervalsDeg: even(4),
  },
  "flat-6": {
    kind: "flat",
    bankAngleDeg: 180,
    crankPhaseDeg: [0, 0, 120, 120, 240, 240],
    firingIntervalsDeg: even(6),
  },
};

/**
 * Where a cylinder's crankpin actually sits, as an angle around the
 * crankshaft, once its mechanism has been rotated onto its bank.
 *
 * Rotating a drawn mechanism by `bankOffsetRad` moves the pin drawn at local
 * crank angle ψ to where an unrotated mechanism would draw ψ − bankOffsetRad,
 * so this is the quantity two cylinders sharing one physical crankpin must
 * agree on at every crank angle. It is derived here from the two published
 * fields, so a table that folded the bank offset into the phase (the mistake
 * §24a warns about) would show up as pins that no longer coincide.
 */
function pinAngleRad(cylinder: CylinderDefinition, crankAngleRad: number) {
  const raw =
    crankAngleRad + cylinder.crankPhaseRad - cylinder.bankOffsetRad + TWO_PI;
  return raw % TWO_PI;
}

/** Signed separation of two angles, wrapped into (-π, π]. */
function angleDeltaDeg(a: number, b: number): number {
  const delta = (((a - b) % TWO_PI) + TWO_PI) % TWO_PI;
  return (delta > Math.PI ? delta - TWO_PI : delta) / DEG;
}

const SAMPLE_ANGLES_RAD = [0, 0.7, 1.9, Math.PI, 4.2, 5.8];

/** Bank pairs (bank 0 index, bank 1 index) of a V or flat layout. */
function bankPairs(layout: EngineLayoutDefinition): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < layout.cylinders.length; i += 2) {
    pairs.push([i, i + 1]);
  }
  return pairs;
}

describe("createEngineLayout — roster", () => {
  it("covers every documented layout id, each reporting its own id", () => {
    expect(ENGINE_LAYOUT_IDS).toHaveLength(13);
    for (const id of ENGINE_LAYOUT_IDS) {
      expect(createEngineLayout(id).id).toBe(id);
      expect(createEngineLayout(id).label.length).toBeGreaterThan(0);
    }
  });

  it("gives every layout a distinct label", () => {
    const labels = ENGINE_LAYOUT_IDS.map((id) => createEngineLayout(id).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("returns a shared, frozen instance rather than rebuilding per call", () => {
    const a = createEngineLayout("v8-cross");
    const b = createEngineLayout("v8-cross");
    expect(a).toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.cylinders)).toBe(true);
    expect(Object.isFrozen(a.firingOrder)).toBe(true);
  });
});

for (const id of ENGINE_LAYOUT_IDS) {
  const expected = EXPECTED[id];

  describe(`layout ${id}`, () => {
    const layout = createEngineLayout(id);
    const count = expected.crankPhaseDeg.length;

    it(`has ${count} cylinders with sequential indices`, () => {
      expect(layout.cylinders).toHaveLength(count);
      layout.cylinders.forEach((cylinder, i) => {
        expect(cylinder.index).toBe(i);
      });
    });

    it("is of the documented kind and bank angle", () => {
      expect(layout.kind).toBe(expected.kind);
      expect(layout.bankAngleRad).toBeCloseTo(expected.bankAngleDeg * DEG, 12);
    });

    it("matches the documented crank-throw phase table", () => {
      const phases = layout.cylinders.map((c) => c.crankPhaseRad);
      expect(phases).toHaveLength(expected.crankPhaseDeg.length);
      phases.forEach((phase, i) => {
        expect(phase).toBeCloseTo(
          (expected.crankPhaseDeg[i] as number) * DEG,
          12,
        );
      });
    });

    it("puts cylinder 0's phase at exactly 0", () => {
      expect(layout.cylinders[0]?.crankPhaseRad).toBe(0);
    });

    it("keeps every phase in [0, 2π)", () => {
      for (const cylinder of layout.cylinders) {
        expect(cylinder.crankPhaseRad).toBeGreaterThanOrEqual(0);
        expect(cylinder.crankPhaseRad).toBeLessThan(TWO_PI);
      }
    });

    it("assigns bank indices and bank offsets to match the kind", () => {
      const banked = expected.kind === "v" || expected.kind === "flat";
      for (const cylinder of layout.cylinders) {
        if (!banked) {
          expect(cylinder.bankIndex).toBe(0);
          expect(cylinder.bankOffsetRad).toBe(0);
          continue;
        }
        // V and flat layouts alternate banks along the crank, so index 2k and
        // 2k+1 are the pair on throw k.
        expect(cylinder.bankIndex).toBe(cylinder.index % 2);
        expect(cylinder.bankOffsetRad).toBeCloseTo(
          (cylinder.bankIndex === 0 ? -1 : 1) *
            (expected.bankAngleDeg / 2) *
            DEG,
          12,
        );
      }
    });

    it("fires each cylinder exactly once per 720° cycle", () => {
      const events = firingSequenceRad(layout);
      expect(events).toHaveLength(count);
      expect(new Set(events.map((e) => e.index)).size).toBe(count);
      expect(events[0]?.crankAngleRad).toBe(0);
      for (const event of events) {
        expect(event.crankAngleRad).toBeGreaterThanOrEqual(0);
        expect(event.crankAngleRad).toBeLessThan(2 * TWO_PI);
      }
      // Strictly increasing: a firing order that did not fit its crank table
      // could only produce a sequence that stalled or ran past the cycle.
      for (let i = 1; i < events.length; i += 1) {
        expect(events[i]!.crankAngleRad).toBeGreaterThan(
          events[i - 1]!.crankAngleRad,
        );
      }
    });

    it("matches the documented firing intervals", () => {
      const intervals = firingIntervalsRad(layout).map((rad) => rad / DEG);
      expect(intervals).toHaveLength(expected.firingIntervalsDeg.length);
      intervals.forEach((interval, i) => {
        expect(interval).toBeCloseTo(
          expected.firingIntervalsDeg[i] as number,
          9,
        );
      });
      // Whatever the pattern, the firings must fill exactly one 720° cycle.
      const total = intervals.reduce((sum, value) => sum + value, 0);
      expect(total).toBeCloseTo(720, 9);
    });

    it("fires each cylinder at one of its own TDC angles", () => {
      for (const event of firingSequenceRad(layout)) {
        const cylinder = layout.cylinders[event.index] as CylinderDefinition;
        const tdc = cylinderTdcAngleRad(cylinder);
        expect(angleDeltaDeg(event.crankAngleRad, tdc)).toBeCloseTo(0, 9);
      }
    });
  });
}

describe("firing intervals — even fire vs odd fire", () => {
  it("spaces every even-fire layout at exactly 720/N", () => {
    for (const id of ENGINE_LAYOUT_IDS) {
      if (id === "v6-90-odd" || id === "single") continue;
      const layout = createEngineLayout(id);
      const expectedDeg = 720 / layout.cylinders.length;
      for (const interval of firingIntervalsRad(layout)) {
        expect(interval / DEG).toBeCloseTo(expectedDeg, 9);
      }
    }
  });

  it("keeps the 90° V6 genuinely odd-fire, alternating 150° and 90°", () => {
    const intervals = firingIntervalsRad(createEngineLayout("v6-90-odd")).map(
      (rad) => rad / DEG,
    );
    expect(intervals).toHaveLength(6);
    intervals.forEach((interval, i) => {
      expect(interval).toBeCloseTo(i % 2 === 0 ? 150 : 90, 9);
    });
    // And explicitly not the even-fire 120° it would collapse to if the split
    // journals of an even-fire V6 were assumed by mistake.
    for (const interval of intervals) {
      expect(Math.abs(interval - 120)).toBeGreaterThan(1);
    }
  });
});

describe("crankpin sharing — phase and bank offset stay separate", () => {
  /** Layouts whose bank pairs sit on one shared (unsplit) crankpin. */
  const SHARED_PIN: EngineLayoutId[] = [
    "v6-90-odd",
    "v8-cross",
    "v8-flat",
    "v10-72",
    "v12-60",
  ];

  for (const id of SHARED_PIN) {
    it(`${id}: both cylinders of a throw sit on the same crankpin`, () => {
      const layout = createEngineLayout(id);
      for (const [a, b] of bankPairs(layout)) {
        for (const theta of SAMPLE_ANGLES_RAD) {
          const pinA = pinAngleRad(layout.cylinders[a]!, theta);
          const pinB = pinAngleRad(layout.cylinders[b]!, theta);
          expect(angleDeltaDeg(pinA, pinB)).toBeCloseTo(0, 9);
        }
      }
    });
  }

  it("v6-60: the journals are split by 60°, which is what makes it even-fire", () => {
    const layout = createEngineLayout("v6-60");
    for (const [a, b] of bankPairs(layout)) {
      for (const theta of SAMPLE_ANGLES_RAD) {
        const delta = angleDeltaDeg(
          pinAngleRad(layout.cylinders[a]!, theta),
          pinAngleRad(layout.cylinders[b]!, theta),
        );
        expect(Math.abs(delta)).toBeCloseTo(60, 9);
      }
    }
  });

  for (const id of ["flat-4", "flat-6"] as const) {
    it(`${id}: opposed cylinders are on separate throws 180° apart (boxer, not 180° V)`, () => {
      const layout = createEngineLayout(id);
      for (const [a, b] of bankPairs(layout)) {
        for (const theta of SAMPLE_ANGLES_RAD) {
          const delta = angleDeltaDeg(
            pinAngleRad(layout.cylinders[a]!, theta),
            pinAngleRad(layout.cylinders[b]!, theta),
          );
          expect(Math.abs(delta)).toBeCloseTo(180, 9);
        }
      }
      // The boxer signature: opposed pistons reach their outer dead centers
      // together, so paired cylinders share a crank phase outright.
      for (const [a, b] of bankPairs(layout)) {
        expect(layout.cylinders[a]!.crankPhaseRad).toBeCloseTo(
          layout.cylinders[b]!.crankPhaseRad,
          12,
        );
      }
    });
  }
});

describe("sharesCrankpin — the predicate the renderer draws from (§24a)", () => {
  /**
   * Ground truth, taken the long way round: two cylinders share a pin only if
   * their pins coincide at every sampled crank angle. `sharesCrankpin` claims
   * to decide the same thing from the layout alone, without an angle, so the
   * two must agree everywhere.
   */
  function pinsCoincideAtEveryAngle(
    a: CylinderDefinition,
    b: CylinderDefinition,
  ): boolean {
    return SAMPLE_ANGLES_RAD.every(
      (theta) =>
        Math.abs(angleDeltaDeg(pinAngleRad(a, theta), pinAngleRad(b, theta))) <
        1e-6,
    );
  }

  it("agrees with sampled pin positions for every pair in the roster", () => {
    for (const id of ENGINE_LAYOUT_IDS) {
      const layout = createEngineLayout(id);
      for (const a of layout.cylinders) {
        for (const b of layout.cylinders) {
          expect(sharesCrankpin(a, b)).toBe(pinsCoincideAtEveryAngle(a, b));
        }
      }
    }
  });

  it("is reflexive: a cylinder shares its own pin", () => {
    for (const id of ENGINE_LAYOUT_IDS) {
      for (const cylinder of createEngineLayout(id).cylinders) {
        expect(sharesCrankpin(cylinder, cylinder)).toBe(true);
      }
    }
  });

  it("holds for a plain-pin V pair, so the renderer draws one crank there", () => {
    for (const id of [
      "v6-90-odd",
      "v8-cross",
      "v8-flat",
      "v10-72",
      "v12-60",
    ] as const) {
      const layout = createEngineLayout(id);
      for (const [a, b] of bankPairs(layout)) {
        expect(sharesCrankpin(layout.cylinders[a]!, layout.cylinders[b]!)).toBe(
          true,
        );
      }
    }
  });

  it("fails for the flying-arm V6 and for both boxers, whose pairs have two real pins", () => {
    // The 60° V6's separate, flying-arm-joined crankpins and the boxers'
    // antipodal throws are genuinely two pins each; a renderer that skipped
    // the second cylinder's crank here would leave its rod hanging off
    // nothing.
    for (const id of ["v6-60", "flat-4", "flat-6"] as const) {
      const layout = createEngineLayout(id);
      for (const [a, b] of bankPairs(layout)) {
        expect(sharesCrankpin(layout.cylinders[a]!, layout.cylinders[b]!)).toBe(
          false,
        );
      }
    }
  });

  it("never claims sharing across an inline engine's separate throws", () => {
    // Inline throws at the same angle (an inline-4's cylinders 1 and 4) are
    // distinct pins on one crank; only cylinders drawn around one crank center
    // can share, and an inline layout never draws two there.
    const inline4 = createEngineLayout("inline-4");
    expect(inline4.cylinders[0]!.crankPhaseRad).toBe(
      inline4.cylinders[3]!.crankPhaseRad,
    );
    // Same phase and no bank offset, so the predicate does say "coincident" —
    // which is why the scene applies it only within one drawn plane, never
    // across the row.
    expect(sharesCrankpin(inline4.cylinders[0]!, inline4.cylinders[3]!)).toBe(
      true,
    );
    expect(sharesCrankpin(inline4.cylinders[0]!, inline4.cylinders[1]!)).toBe(
      false,
    );
  });
});

describe("V8 cross-plane vs flat-plane", () => {
  /** Firing angles of one bank, in degrees, in firing order. */
  function bankFiringsDeg(id: EngineLayoutId, bankIndex: number): number[] {
    const layout = createEngineLayout(id);
    return firingSequenceRad(layout)
      .filter((event) => layout.cylinders[event.index]!.bankIndex === bankIndex)
      .map((event) => event.crankAngleRad / DEG);
  }

  /** Gaps between one bank's own firings, wrapping around the 720° cycle. */
  function bankIntervalsDeg(id: EngineLayoutId, bankIndex: number): number[] {
    const firings = bankFiringsDeg(id, bankIndex);
    return firings.map((angle, i) =>
      i + 1 < firings.length
        ? (firings[i + 1] as number) - angle
        : 720 - angle + (firings[0] as number),
    );
  }

  it("both V8s fire the whole engine evenly every 90°", () => {
    for (const id of ["v8-cross", "v8-flat"] as const) {
      for (const interval of firingIntervalsRad(createEngineLayout(id))) {
        expect(interval / DEG).toBeCloseTo(90, 9);
      }
    }
  });

  it("the flat-plane crank fires each bank evenly every 180°", () => {
    for (const bank of [0, 1]) {
      for (const interval of bankIntervalsDeg("v8-flat", bank)) {
        expect(interval).toBeCloseTo(180, 9);
      }
    }
  });

  it("the cross-plane crank does not — that is where its beat comes from", () => {
    for (const bank of [0, 1]) {
      const intervals = bankIntervalsDeg("v8-cross", bank);
      expect(intervals.some((interval) => Math.abs(interval - 180) > 1)).toBe(
        true,
      );
      // Same total per bank, distributed unevenly.
      expect(intervals.reduce((sum, value) => sum + value, 0)).toBeCloseTo(
        720,
        9,
      );
    }
  });

  it("distinguishes the two cranks by their throw arrangement", () => {
    // Bank 0's throws, as TDC angles: one plane (0/180) for the flat crank,
    // two perpendicular planes for the cross-plane crank.
    const throwsOf = (id: EngineLayoutId) =>
      new Set(
        createEngineLayout(id)
          .cylinders.filter((c) => c.bankIndex === 0)
          .map((c) => Math.round(cylinderTdcAngleRad(c) / DEG)),
      );

    expect([...throwsOf("v8-flat")].sort((a, b) => a - b)).toEqual([0, 180]);
    expect([...throwsOf("v8-cross")].sort((a, b) => a - b)).toEqual([
      0, 90, 180, 270,
    ]);
  });
});

describe("isEngineLayoutId", () => {
  it("accepts every layout in the roster", () => {
    for (const id of ENGINE_LAYOUT_IDS) {
      expect(isEngineLayoutId(id)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const value of [
      "",
      "inline-8",
      "v8",
      "V8-CROSS",
      4,
      null,
      undefined,
      {},
    ]) {
      expect(isEngineLayoutId(value)).toBe(false);
    }
  });
});

describe("cylinderCrankAngleRad", () => {
  const cylinderAt = (crankPhaseRad: number): CylinderDefinition => ({
    index: 0,
    bankIndex: 0,
    crankPhaseRad,
    bankOffsetRad: 0,
  });

  it("adds the cylinder's phase to the global crank angle", () => {
    const result = cylinderCrankAngleRad(Math.PI / 2, cylinderAt(Math.PI / 4));
    expect(result).toBeCloseTo(Math.PI / 2 + Math.PI / 4, 12);
  });

  it("wraps a sum past 2π back into [0, 2π)", () => {
    const result = cylinderCrankAngleRad(
      (3 * Math.PI) / 2,
      cylinderAt(Math.PI),
    );
    // (3π/2) + π = 5π/2, which wraps to π/2.
    expect(result).toBeCloseTo(Math.PI / 2, 12);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(TWO_PI);
  });

  it("normalizes even though a negative sum never occurs in practice", () => {
    const result = cylinderCrankAngleRad(-Math.PI / 2, cylinderAt(0));
    expect(result).toBeCloseTo((3 * Math.PI) / 2, 12);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(TWO_PI);
  });

  it("ignores the bank offset — that angle only rotates the drawing", () => {
    const vee = createEngineLayout("v8-cross");
    const cylinder = vee.cylinders[1] as CylinderDefinition;
    expect(cylinder.bankOffsetRad).not.toBe(0);
    expect(cylinderCrankAngleRad(0.4, cylinder)).toBeCloseTo(
      0.4 + cylinder.crankPhaseRad,
      12,
    );
  });

  it("matches a real cylinder's phase from a full layout", () => {
    const layout = createEngineLayout("inline-3");
    const secondCylinder = layout.cylinders[1] as CylinderDefinition;
    const result = cylinderCrankAngleRad(0, secondCylinder);
    expect(result).toBeCloseTo((4 * Math.PI) / 3, 12);
  });
});

describe("cylinderTdcAngleRad", () => {
  it("is the negation of the crank phase, normalized into [0, 2π)", () => {
    for (const id of ENGINE_LAYOUT_IDS) {
      for (const cylinder of createEngineLayout(id).cylinders) {
        const tdc = cylinderTdcAngleRad(cylinder);
        expect(tdc).toBeGreaterThanOrEqual(0);
        expect(tdc).toBeLessThan(TWO_PI);
        expect(angleDeltaDeg(tdc + cylinder.crankPhaseRad, 0)).toBeCloseTo(
          0,
          9,
        );
      }
    }
  });

  it("is the crank angle at which that cylinder's own angle is zero (TDC)", () => {
    const layout = createEngineLayout("inline-6");
    for (const cylinder of layout.cylinders) {
      const atTdc = cylinderCrankAngleRad(
        cylinderTdcAngleRad(cylinder),
        cylinder,
      );
      expect(angleDeltaDeg(atTdc, 0)).toBeCloseTo(0, 9);
    }
  });
});

describe("ENGINE_ARCHITECTURE_IDS — the pickable roster (§24a)", () => {
  it("is the full roster minus the legacy single-cylinder layout", () => {
    expect(ENGINE_ARCHITECTURE_IDS).toEqual(
      ENGINE_LAYOUT_IDS.filter((id) => id !== "single"),
    );
    expect(ENGINE_ARCHITECTURE_IDS).not.toContain("single");
  });

  it("contains no layout of kind `single` — one cylinder is a view, not an engine", () => {
    for (const id of ENGINE_ARCHITECTURE_IDS) {
      expect(createEngineLayout(id).kind).not.toBe("single");
      expect(createEngineLayout(id).cylinders.length).toBeGreaterThan(1);
    }
  });

  it("keeps `single` decodable, so old share links still resolve", () => {
    // Removed from the picker, never removed from the roster (§25a is
    // append-only).
    expect(isEngineLayoutId("single")).toBe(true);
    expect(createEngineLayout("single").cylinders).toHaveLength(1);
  });

  it("defaults to a real, pickable architecture", () => {
    expect(ENGINE_ARCHITECTURE_IDS).toContain(DEFAULT_LAYOUT_ID);
  });
});

describe("visibleCylinders — the one place the view decision is made (§24a)", () => {
  it("returns every cylinder when the whole engine is shown", () => {
    for (const id of ENGINE_LAYOUT_IDS) {
      const layout = createEngineLayout(id);
      expect(visibleCylinders(layout, false)).toBe(layout.cylinders);
      expect(visibleCylinderCount(layout, false)).toBe(layout.cylinders.length);
    }
  });

  it("returns just cylinder 0 in the single-cylinder view", () => {
    for (const id of ENGINE_LAYOUT_IDS) {
      const layout = createEngineLayout(id);
      const visible = visibleCylinders(layout, true);

      expect(visible).toHaveLength(1);
      expect(visibleCylinderCount(layout, true)).toBe(1);
      // The architecture is untouched: it is genuinely that engine's own
      // cylinder 0, with its phase and bank tilt intact.
      expect(visible[0]).toBe(layout.cylinders[0]);
      expect(visible[0]?.index).toBe(0);
      expect(visible[0]?.crankPhaseRad).toBe(0);
    }
  });

  it("returns a shared, frozen array rather than allocating per call", () => {
    // Scene code holds these across frames and must never allocate per frame
    // (§18), so repeated calls hand back the same instance.
    const layout = createEngineLayout("v8-cross");
    expect(visibleCylinders(layout, true)).toBe(visibleCylinders(layout, true));
    expect(Object.isFrozen(visibleCylinders(layout, true))).toBe(true);
  });

  it("never confuses one layout's cylinder 0 with another's", () => {
    const flat = visibleCylinders(createEngineLayout("flat-4"), true)[0];
    const inline = visibleCylinders(createEngineLayout("inline-4"), true)[0];

    expect(flat?.bankOffsetRad).not.toBe(inline?.bankOffsetRad);
  });
});
