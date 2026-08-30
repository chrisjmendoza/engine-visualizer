import { Suspense, lazy } from "react";
import { AnimationControls } from "../components/controls/AnimationControls";
import { EngineGeometryControls } from "../components/controls/EngineGeometryControls";
import { UnitSelector } from "../components/controls/UnitSelector";
import { ApplicationShell } from "../components/layout/ApplicationShell";
import { CalculationPanel } from "../components/results/CalculationPanel";

/**
 * Three.js (~330 kB gzipped) loads in its own chunk so the controls and
 * results render immediately (§18).
 */
const EngineViewport = lazy(() =>
  import("../scene/EngineViewport").then((m) => ({
    default: m.EngineViewport,
  })),
);

export function App() {
  return (
    <ApplicationShell
      viewport={
        <Suspense fallback={<p role="status">Loading 3D viewport…</p>}>
          <EngineViewport />
        </Suspense>
      }
      panel={
        <>
          <EngineGeometryControls />
          <AnimationControls />
          <UnitSelector />
          <CalculationPanel />
        </>
      }
    />
  );
}
