import { useId } from "react";
import type { ChangeEvent } from "react";
import { useEngineStore } from "../../state/engineStore";
import {
  SUPPORTED_CYLINDER_COUNTS,
  isSupportedCylinderCount,
} from "../../engine/engineLayout";
import type { SupportedCylinderCount } from "../../engine/engineLayout";
import type { ConfigSlot } from "../shared/configSlot";
import styles from "./CylinderCountSelector.module.css";

/** Display strings for each supported layout (TECHNICAL_DESIGN.md §24a).
 * The store only ever holds the numeric count — these labels are purely
 * this component's presentation, same split as the mm/in unit toggle. */
const CYLINDER_LAYOUT_LABEL: Record<SupportedCylinderCount, string> = {
  1: "Single",
  3: "Inline-3",
  4: "Inline-4",
  6: "Inline-6",
};

export interface CylinderCountSelectorProps {
  /**
   * Which engine this instance edits: `"primary"` (engine A,
   * `store.cylinderCount`) or `"comparison"` (engine B,
   * `store.comparisonCylinderCount`). Defaults to `"primary"`.
   */
  slot?: ConfigSlot;
}

/**
 * "Cylinders" select for one engine's layout (TECHNICAL_DESIGN.md §24a):
 * single, inline-3, inline-4, or inline-6. This is deliberately its own
 * small component rather than a field folded into `EngineGeometryControls`
 * — `cylinderCount`/`comparisonCylinderCount` are store fields alongside
 * `config`, not members of `CrankMechanismConfig`, so they don't fit that
 * component's per-field draft/validation machinery, which is built
 * specifically around that config shape. Changing the count is a geometry
 * change (§11.1): it never touches crank angle or playback, exactly like
 * `setConfig`.
 */
export function CylinderCountSelector({
  slot = "primary",
}: CylinderCountSelectorProps) {
  const cylinderCount = useEngineStore((state) => state.cylinderCount);
  const comparisonCylinderCount = useEngineStore(
    (state) => state.comparisonCylinderCount,
  );
  const setCylinderCount = useEngineStore((state) => state.setCylinderCount);
  const setComparisonCylinderCount = useEngineStore(
    (state) => state.setComparisonCylinderCount,
  );

  const value = slot === "comparison" ? comparisonCylinderCount : cylinderCount;
  const commit =
    slot === "comparison" ? setComparisonCylinderCount : setCylinderCount;

  const selectId = useId();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const count = Number(event.target.value);
    // The <option> values are always drawn from SUPPORTED_CYLINDER_COUNTS
    // below, so this guard can never actually fail — it's here so `commit`
    // (typed to SupportedCylinderCount) never sees a bare `number`.
    if (isSupportedCylinderCount(count)) {
      commit(count);
    }
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={selectId}>
        Cylinders
      </label>
      <select
        id={selectId}
        className={styles.select}
        value={value}
        onChange={handleChange}
      >
        {SUPPORTED_CYLINDER_COUNTS.map((count) => (
          <option key={count} value={count}>
            {CYLINDER_LAYOUT_LABEL[count]}
          </option>
        ))}
      </select>
    </div>
  );
}
