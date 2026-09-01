/**
 * Verifies how a configuration is named under the mechanism. Pure data
 * matching, so it needs no WebGL.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../engine/constants";
import { ENGINE_PRESETS } from "../engine/presets";
import { DEFAULT_ROTARY_CONFIG } from "../engine/rotaryConstants";
import { calculateRotaryEngineDisplacementCc } from "../engine/rotaryCalculations";
import {
  CUSTOM_ENGINE_LABEL,
  DEFAULT_ENGINE_LABEL,
  describeConfig,
  describeRotaryConfig,
} from "./mechanismLabels";

describe("describeConfig", () => {
  it("names every preset by its own name", () => {
    for (const preset of ENGINE_PRESETS) {
      expect(describeConfig(preset.config)).toBe(preset.name);
    }
  });

  it("names a copied preset configuration, not just the same object", () => {
    const preset = ENGINE_PRESETS[0];
    expect(describeConfig({ ...preset.config })).toBe(preset.name);
  });

  it("falls back to a custom label once any dimension is edited", () => {
    const preset = ENGINE_PRESETS[0];

    for (const field of [
      "boreMm",
      "strokeMm",
      "rodLengthMm",
      "compressionRatio",
      "redlineRpm",
    ] as const) {
      const edited = { ...preset.config, [field]: preset.config[field] + 1 };
      expect(describeConfig(edited)).toBe(CUSTOM_ENGINE_LABEL);
    }
  });

  it("names the untouched default configuration as the default engine", () => {
    expect(describeConfig({ ...DEFAULT_CONFIG })).toBe(DEFAULT_ENGINE_LABEL);
  });

  it("describes an edited default configuration as custom", () => {
    expect(
      describeConfig({ ...DEFAULT_CONFIG, boreMm: DEFAULT_CONFIG.boreMm + 1 }),
    ).toBe(CUSTOM_ENGINE_LABEL);
  });

  it("describes an unrelated configuration as custom", () => {
    expect(
      describeConfig({
        boreMm: 61,
        strokeMm: 57,
        rodLengthMm: 99,
        compressionRatio: 12.25,
        redlineRpm: 12_000,
      }),
    ).toBe(CUSTOM_ENGINE_LABEL);
  });
});

describe("describeRotaryConfig", () => {
  it("names the canonical 13B geometry the way Mazda badged it", () => {
    // 654.7 cc per chamber, two chambers: 1,309 against a published 1,308,
    // the difference being rounding in the quoted dimensions.
    expect(describeRotaryConfig(DEFAULT_ROTARY_CONFIG, 2)).toBe(
      "Two-rotor rotary (1,309 cc)",
    );
  });

  it("spells out every supported rotor count", () => {
    expect(describeRotaryConfig(DEFAULT_ROTARY_CONFIG, 1)).toMatch(
      /^Single-rotor rotary/,
    );
    expect(describeRotaryConfig(DEFAULT_ROTARY_CONFIG, 2)).toMatch(
      /^Two-rotor rotary/,
    );
    expect(describeRotaryConfig(DEFAULT_ROTARY_CONFIG, 3)).toMatch(
      /^Three-rotor rotary/,
    );
  });

  it("quotes the engine layer's displacement, not one of its own", () => {
    for (const rotorCount of [1, 2, 3] as const) {
      const expected = Math.round(
        calculateRotaryEngineDisplacementCc(DEFAULT_ROTARY_CONFIG, rotorCount),
      ).toLocaleString("en-US");
      expect(describeRotaryConfig(DEFAULT_ROTARY_CONFIG, rotorCount)).toContain(
        `(${expected} cc)`,
      );
    }
  });

  it("renames itself when the geometry changes, since a rotary has no preset identity", () => {
    // Unlike `describeConfig`, which falls back to "Custom engine": a rotary's
    // label is derived from its dimensions rather than matched against a
    // roster, so editing R changes the name rather than blanking it.
    const bigger = { ...DEFAULT_ROTARY_CONFIG, generatingRadiusMm: 120 };
    expect(describeRotaryConfig(bigger, 2)).not.toBe(
      describeRotaryConfig(DEFAULT_ROTARY_CONFIG, 2),
    );
    expect(describeRotaryConfig(bigger, 2)).toMatch(/^Two-rotor rotary \(1,/);
  });
});
