import { describe, expect, it } from "vitest";
import { ROTARY_ENGINE_PRESETS } from "../engine/rotaryPresets";
import type { RotaryEnginePreset } from "../engine/rotaryPresets";
import {
  calculateChamberDisplacementCc,
  calculateKFactor,
  calculateRotaryEngineDisplacementCc,
} from "../engine/rotaryCalculations";
import { validateRotaryConfig } from "../engine/rotaryValidation";
import { ROTARY_ROTOR_PHASES } from "../engine/rotaryCycle";

/**
 * Advertised total engine displacement (cc), taken independently from each
 * preset's own published figures rather than derived from the preset's own
 * config — mirrors `presets.test.ts`'s `ADVERTISED` fixture, but checked
 * against `3√3·e·R·b × rotorCount` (the rotary displacement formula) rather
 * than bore²·stroke.
 */
const ADVERTISED_TOTAL_CC: Record<string, number> = {
  "13b-rew": 1308, // Mazda's published two-rotor 13B rating.
  "13b-msp-renesis": 1308, // Same chamber geometry as the 13B-REW.
  "12a": 1146, // 573 cc/chamber × 2, Mazda's published 12A rating.
  "20b-rew": 1962, // Mazda's published three-rotor 20B rating.
};

/** Per-chamber displacement (cc) each engine's geometry is meant to match. */
const ADVERTISED_CHAMBER_CC: Record<string, number> = {
  "13b-rew": 654,
  "13b-msp-renesis": 654,
  "12a": 573,
  "20b-rew": 654,
};

const ADVERTISED_BRAND: Record<string, string> = {
  "13b-rew": "Mazda",
  "13b-msp-renesis": "Mazda",
  "12a": "Mazda",
  "20b-rew": "Mazda",
};

const ADVERTISED_COMPRESSION_RATIO: Record<string, number> = {
  "13b-rew": 9.0,
  "13b-msp-renesis": 10.0,
  "12a": 9.4,
  "20b-rew": 9.0,
};

const ADVERTISED_REDLINE_RPM: Record<string, number> = {
  "13b-rew": 8000,
  "13b-msp-renesis": 9000,
  "12a": 7000,
  "20b-rew": 7000,
};

const ADVERTISED_ROTOR_COUNT: Record<string, number> = {
  "13b-rew": 2,
  "13b-msp-renesis": 2,
  "12a": 2,
  "20b-rew": 3,
};

const ADVERTISED_OUTPUT: Record<
  string,
  { powerHp: number; powerRpm: number; torqueLbFt: number; torqueRpm: number }
> = {
  "13b-rew": {
    powerHp: 255,
    powerRpm: 6500,
    torqueLbFt: 217,
    torqueRpm: 5000,
  },
  "13b-msp-renesis": {
    powerHp: 238,
    powerRpm: 8500,
    torqueLbFt: 159,
    torqueRpm: 5500,
  },
  "12a": {
    powerHp: 100,
    powerRpm: 6000,
    torqueLbFt: 105,
    torqueRpm: 4000,
  },
  "20b-rew": {
    powerHp: 276,
    powerRpm: 6500,
    torqueLbFt: 296,
    torqueRpm: 3000,
  },
};

