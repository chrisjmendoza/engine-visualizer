import { useEffect, useId, useRef, useState } from "react";
import styles from "./AboutDialog.module.css";

const REPO_URL = "https://github.com/chrisjmendoza/engine-visualizer";

/** Elements a focus trap should cycle through inside the dialog panel. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * "About" affordance for the header (TECHNICAL_DESIGN.md is the deeper
 * reference; this is the in-app summary of what the app is, what its
 * kinematics do and don't model, and how preset figures are sourced).
 *
 * Rendered as a plain div with `role="dialog"` rather than the native
 * `<dialog>` element: jsdom (this project's Vitest environment) does not
 * implement `HTMLDialogElement.showModal`/`close`, so a native dialog would
 * be untestable here. Focus trapping, Escape-to-close, and focus restore
 * to the trigger are implemented by hand below instead.
 */
export function AboutDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const panel = panelRef.current;
    const focusables = panel
      ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      : [];
    (focusables[0] ?? panel)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panel) {
        return;
      }
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (items.length === 0) {
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const trigger = triggerRef.current;
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Runs when `isOpen` flips back to false (or on unmount) — restores
      // focus to the trigger so closing the dialog never strands focus.
      trigger?.focus();
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={styles.trigger}
        onClick={() => setIsOpen(true)}
      >
        About
      </button>
      {isOpen ? (
        <div
          className={styles.overlay}
          onClick={() => setIsOpen(false)}
          data-testid="about-overlay"
        >
          <div
            ref={panelRef}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.panelHeader}>
              <h2 id={titleId} className={styles.title}>
                About Engine Visualizer
              </h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className={styles.body}>
              <p>
                Engine Visualizer is an educational kinematic visualizer of
                slider-crank motion. Piston position, velocity, and acceleration
                come from the exact slider-crank geometry, not a sinusoidal
                approximation — this is a teaching tool for how that mechanism
                actually moves, not an engineering-validation system.
              </p>
              <h3 className={styles.sectionTitle}>What&apos;s modeled</h3>
              <p>
                Exact piston kinematics with closed-form velocity and
                acceleration; inline multi-cylinder layouts (3, 4, and 6
                cylinders) with each cylinder driven at its real crank-throw
                phase offset, drawn in its own cutaway plane so the phase
                relationships of a real crankshaft are visible at a glance;
                compression represented as a flat clearance disc at the true
                clearance height for the engine&apos;s compression ratio; and
                the idealized 720° four-stroke cycle (intake, compression,
                power, exhaust) with no valve-timing overlap.
              </p>
              <p>
                It does not model combustion, valve events or camshafts, a true
                axial 3D crankshaft (cylinders are laid out side by side rather
                than stacked along one crankshaft axis), or CAD-accurate
                component geometry.
              </p>
              <h3 className={styles.sectionTitle}>
                Where the numbers come from
              </h3>
              <p>
                Every preset engine&apos;s bore, stroke, connecting-rod length,
                compression ratio, redline, and power/torque figures are
                corroborated by at least two independent sources, cited in
                source comments in the code alongside the market or model-year
                variant they describe. A figure that couldn&apos;t clear that
                two-source bar is left out rather than guessed.
              </p>
              <h3 className={styles.sectionTitle}>Built with</h3>
              <p>
                React, TypeScript, and Three.js (via React Three Fiber) for
                rendering; the slider-crank mathematics itself lives in a small
                set of pure, unit-tested functions with no dependency on the UI
                or rendering layers.{" "}
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.link}
                >
                  View the source on GitHub
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
