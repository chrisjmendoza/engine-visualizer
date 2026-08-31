import { useId, useState } from "react";
import { useEngineStore } from "../../state/engineStore";
import { DEFAULT_LAYOUT_ID } from "../../engine/engineLayout";
import { ENGINE_PRESETS } from "../../engine/presets";
import type { EnginePreset } from "../../engine/presets";
import type { CrankMechanismConfig } from "../../engine/types";
import { resolveSlotConfig } from "../shared/configSlot";
import type { ConfigSlot } from "../shared/configSlot";
import styles from "./PresetSelector.module.css";

function configsMatch(
  a: CrankMechanismConfig,
  b: CrankMechanismConfig,
): boolean {
  return (
    a.boreMm === b.boreMm &&
    a.strokeMm === b.strokeMm &&
    a.rodLengthMm === b.rodLengthMm
  );
}

interface BrandGroup {
  brand: string;
  presets: EnginePreset[];
}

/**
 * Groups presets by their `brand` field, brands sorted alphabetically.
 * Built generically from whatever brands are present in `ENGINE_PRESETS` —
 * never a hardcoded brand list — so the roster can grow without touching
 * this component.
 */
function groupByBrand(presets: readonly EnginePreset[]): BrandGroup[] {
  const byBrand = new Map<string, EnginePreset[]>();
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

export interface PresetSelectorProps {
  /**
   * Which engine a click applies the preset to: `"primary"` (engine A,
   * `store.config`) or `"comparison"` (engine B, `store.comparisonConfig`).
   * Defaults to `"primary"`.
   */
  slot?: ConfigSlot;
}

/**
 * One-click loaders for famous sports-car engines' per-cylinder geometry
 * (bore, stroke, connecting-rod length), grouped by manufacturer so the
 * panel stays manageable as the roster grows. Two levels: a row of brand
 * buttons (alphabetical), and — for at most one brand at a time — a grid of
 * that brand's cars below it. Selecting a preset fully replaces the target
 * slot's config; it never touches RPM or playback state.
 *
 * A preset is shown pressed only when the slot's current config exactly
 * equals that preset's values AND the slot's current layout matches that
 * preset's real one (§24a, `layoutId ?? DEFAULT_LAYOUT_ID`) — hand-edited
 * geometry that happens to drift away from every preset shows no selection at
 * all, and so does switching the architecture away after picking a preset (the
 * geometry still matches, but the app is no longer showing that engine's real
 * layout). The cylinder-view switch is not part of that test: one cylinder of
 * an LS7 is still an LS7. Whenever the slot's
 * config newly matches a preset (picking one, or a slot being seeded by
 * `enableComparison`), that preset's brand auto-expands; losing a match
 * (e.g. hand-editing away from it) leaves whatever the user currently has
 * expanded alone, so browsing isn't interrupted.
 */
export function PresetSelector({ slot = "primary" }: PresetSelectorProps) {
  const config = useEngineStore((state) => state.config);
  const comparisonConfig = useEngineStore((state) => state.comparisonConfig);
  const slotConfig = resolveSlotConfig(slot, config, comparisonConfig);
  const layoutId = useEngineStore((state) => state.layoutId);
  const comparisonLayoutId = useEngineStore(
    (state) => state.comparisonLayoutId,
  );
  const slotLayoutId = slot === "comparison" ? comparisonLayoutId : layoutId;
  const setConfig = useEngineStore((state) => state.setConfig);
  const setComparisonConfig = useEngineStore(
    (state) => state.setComparisonConfig,
  );
  const commitSlot = slot === "comparison" ? setComparisonConfig : setConfig;
  const setLayoutId = useEngineStore((state) => state.setLayoutId);
  const setComparisonLayoutId = useEngineStore(
    (state) => state.setComparisonLayoutId,
  );
  const commitLayoutId =
    slot === "comparison" ? setComparisonLayoutId : setLayoutId;

  const groups = groupByBrand(ENGINE_PRESETS);
  const matchingPreset = ENGINE_PRESETS.find((preset) =>
    configsMatch(slotConfig, preset.config),
  );
  const matchingBrand = matchingPreset?.brand ?? null;

  // Derived-during-render (see EngineGeometryControls.tsx for the same
  // pattern): only reacts when `matchingBrand` actually changes, so a
  // manual expand/collapse click in between two renders is never clobbered.
  const [state, setState] = useState<{
    trackedMatch: string | null;
    expandedBrand: string | null;
  }>(() => ({ trackedMatch: matchingBrand, expandedBrand: matchingBrand }));

  if (matchingBrand !== state.trackedMatch) {
    setState({
      trackedMatch: matchingBrand,
      // A newly-matching preset auto-expands its brand; losing a match
      // (matchingBrand null) leaves whatever is currently expanded alone
      // rather than force-collapsing mid-browse.
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
      <legend className={styles.legend}>Presets</legend>
      {/* Brand buttons stay compact and wrap in their own row; only the
          expanded brand's car grid (rendered once, below) spans the full
          width, rather than nesting a full-width grid under each button
          and forcing every button onto its own line. */}
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
          aria-label={`${expandedGroup.brand} presets`}
        >
          {expandedGroup.presets.map((preset) => {
            // Geometry alone isn't enough: a preset whose geometry matches
            // but whose real layout (§24a) no longer matches the slot's
            // current one (e.g. switched from a V8 to an inline-6 after
            // picking a V8 preset) is no longer actually selected — showing
            // it pressed would claim a real engine's architecture the app
            // isn't currently configured for. The cylinder *view*
            // deliberately plays no part: one cylinder of an LS7 is still an
            // LS7, and the preset stays pressed while you study it.
            const isActive =
              configsMatch(slotConfig, preset.config) &&
              slotLayoutId === (preset.layoutId ?? DEFAULT_LAYOUT_ID);
            return (
              <button
                key={preset.id}
                type="button"
                className={styles.presetButton}
                aria-pressed={isActive}
                data-active={isActive ? "true" : undefined}
                onClick={() => {
                  commitSlot(preset.config);
                  // §24a: selecting a real engine always shows that
                  // engine's own architecture, never a leftover from a
                  // different one. Every preset declares a layout now; the
                  // fallback covers a future preset whose layout the roster
                  // cannot yet express.
                  //
                  // It deliberately does NOT touch the cylinder view:
                  // picking an LS7 while studying one cylinder keeps you on
                  // one cylinder, now labelled as a V8's.
                  commitLayoutId(preset.layoutId ?? DEFAULT_LAYOUT_ID);
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
