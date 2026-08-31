import { Suspense, lazy } from "react";
import { AnimationControls } from "../components/controls/AnimationControls";
import { ComparisonToggle } from "../components/controls/ComparisonToggle";
import { ShareLinkButton } from "../components/controls/ShareLinkButton";
import { UnitSelector } from "../components/controls/UnitSelector";
import { ApplicationShell } from "../components/layout/ApplicationShell";
import { EngineComparisonLayout } from "../components/layout/EngineComparisonLayout";
import { EnginePanel } from "../components/layout/EnginePanel";
import { SharedControlsRow } from "../components/layout/SharedControlsRow";
import { ComparisonTable } from "../components/results/ComparisonTable";
import { useShareLinkSync } from "../components/shared/useShareLinkSync";
import { useEngineStore } from "../state/engineStore";
import styles from "./App.module.css";

/**
 * Three.js (~330 kB gzipped) loads in its own chunk so the controls and
 * results render immediately (§18).
 */
const EngineViewport = lazy(() =>
  import("../scene/EngineViewport").then((m) => ({
    default: m.EngineViewport,
  })),
);

/**
 * Application root (TECHNICAL_DESIGN.md §16). `AnimationControls` and
 * `UnitSelector` are shared: RPM, play/pause, playback speed, crank angle,
 * and display unit all apply to both engines when comparing. `SharedControlsRow`
 * only affects layout (pairing them side by side at tablet-portrait widths),
 * not behavior. In the default (non-comparison) state, a single unlabeled
 * `EnginePanel` renders exactly the controls this app has always shown —
 * presets, geometry inputs, and its own `CalculationPanel`. Comparison mode
 * instead renders two `EnginePanel`s with `showResults={false}` (presets
 * and geometry only, each explicitly labeled "Engine A"/"Engine B" and
 * placed side by side once there is room, via `EngineComparisonLayout`)
 * plus a single `ComparisonTable` showing both engines' results together —
 * a gpuboss-style table replaces two separate result lists rather than
 * duplicating them.
 *
 * `useShareLinkSync()` hydrates the store from `window.location.search` on
 * mount (a shared link opens straight into the state it was copied from)
 * and keeps the address bar in sync with the store afterward, so the
 * current URL is always a valid link to the current configuration —
 * `ShareLinkButton` just copies it.
 */
export function App() {
  const isComparing = useEngineStore(
    (state) => state.comparisonConfig !== null,
  );

  useShareLinkSync();

  return (
    <ApplicationShell
      viewport={
        <Suspense fallback={<p role="status">Loading 3D viewport…</p>}>
          <EngineViewport />
        </Suspense>
      }
      panel={
        <>
          <div className={styles.actionsRow}>
            <ComparisonToggle />
            <ShareLinkButton />
          </div>
          <SharedControlsRow>
            <AnimationControls />
            <UnitSelector />
          </SharedControlsRow>
          {isComparing ? (
            <>
              <EngineComparisonLayout>
                <EnginePanel
                  slot="primary"
                  heading="Engine A"
                  showResults={false}
                />
                <EnginePanel
                  slot="comparison"
                  heading="Engine B"
                  showResults={false}
                />
              </EngineComparisonLayout>
              <ComparisonTable />
            </>
          ) : (
            <EnginePanel slot="primary" />
          )}
        </>
      }
    />
  );
}
