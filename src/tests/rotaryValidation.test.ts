import { describe, expect, it } from "vitest";
import { TWO_PI } from "../engine/constants";
import {
  DEFAULT_ROTARY_CONFIG,
  ROTARY_INPUT_RANGES,
  ROTARY_MIN_K_FACTOR,
  ROTARY_ROTOR_COUNTS,
} from "../engine/rotaryConstants";
import { housingPointMm } from "../engine/rotaryGeometry";
import type { RotaryConfig, RotaryPointMm } from "../engine/rotaryTypes";
import {
  isRotaryRotorCount,
  validateRotaryConfig,
} from "../engine/rotaryValidation";

function withOverrides(overrides: Partial<RotaryConfig>): RotaryConfig {
  return { ...DEFAULT_ROTARY_CONFIG, ...overrides };
}

function issueFields(config: unknown): string[] {
  const result = validateRotaryConfig(config);
  return result.ok ? [] : result.issues.map((issue) => issue.field);
}

describe("validateRotaryConfig - accepted configurations", () => {
  it("accepts the default 13B geometry", () => {
    const result = validateRotaryConfig(DEFAULT_ROTARY_CONFIG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config).toEqual(DEFAULT_ROTARY_CONFIG);
    }
  });

  it("accepts every range endpoint that also satisfies the trochoid rule", () => {
    expect(
      validateRotaryConfig(
        withOverrides({
          generatingRadiusMm: ROTARY_INPUT_RANGES.generatingRadiusMm.min,
          eccentricityMm: ROTARY_INPUT_RANGES.eccentricityMm.min,
          rotorWidthMm: ROTARY_INPUT_RANGES.rotorWidthMm.min,
          compressionRatio: ROTARY_INPUT_RANGES.compressionRatio.min,
          redlineRpm: ROTARY_INPUT_RANGES.redlineRpm.min,
        }),
      ).ok,
    ).toBe(true);

    expect(
      validateRotaryConfig(
        withOverrides({
          generatingRadiusMm: ROTARY_INPUT_RANGES.generatingRadiusMm.max,
          eccentricityMm: ROTARY_INPUT_RANGES.eccentricityMm.max,
          rotorWidthMm: ROTARY_INPUT_RANGES.rotorWidthMm.max,
          compressionRatio: ROTARY_INPUT_RANGES.compressionRatio.max,
          redlineRpm: ROTARY_INPUT_RANGES.redlineRpm.max,
        }),
      ).ok,
    ).toBe(true);
  });

  it("permits an unfashionably low K, which is the point of the application", () => {
    // K = 4: a deep-waisted housing nobody would build, and perfectly valid.
    expect(
      validateRotaryConfig(
        withOverrides({ generatingRadiusMm: 80, eccentricityMm: 20 }),
      ).ok,
    ).toBe(true);
  });
});

describe("validateRotaryConfig - per-field ranges", () => {
  const cases: {
    label: string;
    overrides: Partial<RotaryConfig>;
    field: string;
  }[] = [
    {
      label: "generating radius below range",
      overrides: { generatingRadiusMm: 10, eccentricityMm: 8 },
      field: "generatingRadiusMm",
    },
    {
      label: "generating radius above range",
      overrides: { generatingRadiusMm: 500 },
      field: "generatingRadiusMm",
    },
    {
      label: "eccentricity below range",
      overrides: { eccentricityMm: 1 },
      field: "eccentricityMm",
    },
    {
      label: "eccentricity above range",
      overrides: { eccentricityMm: 60 },
      field: "eccentricityMm",
    },
    {
      label: "rotor width below range",
      overrides: { rotorWidthMm: 5 },
      field: "rotorWidthMm",
    },
    {
      label: "rotor width above range",
      overrides: { rotorWidthMm: 400 },
      field: "rotorWidthMm",
    },
    {
      label: "compression ratio below range",
      overrides: { compressionRatio: 4 },
      field: "compressionRatio",
    },
    {
      label: "compression ratio above range",
      overrides: { compressionRatio: 25 },
      field: "compressionRatio",
    },
    {
      label: "redline below range",
      overrides: { redlineRpm: 100 },
      field: "redlineRpm",
    },
    {
      label: "redline above range",
      overrides: { redlineRpm: 50_000 },
      field: "redlineRpm",
    },
  ];

  for (const { label, overrides, field } of cases) {
    it(`rejects ${label}`, () => {
      expect(issueFields(withOverrides(overrides))).toContain(field);
    });
  }

  it("rejects non-finite and non-numeric values", () => {
    expect(
      validateRotaryConfig(withOverrides({ eccentricityMm: NaN })).ok,
    ).toBe(false);
    expect(
      validateRotaryConfig(withOverrides({ generatingRadiusMm: Infinity })).ok,
    ).toBe(false);
    expect(
      validateRotaryConfig({
        ...DEFAULT_ROTARY_CONFIG,
        rotorWidthMm: "80",
      }).ok,
    ).toBe(false);
    expect(validateRotaryConfig(null).ok).toBe(false);
    expect(validateRotaryConfig(undefined).ok).toBe(false);
    expect(validateRotaryConfig({}).ok).toBe(false);
  });
});

