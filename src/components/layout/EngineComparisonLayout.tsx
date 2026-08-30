import type { ReactNode } from "react";
import styles from "./EngineComparisonLayout.module.css";

export interface EngineComparisonLayoutProps {
  /** Engine A's and engine B's `EnginePanel` groups, in that order. */
  children: ReactNode;
}

/**
 * Wraps the two `EnginePanel` groups while comparison mode is on.
 *
 * Stacked (one above the other) on phones and on the side-by-side
 * viewport/panel split's narrower widths (900-1200px), where a narrow panel
 * column has no room to spare. Two-up — mirroring the scene's engine
 * A-left/B-right arrangement — on tablet portrait (600-900px, where the
 * panel is still the full device width) and again from 1200px up (where
 * `ApplicationShell.module.css` also widens the panel column to give both
 * columns real room; see the `[data-comparison-layout]` attribute below).
 */
export function EngineComparisonLayout({
  children,
}: EngineComparisonLayoutProps) {
  return (
    <div className={styles.grid} data-comparison-layout="">
      {children}
    </div>
  );
}
