import { describe, expect, it } from "vitest";
import { ENGINE_PRESETS } from "../engine/presets";
import { validateConfig } from "../engine/validation";

/**
 * Advertised total displacement (cc) and cylinder count for each preset
 * engine, taken independently from the preset's bore/stroke/rod values so
 * this test actually checks the geometry against the real engine rather
 * than against itself.
 */
const ADVERTISED: Record<string, { cylinders: number; totalCc: number }> = {
  "s2000-ap1": { cylinders: 4, totalCc: 1997 },
  "s2000-ap2": { cylinders: 4, totalCc: 2157 },
  "miata-na-nb-1-8": { cylinders: 4, totalCc: 1839 },
  "miata-na-1-6": { cylinders: 4, totalCc: 1597 },
  "corvette-c6-ls3": { cylinders: 8, totalCc: 6162 },
  "corvette-z06-c6-ls7": { cylinders: 8, totalCc: 7011 },
  "supra-2jzgte": { cylinders: 6, totalCc: 2997 },
  "k20a-type-r": { cylinders: 4, totalCc: 1998 },
  "miata-nd-2-0": { cylinders: 4, totalCc: 1998 },
};

/**
 * Factory stock compression ratio for each preset engine (see the source
 * comments in `src/engine/presets.ts`), hardcoded here as an independent
 * literal so this test checks the preset's value against the real engine
 * rather than against itself.
 */
const ADVERTISED_COMPRESSION_RATIO: Record<string, number> = {
  "s2000-ap1": 11.0,
  "s2000-ap2": 11.1,
  "miata-na-nb-1-8": 9.0,
  "miata-na-1-6": 9.4,
  "corvette-c6-ls3": 10.7,
  "corvette-z06-c6-ls7": 11.0,
  "supra-2jzgte": 8.5,
  "k20a-type-r": 11.5,
  "miata-nd-2-0": 13.0,
};

function perCylinderCc(boreMm: number, strokeMm: number): number {
  const radiusMm = boreMm / 2;
  return (Math.PI * radiusMm * radiusMm * strokeMm) / 1000;
}

describe("ENGINE_PRESETS", () => {
  it("has a unique id for every preset", () => {
    const ids = ENGINE_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has an advertised-displacement fixture for every preset", () => {
    for (const preset of ENGINE_PRESETS) {
      expect(ADVERTISED[preset.id]).toBeDefined();
    }
  });

  it.each(ENGINE_PRESETS)(
    "$name ($engineCode) passes validateConfig",
    (preset) => {
      const result = validateConfig(preset.config);
      expect(result.ok).toBe(true);
    },
  );

  it.each(ENGINE_PRESETS)(
    "$name ($engineCode) per-cylinder displacement matches advertised total within 2%",
    (preset) => {
      const advertised = ADVERTISED[preset.id];
      expect(advertised).toBeDefined();
      if (!advertised) return;

      const computedTotalCc =
        perCylinderCc(preset.config.boreMm, preset.config.strokeMm) *
        advertised.cylinders;

      const relativeError =
        Math.abs(computedTotalCc - advertised.totalCc) / advertised.totalCc;
      expect(relativeError).toBeLessThanOrEqual(0.02);
    },
  );

  it.each(ENGINE_PRESETS)(
    "$name ($engineCode) has a plausible rod/stroke ratio",
    (preset) => {
      const ratio = preset.config.rodLengthMm / preset.config.strokeMm;
      expect(ratio).toBeGreaterThanOrEqual(1.4);
      expect(ratio).toBeLessThanOrEqual(2.1);
    },
  );

  it("has an advertised-compression-ratio fixture for every preset", () => {
    for (const preset of ENGINE_PRESETS) {
      expect(ADVERTISED_COMPRESSION_RATIO[preset.id]).toBeDefined();
    }
  });

  it.each(ENGINE_PRESETS)(
    "$name ($engineCode) compression ratio has a plausible stock value (8-14)",
    (preset) => {
      expect(preset.config.compressionRatio).toBeGreaterThanOrEqual(8);
      expect(preset.config.compressionRatio).toBeLessThanOrEqual(14);
    },
  );

  it.each(ENGINE_PRESETS)(
    "$name ($engineCode) compression ratio matches the advertised factory figure",
    (preset) => {
      const advertised = ADVERTISED_COMPRESSION_RATIO[preset.id];
      expect(advertised).toBeDefined();
      expect(preset.config.compressionRatio).toBe(advertised);
    },
  );
});