describe("ROTARY_ENGINE_PRESETS", () => {
  it("has a unique id for every preset", () => {
    const ids = ROTARY_ENGINE_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a non-empty brand for every preset", () => {
    for (const preset of ROTARY_ENGINE_PRESETS) {
      expect(typeof preset.brand).toBe("string");
      expect(preset.brand.length).toBeGreaterThan(0);
    }
  });

  it("has an advertised-brand fixture for every preset", () => {
    for (const preset of ROTARY_ENGINE_PRESETS) {
      expect(ADVERTISED_BRAND[preset.id]).toBeDefined();
    }
  });

  it.each(ROTARY_ENGINE_PRESETS)(
    "$name ($engineCode) brand matches the advertised manufacturer",
    (preset) => {
      expect(preset.brand).toBe(ADVERTISED_BRAND[preset.id]);
    },
  );

  it.each(ROTARY_ENGINE_PRESETS)(
    "$name ($engineCode) passes validateRotaryConfig",
    (preset) => {
      const result = validateRotaryConfig(preset.config);
      expect(result.ok).toBe(true);
    },
  );

  it("has an advertised-chamber-displacement fixture for every preset", () => {
    for (const preset of ROTARY_ENGINE_PRESETS) {
      expect(ADVERTISED_CHAMBER_CC[preset.id]).toBeDefined();
    }
  });

  it.each(ROTARY_ENGINE_PRESETS)(
    "$name ($engineCode) chamber displacement (3√3·e·R·b) matches the advertised per-chamber figure within 1%",
    (preset) => {
      const advertised = ADVERTISED_CHAMBER_CC[preset.id];
      expect(advertised).toBeDefined();
      const computed = calculateChamberDisplacementCc(preset.config);
      const relativeError = Math.abs(computed - advertised) / advertised;
      expect(relativeError).toBeLessThanOrEqual(0.01);
    },
  );

  it("has an advertised-total-displacement fixture for every preset", () => {
    for (const preset of ROTARY_ENGINE_PRESETS) {
      expect(ADVERTISED_TOTAL_CC[preset.id]).toBeDefined();
    }
  });

  it.each(ROTARY_ENGINE_PRESETS)(
    "$name ($engineCode) engine displacement (3√3·e·R·b × rotors) matches the advertised total within 1%",
    (preset) => {
      const advertised = ADVERTISED_TOTAL_CC[preset.id];
      expect(advertised).toBeDefined();
      const computed = calculateRotaryEngineDisplacementCc(
        preset.config,
        preset.rotorCount,
      );
      const relativeError = Math.abs(computed - advertised) / advertised;
      expect(relativeError).toBeLessThanOrEqual(0.01);
    },
  );

  it("has an advertised-rotor-count fixture for every preset", () => {
    for (const preset of ROTARY_ENGINE_PRESETS) {
      expect(ADVERTISED_ROTOR_COUNT[preset.id]).toBeDefined();
    }
  });

  it.each(ROTARY_ENGINE_PRESETS)(
    "$name ($engineCode) rotor count matches the advertised architecture, with defined phasing",
    (preset) => {
      expect(preset.rotorCount).toBe(ADVERTISED_ROTOR_COUNT[preset.id]);
      expect(ROTARY_ROTOR_PHASES[preset.rotorCount]).toBeDefined();
      expect(ROTARY_ROTOR_PHASES[preset.rotorCount]).toHaveLength(
        preset.rotorCount,
      );
    },
  );

  it("has an advertised-compression-ratio fixture for every preset", () => {
    for (const preset of ROTARY_ENGINE_PRESETS) {
      expect(ADVERTISED_COMPRESSION_RATIO[preset.id]).toBeDefined();
    }
  });

  it.each(ROTARY_ENGINE_PRESETS)(
    "$name ($engineCode) compression ratio matches the advertised factory figure",
    (preset) => {
      expect(preset.config.compressionRatio).toBe(
        ADVERTISED_COMPRESSION_RATIO[preset.id],
      );
    },
  );

  it("has an advertised-redline fixture for every preset", () => {
    for (const preset of ROTARY_ENGINE_PRESETS) {
      expect(ADVERTISED_REDLINE_RPM[preset.id]).toBeDefined();
    }
  });

  it.each(ROTARY_ENGINE_PRESETS)(
    "$name ($engineCode) redline matches the advertised factory figure",
    (preset) => {
      expect(preset.config.redlineRpm).toBe(ADVERTISED_REDLINE_RPM[preset.id]);
    },
  );

  it.each(ROTARY_ENGINE_PRESETS)(
    "$name ($engineCode) K-factor (R/e) is a plausible production value",
    (preset) => {
      // Every preset here shares the 13B's R=105/e=15 chamber geometry
      // (only rotor width and rotor count vary), so every K-factor is
      // exactly 7.0 — the textbook figure `rotaryCalculations.ts` documents.
      const k = calculateKFactor(preset.config);
      expect(k).toBeCloseTo(7.0, 5);
    },
  );

  it("has at least one preset with output", () => {
    const withOutput = ROTARY_ENGINE_PRESETS.filter((preset) => preset.output);
    expect(withOutput.length).toBeGreaterThan(0);
  });

  it("has an advertised-output fixture for every preset that declares output", () => {
    for (const preset of ROTARY_ENGINE_PRESETS) {
      if (preset.output) {
        expect(ADVERTISED_OUTPUT[preset.id]).toBeDefined();
      }
    }
  });

  it.each(ROTARY_ENGINE_PRESETS.filter((preset) => preset.output))(
    "$name ($engineCode) output matches the advertised factory figures",
    (preset) => {
      expect(preset.output).toEqual(ADVERTISED_OUTPUT[preset.id]);
    },
  );

  it.each(ROTARY_ENGINE_PRESETS.filter((preset) => preset.output))(
    "$name ($engineCode) power-peak rpm is at or below redline",
    (preset) => {
      expect(preset.output).toBeDefined();
      if (!preset.output) return;
      expect(preset.output.powerRpm).toBeLessThanOrEqual(
        preset.config.redlineRpm,
      );
    },
  );

  it.each(ROTARY_ENGINE_PRESETS.filter((preset) => preset.output))(
    "$name ($engineCode) torque-peak rpm is at or below power-peak rpm",
    (preset) => {
      expect(preset.output).toBeDefined();
      if (!preset.output) return;
      expect(preset.output.torqueRpm).toBeLessThanOrEqual(
        preset.output.powerRpm,
      );
    },
  );

  it("allows a preset to omit output entirely without crashing (optional field)", () => {
    const withoutOutput: RotaryEnginePreset = {
      ...ROTARY_ENGINE_PRESETS[0]!,
      output: undefined,
    };
    expect(withoutOutput.output).toBeUndefined();
    expect(() => withoutOutput.output?.powerHp).not.toThrow();
  });

  it("has no two presets sharing an identical config and rotor count", () => {
    const keys = ROTARY_ENGINE_PRESETS.map((preset) =>
      [
        preset.config.generatingRadiusMm,
        preset.config.eccentricityMm,
        preset.config.rotorWidthMm,
        preset.config.compressionRatio,
        preset.config.redlineRpm,
        preset.rotorCount,
      ].join("|"),
    );
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
    expect(duplicates).toEqual([]);
  });
});
