import { useId } from "react";
import { useEngineStore } from "../../state/engineStore";
import { calculateMechanismState } from "../../engine/kinematics";
import {
  calculateBoreStrokeRatio,
  calculateClearanceHeightMm,
  calculateClearanceVolumeCc,
  calculateCylinderDisplacementCc,
  calculateMeanPistonSpeedMps,
  calculatePistonToHeadDistanceMm,
  calculateRodStrokeRatio,
} from "../../engine/calculations";
import { radToDeg } from "../../engine/units";
import {
  classifyBoreStrokeRatio,
  formatRounded,
  formatRpm,
} from "../shared/formatting";
import { resolveSlotConfig } from "../shared/configSlot";
import type { ConfigSlot } from "../shared/configSlot";
import {
  METRIC_INFO_BY_ID,
  lengthForDisplay,
  lengthRangeForDisplay,
} from "../shared/calculationFormatting";
import { useMetricInfoToggle } from "../shared/useMetricInfoToggle";
import { MetricLabelButton } from "../shared/MetricLabelButton";
import styles from "./CalculationPanel.module.css";

export interface CalculationPanelProps {
  /**
   * Which engine's results to show: `"primary"` (engine A, `store.config`)
   * or `"comparison"` (engine B, `store.comparisonConfig`). Defaults to
   * `"primary"`. RPM, playback, and crank angle are shared by both engines,
   * so only the config-derived values differ between slots.
   */
  slot?: ConfigSlot;
}

/**
 * Calculated results panel (TECHNICAL_DESIGN.md §15). Every value is
 * recomputed from store state through the tested `src/engine` functions —
 * this component holds no mechanical math of its own. Values are rounded
 * only for display; the underlying calculations keep full precision.
 *
 * Each row's label doubles as a trigger that expands an inline explainer
 * (from `METRIC_INFO`) directly beneath that row — see
 * `useMetricInfoToggle` for the open/close/Escape behavior shared with
 * `ComparisonTable`.
 */
