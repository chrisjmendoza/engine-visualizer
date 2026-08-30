import { useEngineStore } from "../../state/engineStore";
import { calculateMechanismState } from "../../engine/kinematics";
import {
  calculateBoreStrokeRatio,
  calculateClearanceHeightMm,
  calculateClearanceVolumeCc,
  calculateCylinderDisplacementCc,
  calculateMeanPistonSpeedMps,
  calculateRodStrokeRatio,
} from "../../engine/calculations";
import { mmToIn, radToDeg } from "../../engine/units";
import type { DisplayUnit, MechanismState } from "../../engine/types";
import { formatRounded } from "../shared/formatting";
import { resolveSlotConfig } from "../shared/configSlot";
import type { ConfigSlot } from "../shared/configSlot";
import styles from "./CalculationPanel.module.css";

function lengthForDisplay(mm: number, unit: DisplayUnit): string {
  const value = unit === "in" ? mmToIn(mm) : mm;
  const decimals = unit === "in" ? 3 : 2;
  return `${formatRounded(value, decimals)} ${unit}`;
}

/** A mechanical-terms sentence summarizing the live mechanism state (§19). */
function describeMechanism(state: MechanismState, unit: DisplayUnit): string {
  const angleDeg = radToDeg(state.crankAngleRad);
  const rodDeg = radToDeg(state.rodAngleRad);

  let tilt: string;
  if (rodDeg > 0.05) {
    tilt = `tilted ${formatRounded(rodDeg, 1)} degrees toward the crankpin's side of the cylinder`;
  } else if (rodDeg < -0.05) {
    tilt = `tilted ${formatRounded(Math.abs(rodDeg), 1)} degrees away from the crankpin's side of the cylinder`;
  } else {
    tilt = "aligned with the cylinder centerline";
  }

  return (
    `At a crank angle of ${formatRounded(angleDeg, 1)} degrees, the piston is ` +
    `${lengthForDisplay(state.pistonDisplacementMm, unit)} past top dead center, ` +
    `and the connecting rod is ${tilt}.`
  );
}

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
      // Static reference range: TDC (0) to BDC (the stroke), independent of
      // crank angle. Placed directly above the live per-angle displacement
      // row so the pair reads as "range, then current".
      label: "Piston travel (from TDC)",
      value: `0 – ${lengthForDisplay(slotConfig.strokeMm, displayUnit)}`,
    },
    {
      label: "Piston displacement from TDC",
      value: lengthForDisplay(mechanism.pistonDisplacementMm, displayUnit),
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
