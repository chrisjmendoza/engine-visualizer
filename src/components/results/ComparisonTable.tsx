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
import type { CrankMechanismConfig, MechanismState } from "../../engine/types";
import { formatRounded } from "../shared/formatting";
import {
  describeMechanism,
  lengthForDisplay,
  lengthRangeForDisplay,
} from "../shared/calculationFormatting";
import styles from "./ComparisonTable.module.css";

interface EngineMetrics {
  mechanism: MechanismState;
  displacementCc: number;
  boreStrokeRatio: number;
  rodStrokeRatio: number;
  meanPistonSpeedMps: number;
  clearanceVolumeCc: number;
  clearanceHeightMm: number;
  pistonToHeadMinMm: number;
  pistonToHeadMaxMm: number;
  pistonToHeadCurrentMm: number;
}

/** Every value this table (and CalculationPanel) shows, for one engine. */
function computeMetrics(
  config: CrankMechanismConfig,
  rpm: number,
  crankAngleRad: number,
): EngineMetrics {
  const mechanism = calculateMechanismState(config, crankAngleRad);
  return {
    mechanism,
    displacementCc: calculateCylinderDisplacementCc(
      config.boreMm,
      config.strokeMm,
    ),
    boreStrokeRatio: calculateBoreStrokeRatio(config.boreMm, config.strokeMm),
    rodStrokeRatio: calculateRodStrokeRatio(
      config.rodLengthMm,
      config.strokeMm,
    ),
    meanPistonSpeedMps: calculateMeanPistonSpeedMps(config.strokeMm, rpm),
    clearanceVolumeCc: calculateClearanceVolumeCc(
      config.boreMm,
      config.strokeMm,
      config.compressionRatio,
    ),
    clearanceHeightMm: calculateClearanceHeightMm(
      config.strokeMm,
      config.compressionRatio,
    ),
    pistonToHeadMinMm: calculatePistonToHeadDistanceMm(
      config.strokeMm,
      config.compressionRatio,
      0,
    ),
    pistonToHeadMaxMm: calculatePistonToHeadDistanceMm(
      config.strokeMm,
      config.compressionRatio,
      config.strokeMm,
    ),
    pistonToHeadCurrentMm: calculatePistonToHeadDistanceMm(
      config.strokeMm,
      config.compressionRatio,
      mechanism.pistonDisplacementMm,
    ),
  };
}

/** Signed percentage, one decimal, using a true minus sign (e.g. "+7.2%", "−12.4%"). */
function formatSignedPercent(diffFraction: number): string {
  const rounded = Math.round(diffFraction * 1000) / 10;
  if (rounded === 0 || Object.is(rounded, -0)) {
    return "0.0%";
  }
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
}

/**
 * Engine B relative to engine A, as a signed percentage. Undefined (and
 * rendered as "—") when `a` is zero or effectively zero — a percentage
 * relative to nothing is meaningless, not just small. This is common for
 * per-angle values at TDC (piston displacement, rod angle are exactly 0
 * there for every configuration).
 */
function percentDifference(a: number, b: number): string {
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) < 1e-9) {
    return "—";
  }
  return formatSignedPercent((b - a) / a);
}

interface TableRow {
  label: string;
  a: string;
  b: string;
  difference: string;
}

/**
 * Side-by-side results table for comparison mode (replaces the two
 * per-engine `CalculationPanel`s there; see `EnginePanel`'s `showResults`
 * prop). Every value is recomputed from store state through the same
 * `src/engine` functions `CalculationPanel` uses — no mechanical math of
 * its own, and no independent animation/update logic: this reads the same
 * throttled (~10 Hz) store state, so it updates the same way.
 *
 * The "Difference" column is a neutral, signed percentage
 * ((B − A) / A) — never a declared "winner". Most of these metrics (bore
 * ratio, mean piston speed, clearance volume...) have no objectively better
 * side, so this deliberately stops short of gpuboss-style highlighting.
 */
