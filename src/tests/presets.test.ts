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
  "ferrari-458-italia": { cylinders: 8, totalCc: 4497 },
  "silvia-sr20det": { cylinders: 4, totalCc: 1998 },
  "skyline-gtr-rb26dett": { cylinders: 6, totalCc: 2568 },
  "gtr-r35-vr38dett": { cylinders: 6, totalCc: 3799 },
  "bmw-e46-m3-s54": { cylinders: 6, totalCc: 3246 },
  "240sx-ka24de": { cylinders: 4, totalCc: 2389 },
  "tsx-k24a2": { cylinders: 4, totalCc: 2354 },
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
  "ferrari-458-italia": 12.5,
  "silvia-sr20det": 8.5,
  "skyline-gtr-rb26dett": 8.5,
  "gtr-r35-vr38dett": 9.0,
  "bmw-e46-m3-s54": 11.5,
  "240sx-ka24de": 9.5,
  "tsx-k24a2": 10.5,
};

/**
 * Factory rated redline (RPM) for each preset engine, hardcoded here as an
 * independent literal for the same reason as the displacement and
 * compression-ratio fixtures above.
 */
const ADVERTISED_REDLINE_RPM: Record<string, number> = {
  "s2000-ap1": 9000,
  "s2000-ap2": 8000,
  "miata-na-nb-1-8": 7000,
  "miata-na-1-6": 7200,
  "corvette-c6-ls3": 6600,
  "corvette-z06-c6-ls7": 7000,
  "supra-2jzgte": 6800,
  "k20a-type-r": 8400,
  "miata-nd-2-0": 7500,
  "ferrari-458-italia": 9000,
  "silvia-sr20det": 7500,
  "skyline-gtr-rb26dett": 8000,
  "gtr-r35-vr38dett": 7100,
  "bmw-e46-m3-s54": 8000,
  "240sx-ka24de": 6900,
  "tsx-k24a2": 7100,
};

/** Manufacturer brand for each preset, hardcoded as an independent literal. */
const ADVERTISED_BRAND: Record<string, string> = {
  "s2000-ap1": "Honda",
  "s2000-ap2": "Honda",
  "miata-na-nb-1-8": "Mazda",
  "miata-na-1-6": "Mazda",
  "corvette-c6-ls3": "Chevrolet",
  "corvette-z06-c6-ls7": "Chevrolet",
  "supra-2jzgte": "Toyota",
  "k20a-type-r": "Honda",
  "miata-nd-2-0": "Mazda",
  "ferrari-458-italia": "Ferrari",
  "silvia-sr20det": "Nissan",
  "skyline-gtr-rb26dett": "Nissan",
  "gtr-r35-vr38dett": "Nissan",
  "bmw-e46-m3-s54": "BMW",
  "240sx-ka24de": "Nissan",
  "tsx-k24a2": "Honda",
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

  it("has no two presets sharing an identical config (bore, stroke, rod, CR, redline)", () => {
    const configKeys = ENGINE_PRESETS.map((preset) =>
      [
        preset.config.boreMm,
        preset.config.strokeMm,
        preset.config.rodLengthMm,
        preset.config.compressionRatio,
        preset.config.redlineRpm,
      ].join("|"),
    );
    const duplicates = configKeys.filter(
      (key, index) => configKeys.indexOf(key) !== index,
    );
    expect(duplicates).toEqual([]);
  });

  it("has a non-empty brand for every preset", () => {
    for (const preset of ENGINE_PRESETS) {
      expect(typeof preset.brand).toBe("string");
      expect(preset.brand.length).toBeGreaterThan(0);
    }
  });

  it("has an advertised-brand fixture for every preset", () => {
    for (const preset of ENGINE_PRESETS) {
      expect(ADVERTISED_BRAND[preset.id]).toBeDefined();
    }
  });

  it.each(ENGINE_PRESETS)(
    "$name ($engineCode) brand matches the advertised manufacturer",
    (preset) => {
      const advertised = ADVERTISED_BRAND[preset.id];
      expect(advertised).toBeDefined();
      expect(preset.brand).toBe(advertised);
    },
  );

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

  it("has an advertised-redline fixture for every preset", () => {
    for (const preset of ENGINE_PRESETS) {
      expect(ADVERTISED_REDLINE_RPM[preset.id]).toBeDefined();
    }
  });

  it.each(ENGINE_PRESETS)(
    "$name ($engineCode) redline matches the advertised factory figure",
    (preset) => {
      const advertised = ADVERTISED_REDLINE_RPM[preset.id];
      expect(advertised).toBeDefined();
      expect(preset.config.redlineRpm).toBe(advertised);
    },
  );
});
