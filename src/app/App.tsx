import { Suspense, lazy } from "react";
import { AnimationControls } from "../components/controls/AnimationControls";
import { ComparisonToggle } from "../components/controls/ComparisonToggle";
import { UnitSelector } from "../components/controls/UnitSelector";
import { ApplicationShell } from "../components/layout/ApplicationShell";
import { EngineComparisonLayout } from "../components/layout/EngineComparisonLayout";
import { EnginePanel } from "../components/layout/EnginePanel";
import { SharedControlsRow } from "../components/layout/SharedControlsRow";
import { useEngineStore } from "../state/engineStore";

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
 * not behavior. Each engine's presets, geometry inputs, and calculated
 * results are grouped by `EnginePanel`, one per slot. In the default
 * (non-comparison) state, a single unlabeled `EnginePanel` renders exactly
 * the controls this app has always shown; enabling comparison wraps a
 * second, explicitly labeled "Engine B" group together with engine A's in
 * `EngineComparisonLayout`, which places them side by side once there is
 * room (see its and ApplicationShell's responsive rules).
 */
export function App() {
  const isComparing = useEngineStore(
    (state) => state.comparisonConfig !== null,
  );

  return (
    <ApplicationShell
      viewport={
        <Suspense fallback={<p role="status">Loading 3D viewport…</p>}>
          <EngineViewport />
        </Suspense>
      }
      panel={
        <>
          <ComparisonToggle />
          <SharedControlsRow>
            <AnimationControls />
            <UnitSelector />
          </SharedControlsRow>
          {isComparing ? (
            <EngineComparisonLayout>
              <EnginePanel slot="primary" heading="Engine A" />
              <EnginePanel slot="comparison" heading="Engine B" />
            </EngineComparisonLayout>
          ) : (
            <EnginePanel slot="primary" />
          )}
        </>
      }
    />
  );
}
