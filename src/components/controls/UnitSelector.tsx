import { useId } from "react";
import { useEngineStore } from "../../state/engineStore";
import type { DisplayUnit } from "../../engine/types";
import styles from "./UnitSelector.module.css";

const UNIT_OPTIONS: { value: DisplayUnit; label: string }[] = [
  { value: "mm", label: "Millimeters" },
  { value: "in", label: "Inches" },
];

/**
 * Display-unit toggle (mm/in) and the "show labels", "four-stroke cycle", and
 * "stand flat engines upright" preferences (TECHNICAL_DESIGN.md §7.2, §16,
 * §24a). Switching units only changes how dimensions are presented elsewhere
 * in the interface — it never alters the millimeter values stored in `config`.
 *
 * "Four-stroke cycle" gates both halves of `src/engine/cycle.ts`'s pedagogical
 * overlay: `StrokeBadge` (rendered inside `AnimationControls` beside the
 * crank-angle readout, naming cylinder 1's stroke) and the scene's per-cylinder
 * firing tint (§24a), which colors every cylinder's combustion chamber red
 * while it fires and blue while it exhausts. One preference for one idea —
 * hence the label naming both, since the tint is the more visible of the two.
 *
 * "Stand flat engines upright" turns a flat/boxer layout a further 90° in the
 * full-engine view (§24a), so its pistons move vertically like every other
 * engine's while the opposed pair stays opposed. It concerns flat layouts
 * only — V and inline engines ignore it — which is why the label says so.
 *
 * Both of those are off by default, and all three checkboxes here are
 * session-local: unlike `displayUnit`, none of them is carried by a share
 * link.
 */
export function UnitSelector() {
  const displayUnit = useEngineStore((state) => state.preferences.displayUnit);
  const setDisplayUnit = useEngineStore((state) => state.setDisplayUnit);
  const showLabels = useEngineStore((state) => state.preferences.showLabels);
  const setShowLabels = useEngineStore((state) => state.setShowLabels);
  const showCycle = useEngineStore((state) => state.preferences.showCycle);
  const setShowCycle = useEngineStore((state) => state.setShowCycle);
  const uprightFlatEngines = useEngineStore(
    (state) => state.preferences.uprightFlatEngines,
  );
  const setUprightFlatEngines = useEngineStore(
    (state) => state.setUprightFlatEngines,
  );

  const groupNameId = useId();
  const showLabelsId = useId();
  const showCycleId = useId();
  const uprightFlatId = useId();

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
        Four-stroke cycle (badge and firing tint)
      </label>

      <label className={styles.checkboxRow} htmlFor={uprightFlatId}>
        <input
          id={uprightFlatId}
          className={styles.checkbox}
          type="checkbox"
          checked={uprightFlatEngines}
          onChange={(event) => setUprightFlatEngines(event.target.checked)}
        />
        Stand flat engines upright
      </label>
    </div>
  );
}
