import { describe, expect, it } from "vitest";
import {
  crankMechanismConfigSchema,
  rpmSchema,
  validateConfig,
} from "../engine/validation";
import { DEFAULT_CONFIG, INPUT_RANGES } from "../engine/constants";

describe("validateConfig - acceptance", () => {
  it("accepts the default configuration", () => {
    const result = validateConfig(DEFAULT_CONFIG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config).toEqual(DEFAULT_CONFIG);
    }
  });

  it("accepts a configuration at the edges of the input ranges", () => {
    // strokeMm.min=20 gives a 10 mm crank radius, which rodLengthMm.min=30
    // clears comfortably, so every field can sit at its range boundary.
    const result = validateConfig({
      boreMm: INPUT_RANGES.boreMm.min,
      strokeMm: INPUT_RANGES.strokeMm.min,
      rodLengthMm: INPUT_RANGES.rodLengthMm.min,
      compressionRatio: INPUT_RANGES.compressionRatio.min,
      redlineRpm: INPUT_RANGES.redlineRpm.min,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a rod length just barely greater than the crank radius", () => {
    const result = validateConfig({
      boreMm: 80,
      strokeMm: 100,
      rodLengthMm: 50.001,
      compressionRatio: 10,
      redlineRpm: 7000,
    });
    expect(result.ok).toBe(true);
  });
});

describe("validateConfig - rejection", () => {
  it("rejects a zero bore", () => {
    const result = validateConfig({ ...DEFAULT_CONFIG, boreMm: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.field === "boreMm")).toBe(
        true,
      );
    }
  });

  it("rejects a negative stroke", () => {
    const result = validateConfig({ ...DEFAULT_CONFIG, strokeMm: -10 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.field === "strokeMm")).toBe(
        true,
      );
    }
  });

  it("rejects a negative rod length", () => {
    const result = validateConfig({ ...DEFAULT_CONFIG, rodLengthMm: -1 });
    expect(result.ok).toBe(false);
  });

  it("rejects a rod length equal to the crank radius", () => {
    const result = validateConfig({
      boreMm: 86,
      strokeMm: 86,
      rodLengthMm: 43,
      compressionRatio: 10.5,
      redlineRpm: 7000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((item) => item.field === "rodLengthMm");
      expect(issue).toBeDefined();
      expect(issue?.message).toContain("43 mm crank radius");
    }
  });

  it("rejects a rod length shorter than the crank radius", () => {
    const result = validateConfig({
      boreMm: 86,
      strokeMm: 86,
      rodLengthMm: 30,
      compressionRatio: 10.5,
      redlineRpm: 7000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.field === "rodLengthMm")).toBe(
        true,
      );
    }
  });

  it("rejects a rod length that individually passes its range but fails the crank-radius rule", () => {
    // rodLengthMm=90 is within INPUT_RANGES.rodLengthMm (30-400), but
    // strokeMm=200 gives a crank radius of 100 mm, which the rod does not
    // clear. The cross-field rule must win even though each field alone
    // would pass its own min/max check.
    const result = validateConfig({
      boreMm: 90,
      strokeMm: 200,
      rodLengthMm: 90,
      compressionRatio: 10.5,
      redlineRpm: 7000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((item) => item.field === "rodLengthMm");
      expect(issue?.message).toContain("100 mm crank radius");
    }
  });

  it("rejects NaN values", () => {
    const result = validateConfig({ ...DEFAULT_CONFIG, boreMm: Number.NaN });
    expect(result.ok).toBe(false);
  });

  it("rejects Infinity values", () => {
    const result = validateConfig({
      ...DEFAULT_CONFIG,
      rodLengthMm: Number.POSITIVE_INFINITY,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects values below the practical input range", () => {
    const result = validateConfig({ ...DEFAULT_CONFIG, boreMm: 5 });
    expect(result.ok).toBe(false);
  });

  it("rejects values above the practical input range", () => {
    const result = validateConfig({ ...DEFAULT_CONFIG, strokeMm: 500 });
    expect(result.ok).toBe(false);
  });

  it("rejects a compression ratio below the practical range", () => {
    const result = validateConfig({ ...DEFAULT_CONFIG, compressionRatio: 4 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find(
        (item) => item.field === "compressionRatio",
      );
      expect(issue?.message).toBe("Compression ratio must be at least 5:1.");
    }
  });

  it("rejects a compression ratio above the practical range", () => {
    const result = validateConfig({ ...DEFAULT_CONFIG, compressionRatio: 25 });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-finite compression ratio", () => {
    const result = validateConfig({
      ...DEFAULT_CONFIG,
      compressionRatio: Number.NaN,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a redline below the practical range", () => {
    const result = validateConfig({ ...DEFAULT_CONFIG, redlineRpm: 2999 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((item) => item.field === "redlineRpm");
      expect(issue?.message).toBe("Redline must be at least 3,000 RPM.");
    }
  });

  it("rejects a redline above the practical range", () => {
    const result = validateConfig({ ...DEFAULT_CONFIG, redlineRpm: 12001 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((item) => item.field === "redlineRpm");
      expect(issue?.message).toBe("Redline must be at most 12,000 RPM.");
    }
  });

  it("rejects a non-finite redline", () => {
    const result = validateConfig({
      ...DEFAULT_CONFIG,
      redlineRpm: Number.NaN,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(validateConfig(null).ok).toBe(false);
    expect(validateConfig(undefined).ok).toBe(false);
    expect(validateConfig("not a config").ok).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = validateConfig({ boreMm: 86, strokeMm: 86 });
    expect(result.ok).toBe(false);
  });

  it("produces a useful, mechanically worded message", () => {
    const result = validateConfig({
      boreMm: 86,
      strokeMm: 86,
      rodLengthMm: 43,
      compressionRatio: 10.5,
      redlineRpm: 7000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toBe(
        "Connecting-rod length must be greater than the 43 mm crank radius.",
      );
    }
  });
});

describe("rpmSchema", () => {
  it("accepts values within range", () => {
    expect(rpmSchema.safeParse(0).success).toBe(true);
    expect(rpmSchema.safeParse(600).success).toBe(true);
    expect(rpmSchema.safeParse(INPUT_RANGES.rpm.max).success).toBe(true);
  });

  it("rejects negative RPM", () => {
    expect(rpmSchema.safeParse(-1).success).toBe(false);
  });

  it("rejects RPM above the practical maximum", () => {
    expect(rpmSchema.safeParse(INPUT_RANGES.rpm.max + 1).success).toBe(false);
  });

  it("accepts an rpm equal to the highest legal redline — every redline the config validator accepts must also be an acceptable running speed", () => {
    expect(rpmSchema.safeParse(INPUT_RANGES.redlineRpm.max).success).toBe(true);
  });

  it("rejects non-finite RPM", () => {
    expect(rpmSchema.safeParse(Number.NaN).success).toBe(false);
    expect(rpmSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
  });
});

describe("crankMechanismConfigSchema", () => {
  it("is the schema validateConfig relies on", () => {
    expect(crankMechanismConfigSchema.safeParse(DEFAULT_CONFIG).success).toBe(
      true,
    );
  });
});
