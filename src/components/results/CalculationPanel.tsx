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
import { formatRounded } from "../shared/formatting";
import { resolveSlotConfig } from "../shared/configSlot";
import type { ConfigSlot } from "../shared/configSlot";
import {
  describeMechanism,
  lengthForDisplay,
  lengthRangeForDisplay,
} from "../shared/calculationFormatting";
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
 */
export function CalculationPanel({ slot = "primary" }: CalculationPanelProps) {
  const config = useEngineStore((state) => state.config);
  const comparisonConfig = useEngineStore((state) => state.comparisonConfig);
  const slotConfig = resolveSlotConfig(slot, config, comparisonConfig);
  const rpm = useEngineStore((state) => state.rpm);
  const crankAngleRad = useEngineStore((state) => state.crankAngleRad);
  const displayUnit = useEngineStore((state) => state.preferences.displayUnit);

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

  const results: { label: string; value: string }[] = [
    {
      label: "Cylinder displacement",
      value: `${formatRounded(displacementCc, 1)} cc`,
    },
    {
      label: "Bore-to-stroke ratio",
      value: `${formatRounded(boreStrokeRatio, 2)}:1`,
    },
    {
      label: "Rod-to-stroke ratio",
      value: `${formatRounded(rodStrokeRatio, 2)}:1`,
    },
    {
      label: "Mean piston speed",
      value: `${formatRounded(meanPistonSpeedMps, 2)} m/s`,
    },
    {
      label: "Clearance volume",
      value: `${formatRounded(clearanceVolumeCc, 1)} cc`,
    },
    {
      label: "Clearance height (TDC)",
      value: lengthForDisplay(clearanceHeightMm, displayUnit),
    },
    {
      label: "Current crank angle",
      value: `${formatRounded(radToDeg(mechanism.crankAngleRad), 1)}°`,
    },
    {
      // Static reference range: the piston crown's closest approach to the
      // head (TDC) to its farthest retreat (BDC), independent of crank
      // angle. Placed directly above the live per-angle rows so this reads
      // as "range, then current".
      label: "Piston-to-head distance",
      value: lengthRangeForDisplay(
        pistonToHeadMinMm,
        pistonToHeadMaxMm,
        displayUnit,
      ),
    },
    {
      label: "Piston displacement from TDC",
      value: lengthForDisplay(mechanism.pistonDisplacementMm, displayUnit),
    },
    {
      label: "Current piston-to-head distance",
      value: lengthForDisplay(pistonToHeadCurrentMm, displayUnit),
    },
    {
      label: "Connecting-rod angle",
      value: `${formatRounded(radToDeg(mechanism.rodAngleRad), 1)}°`,
    },
  ];

  return (
    <section className={styles.panel} aria-label="Calculated results">
      <h2 className={styles.heading}>Calculated results</h2>
      <dl className={styles.list}>
        {results.map((result) => (
          <div className={styles.row} key={result.label}>
            <dt className={styles.term}>{result.label}</dt>
            <dd className={styles.value}>{result.value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.description} data-testid="mechanism-description">
        {describeMechanism(mechanism, displayUnit)}
      </p>
    </section>
  );
}