export function ComparisonTable() {
  const config = useEngineStore((state) => state.config);
  const comparisonConfig = useEngineStore((state) => state.comparisonConfig);
  const rpm = useEngineStore((state) => state.rpm);
  const crankAngleRad = useEngineStore((state) => state.crankAngleRad);
  const displayUnit = useEngineStore((state) => state.preferences.displayUnit);

  // This table is only ever mounted by App.tsx while comparisonConfig is
  // set; the fallback to `config` just keeps it crash-proof if that ever
  // changes, rather than reading from a slot that doesn't exist yet.
  const configB = comparisonConfig ?? config;

  const metricsA = computeMetrics(config, rpm, crankAngleRad);
  const metricsB = computeMetrics(configB, rpm, crankAngleRad);

  const sharedAngleDeg = `${formatRounded(radToDeg(crankAngleRad), 1)}°`;

  const rows: TableRow[] = [
    {
      label: "Cylinder displacement",
      a: `${formatRounded(metricsA.displacementCc, 1)} cc`,
      b: `${formatRounded(metricsB.displacementCc, 1)} cc`,
      difference: percentDifference(
        metricsA.displacementCc,
        metricsB.displacementCc,
      ),
    },
    {
      label: "Bore-to-stroke ratio",
      a: `${formatRounded(metricsA.boreStrokeRatio, 2)}:1`,
      b: `${formatRounded(metricsB.boreStrokeRatio, 2)}:1`,
      difference: percentDifference(
        metricsA.boreStrokeRatio,
        metricsB.boreStrokeRatio,
      ),
    },
    {
      label: "Rod-to-stroke ratio",
      a: `${formatRounded(metricsA.rodStrokeRatio, 2)}:1`,
      b: `${formatRounded(metricsB.rodStrokeRatio, 2)}:1`,
      difference: percentDifference(
        metricsA.rodStrokeRatio,
        metricsB.rodStrokeRatio,
      ),
    },
    {
      label: "Mean piston speed",
      a: `${formatRounded(metricsA.meanPistonSpeedMps, 2)} m/s`,
      b: `${formatRounded(metricsB.meanPistonSpeedMps, 2)} m/s`,
      difference: percentDifference(
        metricsA.meanPistonSpeedMps,
        metricsB.meanPistonSpeedMps,
      ),
    },
    {
      label: "Clearance volume",
      a: `${formatRounded(metricsA.clearanceVolumeCc, 1)} cc`,
      b: `${formatRounded(metricsB.clearanceVolumeCc, 1)} cc`,
      difference: percentDifference(
        metricsA.clearanceVolumeCc,
        metricsB.clearanceVolumeCc,
      ),
    },
    {
      label: "Clearance height (TDC)",
      a: lengthForDisplay(metricsA.clearanceHeightMm, displayUnit),
      b: lengthForDisplay(metricsB.clearanceHeightMm, displayUnit),
      difference: percentDifference(
        metricsA.clearanceHeightMm,
        metricsB.clearanceHeightMm,
      ),
    },
    {
      label: "Current crank angle",
      a: sharedAngleDeg,
      b: sharedAngleDeg,
      // Both engines share one crank angle by definition — not a per-engine
      // comparison, so no percentage (a real "0.0%" here would misleadingly
      // suggest this happens to match rather than can never differ).
      difference: "—",
    },
    {
      label: "Piston-to-head distance",
      a: lengthRangeForDisplay(
        metricsA.pistonToHeadMinMm,
        metricsA.pistonToHeadMaxMm,
        displayUnit,
      ),
      b: lengthRangeForDisplay(
        metricsB.pistonToHeadMinMm,
        metricsB.pistonToHeadMaxMm,
        displayUnit,
      ),
      // A min-max range, not a single scalar — no one percentage applies.
      difference: "—",
    },
    {
      label: "Piston displacement from TDC",
      a: lengthForDisplay(metricsA.mechanism.pistonDisplacementMm, displayUnit),
      b: lengthForDisplay(metricsB.mechanism.pistonDisplacementMm, displayUnit),
      difference: percentDifference(
        metricsA.mechanism.pistonDisplacementMm,
        metricsB.mechanism.pistonDisplacementMm,
      ),
    },
    {
      label: "Current piston-to-head distance",
      a: lengthForDisplay(metricsA.pistonToHeadCurrentMm, displayUnit),
      b: lengthForDisplay(metricsB.pistonToHeadCurrentMm, displayUnit),
      difference: percentDifference(
        metricsA.pistonToHeadCurrentMm,
        metricsB.pistonToHeadCurrentMm,
      ),
    },
    {
      label: "Connecting-rod angle",
      a: `${formatRounded(radToDeg(metricsA.mechanism.rodAngleRad), 1)}°`,
      b: `${formatRounded(radToDeg(metricsB.mechanism.rodAngleRad), 1)}°`,
      difference: percentDifference(
        radToDeg(metricsA.mechanism.rodAngleRad),
        radToDeg(metricsB.mechanism.rodAngleRad),
      ),
    },
  ];

  return (
    <section className={styles.wrapper} aria-label="Engine comparison">
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className={styles.caption}>
            Calculated results, engine A vs. engine B
          </caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Engine A</th>
              <th scope="col">Engine B</th>
              <th scope="col">Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.a}</td>
                <td>{row.b}</td>
                <td className={styles.difference}>{row.difference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.descriptions}>
        <p className={styles.description} data-testid="mechanism-description-a">
          <strong className={styles.descriptionLabel}>Engine A. </strong>
          {describeMechanism(metricsA.mechanism, displayUnit)}
        </p>
        <p className={styles.description} data-testid="mechanism-description-b">
          <strong className={styles.descriptionLabel}>Engine B. </strong>
          {describeMechanism(metricsB.mechanism, displayUnit)}
        </p>
      </div>
    </section>
  );
}
