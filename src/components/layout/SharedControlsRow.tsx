import type { ReactNode } from "react";
import styles from "./SharedControlsRow.module.css";

export interface SharedControlsRowProps {
  /** `AnimationControls` and `UnitSelector`, in that order. */
  children: ReactNode;
}

/**
 * Wraps the controls that apply to every engine at once (playback, RPM,
 * crank angle, display units), pairing them side by side only on tablet
 * portrait (600-900px), where the panel is still full device width and has
 * room to spare. Stacked everywhere else: phones have no width for it, and
 * from 900px up the side-by-side viewport/panel split already narrows the
 * panel column enough that these controls read better full width.
 */
export function SharedControlsRow({ children }: SharedControlsRowProps) {
  return <div className={styles.row}>{children}</div>;
}
