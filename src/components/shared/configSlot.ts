import type { CrankMechanismConfig } from "../../engine/types";

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
