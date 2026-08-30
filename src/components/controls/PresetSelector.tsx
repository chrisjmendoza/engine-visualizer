import { useEngineStore } from "../../state/engineStore";
import { ENGINE_PRESETS } from "../../engine/presets";
import type { CrankMechanismConfig } from "../../engine/types";
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

/**
 * One-click loaders for famous sports-car engines' per-cylinder geometry
 * (bore, stroke, connecting-rod length). Selecting a preset fully replaces
 * `config`; it never touches RPM or playback state.
 *
 * A preset is shown pressed only when the store's current `config` exactly
 * equals that preset's values — hand-edited geometry that happens to drift
 * away from every preset shows no selection at all.
 */
export function PresetSelector() {
  const config = useEngineStore((state) => state.config);
  const setConfig = useEngineStore((state) => state.setConfig);

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Presets</legend>
      <div className={styles.grid}>
        {ENGINE_PRESETS.map((preset) => {
          const isActive = configsMatch(config, preset.config);
          return (
            <button
              key={preset.id}
              type="button"
              className={styles.presetButton}
              aria-pressed={isActive}
              data-active={isActive ? "true" : undefined}
              onClick={() => setConfig(preset.config)}
            >
              <span className={styles.name}>{preset.name}</span>
              <span className={styles.meta}>
                {preset.engineCode} &middot; {preset.layoutLabel}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
