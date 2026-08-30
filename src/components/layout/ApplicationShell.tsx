import type { ReactNode } from "react";
import styles from "./ApplicationShell.module.css";

export interface ApplicationShellProps {
  /** The Three.js engine viewport (or a placeholder while it loads). */
  viewport: ReactNode;
  /** Geometry controls, animation controls, unit selector, and results. */
  panel: ReactNode;
}

/**
 * Two-region responsive application layout (TECHNICAL_DESIGN.md §4.2-4.3).
 *
 * On desktop, the viewport and the control/results panel sit side by side.
 * On narrow screens the viewport appears first with the panel stacked below
 * it, matching source order so no reflow trickery is needed, and inputs stay
 * touch-sized. The page itself never scrolls horizontally.
 */
export function ApplicationShell({ viewport, panel }: ApplicationShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>Engine Visualizer</h1>
        <p className={styles.subtitle}>Slider-crank mechanism explorer</p>
      </header>
      <div className={styles.body}>
        <section className={styles.viewport} aria-label="Engine viewport">
          {viewport}
        </section>
        <section className={styles.panel} aria-label="Controls and results">
          {panel}
        </section>
      </div>
    </div>
  );
}
