import { useId } from "react";
import { useEngineStore } from "../../state/engineStore";
import type { ConfigSlot } from "../shared/configSlot";
import styles from "./CylinderViewToggle.module.css";

export interface CylinderViewToggleProps {
  /**
   * Which engine this instance edits: `"primary"` (engine A,
   * `store.singleCylinderView`) or `"comparison"` (engine B,
   * `store.comparisonSingleCylinderView`). Defaults to `"primary"`.
   */
  slot?: ConfigSlot;
}

/** What each state of the switch is called, in the order it reads. */
const SINGLE_LABEL = "Single cylinder";
const FULL_LABEL = "Full engine";

/**
 * The switch's one, unchanging accessible name. `aria-checked` carries the
 * state, exactly like any other switch — the name must not describe *which*
 * state is current, only *what the control does*, or a screen reader
 * announces what sounds like a different control each time it flips.
 */
const ACCESSIBLE_NAME = "Show all cylinders";

/**
 * "Single cylinder / Full engine" switch for one engine
 * (TECHNICAL_DESIGN.md §24a).
 *
 * The companion to `EngineLayoutSelector`, and deliberately not part of it:
 * the layout says *which engine this is*, this says *how much of it you want
 * to look at*. Studying one cylinder therefore no longer costs you the
 * knowledge that it is a V8's cylinder — and picking an LS7 preset while
 * zoomed in on one cylinder keeps you on one cylinder, now labelled as a V8's.
 *
 * A real switch rather than a checkbox: both named states ("Single cylinder"
 * / "Full engine") are shown at once, flanking the track, with the inactive
 * side dimmed — so the control reads as a position between two labelled
 * states rather than as one label that mutates on click. Those two labels
 * are decorative (`aria-hidden`); the switch itself carries a constant
 * `aria-label` (`ACCESSIBLE_NAME`) so its accessible name never changes, and
 * `aria-checked` — true meaning the whole engine, since that is the
 * affirmative state the track slides toward — carries the state instead.
 * It is a `<button role="switch">`, which gets Space/Enter activation and
 * focus order from the underlying button for free.
 *
 * Switching the view is not a geometry change but is governed by the same
 * rule (§11.1): it never touches the crank angle or playback.
 */
export function CylinderViewToggle({
  slot = "primary",
}: CylinderViewToggleProps) {
  const singleCylinderView = useEngineStore(
    (state) => state.singleCylinderView,
  );
  const comparisonSingleCylinderView = useEngineStore(
    (state) => state.comparisonSingleCylinderView,
  );
  const setSingleCylinderView = useEngineStore(
    (state) => state.setSingleCylinderView,
  );
  const setComparisonSingleCylinderView = useEngineStore(
    (state) => state.setComparisonSingleCylinderView,
  );

  const isSingle =
    slot === "comparison" ? comparisonSingleCylinderView : singleCylinderView;
  const commit =
    slot === "comparison"
      ? setComparisonSingleCylinderView
      : setSingleCylinderView;

  const labelId = useId();

  return (
    <div className={styles.field}>
      <span className={styles.label} id={labelId}>
        Cylinders shown
      </span>
      <div className={styles.switchRow}>
        <span
          className={isSingle ? styles.optionActive : styles.optionInactive}
          aria-hidden="true"
        >
          {SINGLE_LABEL}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={!isSingle}
          aria-label={ACCESSIBLE_NAME}
          className={styles.switch}
          onClick={() => commit(!isSingle)}
        >
          <span className={styles.track} aria-hidden="true">
            <span className={styles.thumb} />
          </span>
        </button>
        <span
          className={!isSingle ? styles.optionActive : styles.optionInactive}
          aria-hidden="true"
        >
          {FULL_LABEL}
        </span>
      </div>
    </div>
  );
}
