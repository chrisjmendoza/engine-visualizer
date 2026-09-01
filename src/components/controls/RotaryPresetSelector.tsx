import { useId, useState } from "react";
import { useEngineStore } from "../../state/engineStore";
import { ROTARY_ENGINE_PRESETS } from "../../engine/rotaryPresets";
import type { RotaryEnginePreset } from "../../engine/rotaryPresets";
import type { RotaryConfig } from "../../engine/rotaryTypes";
import {
  resolveSlotRotaryConfig,
  resolveSlotRotorCount,
} from "../shared/configSlot";
import type { ConfigSlot } from "../shared/configSlot";
import styles from "./RotaryPresetSelector.module.css";

function configsMatch(a: RotaryConfig, b: RotaryConfig): boolean {
  return (
    a.generatingRadiusMm === b.generatingRadiusMm &&
    a.eccentricityMm === b.eccentricityMm &&
    a.rotorWidthMm === b.rotorWidthMm
  );
}

interface BrandGroup {
  brand: string;
  presets: RotaryEnginePreset[];
}

/** Groups presets by brand, brands sorted alphabetically — the rotary `groupByBrand`. */
function groupByBrand(presets: readonly RotaryEnginePreset[]): BrandGroup[] {
  const byBrand = new Map<string, RotaryEnginePreset[]>();
  for (const preset of presets) {
    const group = byBrand.get(preset.brand);
    if (group) {
      group.push(preset);
    } else {
      byBrand.set(preset.brand, [preset]);
    }
  }
  return Array.from(byBrand.entries())
    .map(([brand, brandPresets]) => ({ brand, presets: brandPresets }))
    .sort((a, b) => a.brand.localeCompare(b.brand));
}

export interface RotaryPresetSelectorProps {
  /**
   * Which engine a click applies the preset to: `"primary"` (engine A,
   * `store.rotaryConfig`/`store.rotaryRotorCount`) or `"comparison"` (engine
   * B). Defaults to `"primary"`.
   */
  slot?: ConfigSlot;
}

/**
 * One-click loaders for the rotary preset roster (TECHNICAL_DESIGN.md §27) —
 * 13B-REW, 13B-MSP Renesis, 12A, 20B-REW — grouped by manufacturer exactly
 * like `PresetSelector`, whose two-level brand/car layout this mirrors
 * verbatim (only the matched fields and the committed store fields differ).
 * Selecting a preset replaces both the slot's `rotaryConfig` AND its
 * `rotaryRotorCount` — the rotary's architecture, the way picking a piston
 * preset also sets `layoutId` — and never touches RPM or playback.
 *
 * A preset reads as selected only when the slot's geometry (generating
 * radius, eccentricity, rotor width — deliberately not compression ratio or
 * redline, mirroring `PresetSelector`'s bore/stroke/rod-only match) exactly
 * equals that preset's, AND the slot's rotor count matches that preset's own
 * — three of this roster's four presets share identical chamber geometry, so
 * the rotor count is what actually tells a 13B-REW/13B-MSP-Renesis pairing
 * apart from a 20B-REW at the same numbers.
 */
export function RotaryPresetSelector({
  slot = "primary",
}: RotaryPresetSelectorProps) {
  const rotaryConfig = useEngineStore((state) => state.rotaryConfig);
  const comparisonRotaryConfig = useEngineStore(
    (state) => state.comparisonRotaryConfig,
  );
  const slotConfig = resolveSlotRotaryConfig(
    slot,
    rotaryConfig,
    comparisonRotaryConfig,
  );
  const rotaryRotorCount = useEngineStore((state) => state.rotaryRotorCount);
  const comparisonRotaryRotorCount = useEngineStore(
    (state) => state.comparisonRotaryRotorCount,
  );
  const slotRotorCount = resolveSlotRotorCount(
    slot,
    rotaryRotorCount,
    comparisonRotaryRotorCount,
  );

  const setRotaryConfig = useEngineStore((state) => state.setRotaryConfig);
  const setComparisonRotaryConfig = useEngineStore(
    (state) => state.setComparisonRotaryConfig,
  );
  const commitSlot =
    slot === "comparison" ? setComparisonRotaryConfig : setRotaryConfig;
  const setRotaryRotorCount = useEngineStore(
    (state) => state.setRotaryRotorCount,
  );
  const setComparisonRotaryRotorCount = useEngineStore(
    (state) => state.setComparisonRotaryRotorCount,
  );
  const commitRotorCount =
    slot === "comparison" ? setComparisonRotaryRotorCount : setRotaryRotorCount;

  const groups = groupByBrand(ROTARY_ENGINE_PRESETS);
  const matchingPreset = ROTARY_ENGINE_PRESETS.find((preset) =>
    configsMatch(slotConfig, preset.config),
  );
  const matchingBrand = matchingPreset?.brand ?? null;

  const [state, setState] = useState<{
    trackedMatch: string | null;
    expandedBrand: string | null;
  }>(() => ({ trackedMatch: matchingBrand, expandedBrand: matchingBrand }));

  if (matchingBrand !== state.trackedMatch) {
    setState({
      trackedMatch: matchingBrand,
      expandedBrand: matchingBrand ?? state.expandedBrand,
    });
  }

  function toggleBrand(brand: string) {
    setState((prev) => ({
      ...prev,
      expandedBrand: prev.expandedBrand === brand ? null : brand,
    }));
  }

  const baseId = useId();
  const expandedIndex = groups.findIndex(
    (group) => group.brand === state.expandedBrand,
  );
  const expandedGroup = expandedIndex === -1 ? null : groups[expandedIndex];
  const expandedPanelId = `${baseId}-${expandedIndex}`;

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Rotary presets</legend>
      <div className={styles.brandRow}>
        {groups.map(({ brand, presets }, index) => {
          const isExpanded = index === expandedIndex;
          return (
            <button
              key={brand}
              type="button"
              className={styles.brandButton}
              aria-expanded={isExpanded}
              aria-controls={`${baseId}-${index}`}
              onClick={() => toggleBrand(brand)}
            >
              <span className={styles.chevron} aria-hidden="true">
                {isExpanded ? "▾" : "▸"}
              </span>
              <span className={styles.brandName}>{brand}</span>
              <span className={styles.brandCount}>{presets.length}</span>
            </button>
          );
        })}
      </div>
      {expandedGroup ? (
        <div
          className={styles.grid}
          id={expandedPanelId}
          role="region"
          aria-label={`${expandedGroup.brand} rotary presets`}
        >
          {expandedGroup.presets.map((preset) => {
            const isActive =
              configsMatch(slotConfig, preset.config) &&
              slotRotorCount === preset.rotorCount;
            return (
              <button
                key={preset.id}
                type="button"
                className={styles.presetButton}
                aria-pressed={isActive}
                data-active={isActive ? "true" : undefined}
                onClick={() => {
                  commitSlot(preset.config);
                  commitRotorCount(preset.rotorCount);
                }}
              >
                <span className={styles.name}>{preset.name}</span>
                <span className={styles.meta}>
                  {preset.engineCode} &middot; {preset.layoutLabel}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </fieldset>
  );
}
