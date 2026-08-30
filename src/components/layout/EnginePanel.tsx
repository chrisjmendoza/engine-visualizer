import { useId } from "react";
import { PresetSelector } from "../controls/PresetSelector";
import { EngineGeometryControls } from "../controls/EngineGeometryControls";
import { CalculationPanel } from "../results/CalculationPanel";
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
}

/**
 * Groups one engine's presets, geometry inputs, and calculated results
 * under a single heading, so — while comparing — it is unambiguous which
 * controls affect which mechanism. The scene renders engine A on the left
 * and engine B on the right, matching the "Engine A" / "Engine B" order
 * here. Controls that affect both engines (playback, RPM, crank angle,
 * display units) live outside this component, not inside it.
 */
export function EnginePanel({ slot, heading }: EnginePanelProps) {
  const headingId = useId();

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
        <PresetSelector slot={slot} />
        <EngineGeometryControls slot={slot} />
        <CalculationPanel slot={slot} />
      </div>
    </section>
  );
}