describe("validateRotaryConfig - the trochoid cross-field rule", () => {
  it("rejects K below 3, even when every field is individually in range", () => {
    // R = 60 and e = 25 are both legal on their own; together they are a
    // housing that crosses itself. This is the rotary's `rodLength > stroke/2`.
    const config = withOverrides({
      generatingRadiusMm: 60,
      eccentricityMm: 25,
    });
    const result = validateRotaryConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.field)).toContain(
        "generatingRadiusMm",
      );
      expect(result.issues[0]?.message).toMatch(/crosses itself/);
    }
  });

  it("rejects K exactly 3 -- the cusp", () => {
    expect(
      validateRotaryConfig(
        withOverrides({ generatingRadiusMm: 75, eccentricityMm: 25 }),
      ).ok,
    ).toBe(false);
  });

  it("accepts K just above 3", () => {
    expect(
      validateRotaryConfig(
        withOverrides({ generatingRadiusMm: 76, eccentricityMm: 25 }),
      ).ok,
    ).toBe(true);
  });

  it("names the actual threshold in the message", () => {
    const result = validateRotaryConfig(
      withOverrides({ generatingRadiusMm: 60, eccentricityMm: 25 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain("75 mm");
      expect(result.issues[0]?.message).toContain("25 mm");
    }
  });
});

describe("why the K > 3 floor exists", () => {
  it("matches the analytic cusp condition min |P'(alpha)| = |R - 3e|", () => {
    // |P'|^2 = 9e^2 + R^2 + 6eR*cos2alpha, minimized at cos2alpha = -1.
    const e = 15;
    for (const k of [2, 2.4, 3, 3.5, 7, 13]) {
      const r = k * e;
      let minSpeed = Infinity;
      for (let i = 0; i < 20000; i += 1) {
        const alpha = (TWO_PI * i) / 20000;
        minSpeed = Math.min(
          minSpeed,
          Math.hypot(
            -3 * e * Math.sin(3 * alpha) - r * Math.sin(alpha),
            3 * e * Math.cos(3 * alpha) + r * Math.cos(alpha),
          ),
        );
      }
      expect(minSpeed).toBeCloseTo(Math.abs(r - ROTARY_MIN_K_FACTOR * e), 3);
    }
  });

  it("finds real self-intersections below the floor and none above it", () => {
    // The algebraic argument, corroborated by walking the outline and looking
    // for crossing segments. `ROTARY_MIN_K_FACTOR` is not a style preference.
    expect(outlineSelfIntersects(2.4)).toBe(true);
    expect(outlineSelfIntersects(2.9)).toBe(true);
    expect(outlineSelfIntersects(3.1)).toBe(false);
    expect(outlineSelfIntersects(7)).toBe(false);
  });
});

/** True when the sampled housing outline at K = R/e crosses itself. */
function outlineSelfIntersects(kFactor: number): boolean {
  const config: RotaryConfig = withOverrides({
    eccentricityMm: 15,
    generatingRadiusMm: 15 * kFactor,
  });
  const count = 720;
  const points: RotaryPointMm[] = [];
  for (let i = 0; i < count; i += 1) {
    points.push(housingPointMm(config, (TWO_PI * i) / count));
  }

  const crosses = (
    p: RotaryPointMm,
    q: RotaryPointMm,
    r: RotaryPointMm,
    s: RotaryPointMm,
  ): boolean => {
    const denominator =
      (q.xMm - p.xMm) * (s.yMm - r.yMm) - (q.yMm - p.yMm) * (s.xMm - r.xMm);
    if (Math.abs(denominator) < 1e-12) return false;
    const t =
      ((r.xMm - p.xMm) * (s.yMm - r.yMm) - (r.yMm - p.yMm) * (s.xMm - r.xMm)) /
      denominator;
    const u =
      ((r.xMm - p.xMm) * (q.yMm - p.yMm) - (r.yMm - p.yMm) * (q.xMm - p.xMm)) /
      denominator;
    return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
  };

  for (let i = 0; i < count; i += 1) {
    for (let j = i + 2; j < count; j += 1) {
      if (i === 0 && j === count - 1) continue;
      if (
        crosses(
          points[i] as RotaryPointMm,
          points[(i + 1) % count] as RotaryPointMm,
          points[j] as RotaryPointMm,
          points[(j + 1) % count] as RotaryPointMm,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

describe("isRotaryRotorCount", () => {
  it("accepts 1, 2, and 3", () => {
    for (const count of ROTARY_ROTOR_COUNTS) {
      expect(isRotaryRotorCount(count)).toBe(true);
    }
  });

  it("rejects everything else", () => {
    for (const value of [0, 4, -1, 2.5, "2", null, undefined, {}, [2]]) {
      expect(isRotaryRotorCount(value)).toBe(false);
    }
  });
});
