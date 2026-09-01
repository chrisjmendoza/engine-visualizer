import type { CrankMechanismConfig } from "../../engine/types";
import type { EngineFamily } from "../../engine/shareLink";
import type { RotaryConfig, RotaryRotorCount } from "../../engine/rotaryTypes";

/**
 * Which engine a config-driven control operates on. `"primary"` is engine A
 * (`store.config`); `"comparison"` is engine B (`store.comparisonConfig`),
 * shown alongside engine A when comparison mode is on. The scene renders
 * engine A on the left and engine B on the right at shared scale.
 */
export type ConfigSlot = "primary" | "comparison";

/**
 * Resolves which `CrankMechanismConfig` a slot should read.
 *
 * Falls back to `config` if `comparisonConfig` is `null`, so a
 * `slot="comparison"` component never crashes if it's ever mounted before
 * comparison mode is enabled. In normal use this fallback is never visible:
 * `enableComparison()` seeds `comparisonConfig` synchronously (as a copy of
 * `config` by default), and callers only mount comparison-slot controls
 * while comparison mode is on.
 */
export function resolveSlotConfig(
  slot: ConfigSlot,
  config: CrankMechanismConfig,
  comparisonConfig: CrankMechanismConfig | null,
): CrankMechanismConfig {
  return slot === "comparison" ? (comparisonConfig ?? config) : config;
}

/**
 * Resolves which `EngineFamily` a slot currently shows (§27). Unlike
 * `comparisonConfig`, `comparisonEngineFamily` is never `null` — a slot
 * always has a family, on or off comparison — so this never needs a
 * fallback the way `resolveSlotConfig` does.
 */
export function resolveSlotFamily(
  slot: ConfigSlot,
  engineFamily: EngineFamily,
  comparisonEngineFamily: EngineFamily,
): EngineFamily {
  return slot === "comparison" ? comparisonEngineFamily : engineFamily;
}

/** Resolves which `RotaryConfig` a slot should read — the rotary `resolveSlotConfig`. */
export function resolveSlotRotaryConfig(
  slot: ConfigSlot,
  rotaryConfig: RotaryConfig,
  comparisonRotaryConfig: RotaryConfig,
): RotaryConfig {
  return slot === "comparison" ? comparisonRotaryConfig : rotaryConfig;
}

/** Resolves which rotor count a slot should read — the rotary architecture, alongside `resolveSlotRotaryConfig`. */
export function resolveSlotRotorCount(
  slot: ConfigSlot,
  rotaryRotorCount: RotaryRotorCount,
  comparisonRotaryRotorCount: RotaryRotorCount,
): RotaryRotorCount {
  return slot === "comparison" ? comparisonRotaryRotorCount : rotaryRotorCount;
}
