import { useId } from "react";
import { useEngineStore } from "../../state/engineStore";
import type { DisplayUnit } from "../../engine/types";
import styles from "./UnitSelector.module.css";

const UNIT_OPTIONS: { value: DisplayUnit; label: string }[] = [
  { value: "mm", label: "Millimeters" },
  { value: "in", label: "Inches" },
];

/**
 * Display-unit toggle (mm/in) and the "show labels" and "four-stroke cycle"
 * preferences (TECHNICAL_DESIGN.md §7.2, §16). Switching units only changes
 * how dimensions are presented elsewhere in the interface — it never alters
 * the millimeter values stored in `config`.
 *
 * "Four-stroke cycle" gates `StrokeBadge` (`src/engine/cycle.ts`'s
 * pedagogical overlay, rendered inside `AnimationControls` beside the
 * crank-angle readout) — off by default, like the other preferences here,
 * and session-local: it is not carried by share links tonight.
 */
export function UnitSelector() {
  const displayUnit = useEngineStore((state) => state.preferences.displayUnit);
  const setDisplayUnit = useEngineStore((state) => state.setDisplayUnit);
  const showLabels = useEngineStore((state) => state.preferences.showLabels);
  const setShowLabels = useEngineStore((state) => state.setShowLabels);
  const showCycle = useEngineStore((state) => state.preferences.showCycle);
  const setShowCycle = useEngineStore((state) => state.setShowCycle);

  const groupNameId = useId();
  const showLabelsId = useId();
  const showCycleId = useId();

  return (
    <div className={styles.container}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Display units</legend>
        <div className={styles.options}>
          {UNIT_OPTIONS.map((option) => {
            const inputId = `${groupNameId}-${option.value}`;
            return (
              <label
                key={option.value}
                className={styles.option}
                htmlFor={inputId}
              >
                <input
                  id={inputId}
                  className={styles.radio}
                  type="radio"
                  name={groupNameId}
                  value={option.value}
                  checked={displayUnit === option.value}
                  onChange={() => setDisplayUnit(option.value)}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className={styles.checkboxRow} htmlFor={showLabelsId}>
        <input
          id={showLabelsId}
          className={styles.checkbox}
          type="checkbox"
          checked={showLabels}
          onChange={(event) => setShowLabels(event.target.checked)}
        />
        Show component labels
      </label>

      <label className={styles.checkboxRow} htmlFor={showCycleId}>
        <input
          id={showCycleId}
          className={styles.checkbox}
          type="checkbox"
          checked={showCycle}
          onChange={(event) => setShowCycle(event.target.checked)}
        />
        Four-stroke cycle
      </label>
    </div>
  );
}