export function CalculationPanel({ slot = "primary" }: CalculationPanelProps) {
  const config = useEngineStore((state) => state.config);
  const comparisonConfig = useEngineStore((state) => state.comparisonConfig);
  const slotConfig = resolveSlotConfig(slot, config, comparisonConfig);
  const rpm = useEngineStore((state) => state.rpm);
  const crankAngleRad = useEngineStore((state) => state.crankAngleRad);
  const displayUnit = useEngineStore((state) => state.preferences.displayUnit);

  const { openMetricId, toggleMetric } = useMetricInfoToggle();
  const basePanelId = useId();

  const mechanism = calculateMechanismState(slotConfig, crankAngleRad);
  const displacementCc = calculateCylinderDisplacementCc(
    slotConfig.boreMm,
    slotConfig.strokeMm,
  );
  const boreStrokeRatio = calculateBoreStrokeRatio(
    slotConfig.boreMm,
    slotConfig.strokeMm,
  );
  const rodStrokeRatio = calculateRodStrokeRatio(
    slotConfig.rodLengthMm,
    slotConfig.strokeMm,
  );
  const meanPistonSpeedMps = calculateMeanPistonSpeedMps(
    slotConfig.strokeMm,
    rpm,
  );
  const meanPistonSpeedAtRedlineMps = calculateMeanPistonSpeedMps(
    slotConfig.strokeMm,
    slotConfig.redlineRpm,
  );
  const clearanceVolumeCc = calculateClearanceVolumeCc(
    slotConfig.boreMm,
    slotConfig.strokeMm,
    slotConfig.compressionRatio,
  );
  const clearanceHeightMm = calculateClearanceHeightMm(
    slotConfig.strokeMm,
    slotConfig.compressionRatio,
  );
  const pistonToHeadMinMm = calculatePistonToHeadDistanceMm(
    slotConfig.strokeMm,
    slotConfig.compressionRatio,
    0,
  );
  const pistonToHeadMaxMm = calculatePistonToHeadDistanceMm(
    slotConfig.strokeMm,
    slotConfig.compressionRatio,
    slotConfig.strokeMm,
  );
  const pistonToHeadCurrentMm = calculatePistonToHeadDistanceMm(
    slotConfig.strokeMm,
    slotConfig.compressionRatio,
    mechanism.pistonDisplacementMm,
  );

  const results: { id: string; label: string; value: string }[] = [
    {
      id: "cylinderDisplacement",
      label: "Cylinder displacement",
      value: `${formatRounded(displacementCc, 1)} cc`,
    },
    {
      id: "boreStrokeRatio",
      label: "Bore-to-stroke ratio",
      value: `${formatRounded(boreStrokeRatio, 2)}:1 · ${classifyBoreStrokeRatio(boreStrokeRatio)}`,
    },
    {
      id: "rodStrokeRatio",
      label: "Rod-to-stroke ratio",
      value: `${formatRounded(rodStrokeRatio, 2)}:1`,
    },
    {
      id: "redline",
      label: "Redline",
      value: formatRpm(slotConfig.redlineRpm),
    },
    {
      id: "meanPistonSpeed",
      label: "Mean piston speed",
      value: `${formatRounded(meanPistonSpeedMps, 2)} m/s`,
    },
    {
      id: "meanPistonSpeedRedline",
      label: "Mean piston speed at redline",
      value: `${formatRounded(meanPistonSpeedAtRedlineMps, 2)} m/s`,
    },
    {
      id: "clearanceVolume",
      label: "Clearance volume",
      value: `${formatRounded(clearanceVolumeCc, 1)} cc`,
    },
    {
      id: "clearanceHeight",
      label: "Clearance height (TDC)",
      value: lengthForDisplay(clearanceHeightMm, displayUnit),
    },
    {
      id: "currentCrankAngle",
      label: "Current crank angle",
      value: `${formatRounded(radToDeg(mechanism.crankAngleRad), 1)}°`,
    },
    {
      // Static reference range: the piston crown's closest approach to the
      // head (TDC) to its farthest retreat (BDC), independent of crank
      // angle. Placed directly above the live per-angle rows so this reads
      // as "range, then current".
      id: "pistonToHeadRange",
      label: "Piston-to-head distance",
      value: lengthRangeForDisplay(
        pistonToHeadMinMm,
        pistonToHeadMaxMm,
        displayUnit,
      ),
    },
    {
      id: "pistonDisplacement",
      label: "Piston displacement from TDC",
      value: lengthForDisplay(mechanism.pistonDisplacementMm, displayUnit),
    },
    {
      id: "currentPistonToHead",
      label: "Current piston-to-head distance",
      value: lengthForDisplay(pistonToHeadCurrentMm, displayUnit),
    },
    {
      id: "rodAngle",
      label: "Connecting-rod angle",
      value: `${formatRounded(radToDeg(mechanism.rodAngleRad), 1)}°`,
    },
  ];

  return (
    <section className={styles.panel} aria-label="Calculated results">
      <h2 className={styles.heading}>Calculated results</h2>
      <dl className={styles.list}>
        {results.map((result) => {
          const panelId = `${basePanelId}-${result.id}`;
          const isOpen = openMetricId === result.id;
          const info = METRIC_INFO_BY_ID.get(result.id);
          return (
            <div className={styles.row} key={result.id}>
              <div className={styles.mainRow}>
                <dt>
                  <MetricLabelButton
                    id={result.id}
                    label={result.label}
                    isOpen={isOpen}
                    onToggle={toggleMetric}
                    panelId={panelId}
                    className={styles.term}
                  />
                </dt>
                <dd className={styles.value}>{result.value}</dd>
              </div>
              {isOpen && info ? (
                <dd className={styles.explanation} id={panelId}>
                  {info.body}
                </dd>
              ) : null}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
