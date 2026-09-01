import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AboutDialog } from "./AboutDialog";
import styles from "./ApplicationShell.module.css";
import { PanelResizeHandle } from "./PanelResizeHandle";

export interface ApplicationShellProps {
  /** The Three.js engine viewport (or a placeholder while it loads). */
  viewport: ReactNode;
  /** Geometry controls, animation controls, unit selector, and results. */
  panel: ReactNode;
}

/**
 * Side-by-side split kicks in at the same 900px tier as
 * ApplicationShell.module.css's `@media (min-width: 900px)` rule — that CSS
 * is the actual source of truth for the visual layout, this constant just
 * mirrors the same cutoff so the resize handle knows, before rendering,
 * whether there is a split to drag at all (there is nothing to grab in the
 * stacked mobile layout). Do not change one without the other.
 */
const TWO_COLUMN_BREAKPOINT_PX = 900;

/**
 * Panel width bounds and default, all in CSS pixels (matches the units the
 * resize handle's `aria-valuenow/min/max` are expressed in).
 *
 * `MIN_PANEL_WIDTH_PX` is the floor `.panel` already shipped with at the
 * 900px tier before this control existed — the narrowest width its controls
 * were already tolerating, not a new guess. `MAX_PANEL_WIDTH_RATIO` keeps
 * the viewport meaningful by capping the panel at ~65% of the window.
 * `DEFAULT_PANEL_WIDTH_PX` sits comfortably inside that range even at the
 * 900px tier itself (900 * 0.65 = 585), and stays under
 * CalculationPanel's 440px container-query threshold so the results list's
 * default single-column appearance is unchanged from before this control
 * existed.
 */
const MIN_PANEL_WIDTH_PX = 320;
const MAX_PANEL_WIDTH_RATIO = 0.65;
const DEFAULT_PANEL_WIDTH_PX = 380;

function getMaxPanelWidthPx(): number {
  if (typeof window === "undefined") {
    return DEFAULT_PANEL_WIDTH_PX;
  }
  return Math.max(
    MIN_PANEL_WIDTH_PX,
    window.innerWidth * MAX_PANEL_WIDTH_RATIO,
  );
}

function getIsTwoColumnLayout(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.innerWidth >= TWO_COLUMN_BREAKPOINT_PX;
}

/** Tracks whether the desktop two-column split is active (see the constant
 * above) so the resize handle is only ever mounted when there is a divider
 * for it to be. Deliberately window-width-based, matching the CSS media
 * query it mirrors, rather than a container query against the shell itself.
 */
function useIsTwoColumnLayout(): boolean {
  const [isTwoColumn, setIsTwoColumn] = useState(getIsTwoColumnLayout);

  useEffect(() => {
    function handleResize() {
      setIsTwoColumn(getIsTwoColumnLayout());
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isTwoColumn;
}

/**
 * Two-region responsive application layout (TECHNICAL_DESIGN.md §4.2-4.3).
 *
 * On desktop, the viewport and the control/results panel sit side by side,
 * and a drag handle between them lets the panel be resized (session-local
 * only — plain component state, not persisted; see the width state below).
 * On narrow screens the viewport appears first with the panel stacked below
 * it, matching source order so no reflow trickery is needed, and inputs stay
 * touch-sized. The page itself never scrolls horizontally.
 */
export function ApplicationShell({ viewport, panel }: ApplicationShellProps) {
  const isTwoColumn = useIsTwoColumnLayout();
  const bodyRef = useRef<HTMLDivElement>(null);
  // Deliberately plain component state rather than localStorage: every
  // other preference in this app (units, labels, playback speed...) is
  // session-local today, and the design doc's v1 decisions lean the same
  // way. If the panel width should survive a reload later, persisting this
  // one value to localStorage is the natural, isolated follow-up.
  const [panelWidthPx, setPanelWidthPx] = useState(DEFAULT_PANEL_WIDTH_PX);

  // Written on every pointer move / key press during a resize, straight to
  // the CSS custom property the layout reads (see ApplicationShell.module.css)
  // — this is what makes the R3F canvas reflow live while dragging, without
  // re-rendering ApplicationShell (and everything beneath it) at pointer-move
  // rate. `panelWidthPx` state only updates once the interaction settles.
  function applyLiveWidth(nextWidthPx: number) {
    bodyRef.current?.style.setProperty("--panel-width", `${nextWidthPx}px`);
  }

  const bodyStyle = {
    "--panel-width": `${panelWidthPx}px`,
  } as CSSProperties;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>Engine Visualizer</h1>
        <p className={styles.subtitle}>Slider-crank mechanism explorer</p>
        <AboutDialog />
      </header>
      <div className={styles.body} ref={bodyRef} style={bodyStyle}>
        <section className={styles.viewport} aria-label="Engine viewport">
          {viewport}
        </section>
        {isTwoColumn && (
          <PanelResizeHandle
            widthPx={panelWidthPx}
            defaultWidthPx={DEFAULT_PANEL_WIDTH_PX}
            minWidthPx={MIN_PANEL_WIDTH_PX}
            getMaxWidthPx={getMaxPanelWidthPx}
            onLiveWidthChange={applyLiveWidth}
            onCommit={setPanelWidthPx}
          />
        )}
        <section className={styles.panel} aria-label="Controls and results">
          {panel}
        </section>
      </div>
    </div>
  );
}
