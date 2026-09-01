import { useId } from "react";
import { useEngineStore } from "../../state/engineStore";
import { EngineFamilySelector } from "../controls/EngineFamilySelector";
import { PresetSelector } from "../controls/PresetSelector";
import { EngineGeometryControls } from "../controls/EngineGeometryControls";
import { RotaryPresetSelector } from "../controls/RotaryPresetSelector";
import { RotaryGeometryControls } from "../controls/RotaryGeometryControls";
import { CalculationPanel } from "../results/CalculationPanel";
import { resolveSlotFamily } from "../shared/configSlot";
import type { ConfigSlot } from "../shared/configSlot";
import styles from "./EnginePanel.module.css";

export interface EnginePanelProps {
  /** Which engine this group edits: engine A (`"primary"`) or B (`"comparison"`). */
  slot: ConfigSlot;
  /**
   * Heading shown above this group (e.g. "Engine A"). Omit in
   * single-engine (non-comparison) mode, where one implicit engine needs no
   * disambiguating label and the panel looks the same as it always has.
   */
  heading?: string;
  /**
   * Whether to render this engine's own `CalculationPanel`. Defaults to
   * `true`. Comparison mode passes `false` here for both engines and shows
   * `ComparisonTable` once instead, alongside the two (preset + geometry
   * only) `EnginePanel`s — see `App.tsx`.
   */
  showResults?: boolean;
}

/**
 * Groups one engine's family selector, presets, and geometry inputs (and,
 * outside comparison mode, its calculated results) under a single heading,
 * so — while comparing — it is unambiguous which controls affect which
 * mechanism. The scene renders engine A on the left and engine B on the
 * right, matching the "Engine A" / "Engine B" order here. Controls that
 * affect both engines (playback, RPM, crank angle, display units) live
 * outside this component, not inside it.
 *
 * `EngineFamilySelector` (§27) decides which pair of controls this slot
 * shows below it: `PresetSelector` + `EngineGeometryControls` for piston,
 * `RotaryPresetSelector` + `RotaryGeometryControls` for rotary. Only one
 * pair is ever mounted at a time — switching family never leaves the other
 * family's controls sitting around uselessly bound to a slot they no longer
 * describe. `CalculationPanel` needs no such branch here: it reads the
 * slot's family itself and shows the matching results internally.
 */
export function EnginePanel({
  slot,
  heading,
  showResults = true,
}: EnginePanelProps) {
  const headingId = useId();
  const engineFamily = useEngineStore((state) => state.engineFamily);
  const comparisonEngineFamily = useEngineStore(
    (state) => state.comparisonEngineFamily,
  );
  const slotFamily = resolveSlotFamily(
    slot,
    engineFamily,
    comparisonEngineFamily,
  );

  return (
    <section
      className={styles.group}
      aria-labelledby={heading ? headingId : undefined}
    >
      {heading ? (
        <h2 className={styles.heading} id={headingId}>
          {heading}
        </h2>
      ) : null}
      {/*
       * A container query needs a container that isn't the element being
       * queried, so `.group` (which establishes the container, sized by
       * wherever this panel sits in the page) and `.body` (which reads
       * that size via `@container`) have to be two different elements —
       * see EnginePanel.module.css.
       */}
      <div className={styles.body}>
        <EngineFamilySelector slot={slot} />
        {slotFamily === "rotary" ? (
          <>
            <RotaryPresetSelector slot={slot} />
            <RotaryGeometryControls slot={slot} />
          </>
        ) : (
          <>
            <PresetSelector slot={slot} />
            <EngineGeometryControls slot={slot} />
          </>
        )}
        {showResults ? <CalculationPanel slot={slot} /> : null}
      </div>
    </section>
  );
}
