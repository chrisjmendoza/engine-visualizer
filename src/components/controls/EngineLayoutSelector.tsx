import { useId } from "react";
import type { ChangeEvent } from "react";
import { useEngineStore } from "../../state/engineStore";
import {
  ENGINE_ARCHITECTURE_IDS,
  createEngineLayout,
  isEngineLayoutId,
} from "../../engine/engineLayout";
import type {
  EngineLayoutId,
  EngineLayoutKind,
} from "../../engine/engineLayout";
import type { ConfigSlot } from "../shared/configSlot";
import styles from "./EngineLayoutSelector.module.css";

/**
 * Group headings for the picker, in the order they appear. The layouts
 * themselves keep their own display names (`EngineLayoutDefinition.label`),
 * so this component invents no engine vocabulary of its own — it only
 * decides how the roster is arranged for browsing.
 */
const GROUP_LABEL: Record<EngineLayoutKind, string> = {
  single: "Single",
  inline: "Inline",
  v: "V",
  flat: "Flat",
};

const GROUP_ORDER: EngineLayoutKind[] = ["inline", "v", "flat"];

/**
 * The pickable roster, bucketed by layout kind and preserving the roster's
 * order. Built from `ENGINE_ARCHITECTURE_IDS`, so the legacy `"single"` layout
 * never appears — looking at one cylinder is a view, offered by
 * `CylinderViewToggle`, not an engine you can own.
 */
const GROUPS = GROUP_ORDER.map((kind) => ({
  kind,
  label: GROUP_LABEL[kind],
  layouts: ENGINE_ARCHITECTURE_IDS.map((id) => createEngineLayout(id)).filter(
    (layout) => layout.kind === kind,
  ),
})).filter((group) => group.layouts.length > 0);

export interface EngineLayoutSelectorProps {
  /**
   * Which engine this instance edits: `"primary"` (engine A,
   * `store.layoutId`) or `"comparison"` (engine B,
   * `store.comparisonLayoutId`). Defaults to `"primary"`.
   */
  slot?: ConfigSlot;
}

/**
 * "Layout" select for one engine (TECHNICAL_DESIGN.md §24a): the architecture
 * roster — inline-3/4/5/6, the V engines, and the flat boxers — grouped by
 * kind. A layout id, not a cylinder count, is what identifies the engine's
 * arrangement, since a count cannot tell a V8 from an inline-8.
 *
 * This picker answers "which engine is this", and only that. "How much of it
 * am I looking at" is a separate control (`CylinderViewToggle`) over a
 * separate store field, because they are separate questions: studying one
 * cylinder should not mean forgetting it belongs to a V8. That is why the old
 * "Single cylinder" entry is gone from this list.
 *
 * The one place the two questions touch: picking a layout here also switches
 * that engine to the full-engine view, because asking to see a layout and
 * then being shown a single cylinder reads as a broken control. The view
 * toggle still moves back independently, and preset selection leaves the view
 * alone.
 *
 * This is deliberately its own small component rather than a field folded
 * into `EngineGeometryControls` — `layoutId`/`comparisonLayoutId` are store
 * fields alongside `config`, not members of `CrankMechanismConfig`, so they
 * don't fit that component's per-field draft/validation machinery, which is
 * built specifically around that config shape. Changing the layout is a
 * geometry change (§11.1): it never touches crank angle or playback, exactly
 * like `setConfig`.
 */
export function EngineLayoutSelector({
  slot = "primary",
}: EngineLayoutSelectorProps) {
  const layoutId = useEngineStore((state) => state.layoutId);
  const comparisonLayoutId = useEngineStore(
    (state) => state.comparisonLayoutId,
  );
  const setLayoutId = useEngineStore((state) => state.setLayoutId);
  const setComparisonLayoutId = useEngineStore(
    (state) => state.setComparisonLayoutId,
  );
  const setSingleCylinderView = useEngineStore(
    (state) => state.setSingleCylinderView,
  );
  const setComparisonSingleCylinderView = useEngineStore(
    (state) => state.setComparisonSingleCylinderView,
  );

  const value: EngineLayoutId =
    slot === "comparison" ? comparisonLayoutId : layoutId;
  const commit = slot === "comparison" ? setComparisonLayoutId : setLayoutId;
  const commitView =
    slot === "comparison"
      ? setComparisonSingleCylinderView
      : setSingleCylinderView;

  const selectId = useId();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    // The <option> values are always drawn from ENGINE_LAYOUT_IDS below, so
    // this guard can never actually fail — it's here so `commit` (typed to
    // EngineLayoutId) never sees a bare `string`.
    if (!isEngineLayoutId(event.target.value)) {
      return;
    }
    commit(event.target.value);
    // Reaching into this list is an explicit request to see a particular
    // engine, so it also shows the whole engine: picking "V8 (cross-plane)"
    // and still being shown one upright cylinder makes the control look
    // broken, because the label names something the viewport isn't drawing.
    // Choosing a *preset* deliberately does not do this — a car is an
    // identity, not a viewing choice, so studying one cylinder survives
    // switching between engines.
    commitView(false);
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={selectId}>
        Layout
      </label>
      <select
        id={selectId}
        className={styles.select}
        value={value}
        onChange={handleChange}
      >
        {GROUPS.map((group) => (
          <optgroup key={group.kind} label={group.label}>
            {group.layouts.map((layout) => (
              <option key={layout.id} value={layout.id}>
                {layout.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
