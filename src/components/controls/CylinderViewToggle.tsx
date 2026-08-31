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
 * "Single cylinder / Full engine" switch for one engine
 * (TECHNICAL_DESIGN.md §24a).
 *
 * The companion to `EngineLayoutSelector`, and deliberately not part of it:
 * the layout says *which engine this is*, this says *how much of it you want
 * to look at*. Studying one cylinder therefore no longer costs you the
 * knowledge that it is a V8's cylinder — and picking an LS7 preset while
 * zoomed in on one cylinder keeps you on one cylinder, now labelled as a V8's.
 *
 * A real switch rather than a checkbox: both states are named ("Single
 * cylinder" / "Full engine"), so neither reads as "the unchecked one". It is a
 * `<button role="switch">` with `aria-checked`, which gets Space/Enter
 * activation and focus order from the underlying button for free — checked
 * meaning the whole engine, since that is the affirmative state the visible
 * track slides toward.
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
  const stateId = useId();

  return (
    <div className={styles.field}>
      <span className={styles.label} id={labelId}>
        Cylinders shown
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={!isSingle}
        // Named by the field and by whichever state is current, so the
        // control announces as "Cylinders shown Full engine", never as a
        // bare on/off whose "off" the listener has to guess.
        aria-labelledby={`${labelId} ${stateId}`}
        className={styles.switch}
        onClick={() => commit(!isSingle)}
      >
        <span className={styles.track} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
        <span className={styles.state} id={stateId}>
          {isSingle ? SINGLE_LABEL : FULL_LABEL}
        </span>
      </button>
    </div>
  );
}
