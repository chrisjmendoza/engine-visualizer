import { useId } from "react";
import { useEngineStore } from "../../state/engineStore";
import type { ConfigSlot } from "../shared/configSlot";
import styles from "./EngineFamilySelector.module.css";

export interface EngineFamilySelectorProps {
  /**
   * Which engine this instance edits: `"primary"` (engine A,
   * `store.engineFamily`) or `"comparison"` (engine B,
   * `store.comparisonEngineFamily`). Defaults to `"primary"`.
   */
  slot?: ConfigSlot;
}

const PISTON_LABEL = "Piston";
const ROTARY_LABEL = "Rotary";

/**
 * The switch's one, unchanging accessible name — same reasoning as
 * `CylinderViewToggle`'s: `aria-checked` carries which family is current, so
 * the name itself must describe what the control does, not which state it's
 * in right now.
 */
const ACCESSIBLE_NAME = "Rotary engine family";

/**
 * "Piston / Rotary" switch for one engine slot (TECHNICAL_DESIGN.md §27):
 * the family selector the spec calls for, built on the exact switch pattern
 * `CylinderViewToggle` already established — both named states shown at
 * once, flanking the track, with `aria-checked` (true meaning rotary, the
 * side the track slides toward) carrying the state instead of a label that
 * mutates on click.
 *
 * Switching family is a geometry-CLASS change, the same rule §11.1 gives
 * every geometry change: it never touches `crankAngleRad` or playback. It
 * also never touches the piston or rotary config fields themselves — they
 * are parallel store fields (§27), not a discriminated union, so whichever
 * geometry a family last had is exactly what reappears when the switch
 * flips back.
 */
export function EngineFamilySelector({
  slot = "primary",
}: EngineFamilySelectorProps) {
  const engineFamily = useEngineStore((state) => state.engineFamily);
  const comparisonEngineFamily = useEngineStore(
    (state) => state.comparisonEngineFamily,
  );
  const setEngineFamily = useEngineStore((state) => state.setEngineFamily);
  const setComparisonEngineFamily = useEngineStore(
    (state) => state.setComparisonEngineFamily,
  );

  const family = slot === "comparison" ? comparisonEngineFamily : engineFamily;
  const commit =
    slot === "comparison" ? setComparisonEngineFamily : setEngineFamily;
  const isRotary = family === "rotary";

  const labelId = useId();

  return (
    <div className={styles.field}>
      <span className={styles.label} id={labelId}>
        Engine family
      </span>
      <div className={styles.switchRow}>
        <span
          className={!isRotary ? styles.optionActive : styles.optionInactive}
          aria-hidden="true"
        >
          {PISTON_LABEL}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isRotary}
          aria-label={ACCESSIBLE_NAME}
          className={styles.switch}
          onClick={() => commit(isRotary ? "piston" : "rotary")}
        >
          <span className={styles.track} aria-hidden="true">
            <span className={styles.thumb} />
          </span>
        </button>
        <span
          className={isRotary ? styles.optionActive : styles.optionInactive}
          aria-hidden="true"
        >
          {ROTARY_LABEL}
        </span>
      </div>
    </div>
  );
}
