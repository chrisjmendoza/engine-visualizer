/**
 * Verifies how a configuration is named under the mechanism. Pure data
 * matching, so it needs no WebGL.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../engine/constants";
import { ENGINE_PRESETS } from "../engine/presets";
import {
  CUSTOM_ENGINE_LABEL,
  DEFAULT_ENGINE_LABEL,
  describeConfig,
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
