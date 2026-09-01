import { Fragment, useId } from "react";
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
  createEngineLayout,
  visibleCylinderCount,
} from "../../engine/engineLayout";
import type { CrankMechanismConfig, MechanismState } from "../../engine/types";
import {
  classifyBoreStrokeRatio,
  formatRounded,
  formatRpm,
} from "../shared/formatting";
import {
  METRIC_INFO_BY_ID,
  lengthForDisplay,
  lengthRangeForDisplay,
  matchingPresetOutput,
  peakOutputForDisplay,
} from "../shared/calculationFormatting";
import { useMetricInfoToggle } from "../shared/useMetricInfoToggle";
import { MetricLabelButton } from "../shared/MetricLabelButton";
import styles from "./ComparisonTable.module.css";

interface EngineMetrics {
  mechanism: MechanismState;
  displacementCc: number;
  boreStrokeRatio: number;
  rodStrokeRatio: number;
  meanPistonSpeedMps: number;
  meanPistonSpeedAtRedlineMps: number;
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
    meanPistonSpeedAtRedlineMps: calculateMeanPistonSpeedMps(
      config.strokeMm,
      config.redlineRpm,
    ),
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
  id: string;
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
 *
 * Each row's label doubles as a trigger that expands an inline explainer
 * row (from `METRIC_INFO`) — see `useMetricInfoToggle`, shared with
 * `CalculationPanel`.
 *
 * Engine B's own speed and angle (`comparisonRpm`, `comparisonCrankAngleRad`)
 * only diverge from engine A's while `rpmLinked` is false; every rpm- or
 * angle-derived column (mean piston speed, current crank angle, piston
 * displacement, piston-to-head distance, rod angle) resolves B's effective
 * rpm/angle once, up front, rather than assuming a shared `rpm`/
 * `crankAngleRad` the way an earlier version of this table did.
 */
export function ComparisonTable() {
  const config = useEngineStore((state) => state.config);
  const comparisonConfig = useEngineStore((state) => state.comparisonConfig);
  const layoutId = useEngineStore((state) => state.layoutId);
  const comparisonLayoutId = useEngineStore(
    (state) => state.comparisonLayoutId,
  );
  const singleCylinderView = useEngineStore(
    (state) => state.singleCylinderView,
  );
  const comparisonSingleCylinderView = useEngineStore(
    (state) => state.comparisonSingleCylinderView,
  );
  const rpm = useEngineStore((state) => state.rpm);
  const comparisonRpm = useEngineStore((state) => state.comparisonRpm);
  const rpmLinked = useEngineStore((state) => state.rpmLinked);
  const crankAngleRad = useEngineStore((state) => state.crankAngleRad);
  const comparisonCrankAngleRad = useEngineStore(
    (state) => state.comparisonCrankAngleRad,
  );
  const displayUnit = useEngineStore((state) => state.preferences.displayUnit);

  const { openMetricId, toggleMetric } = useMetricInfoToggle();
  const basePanelId = useId();

  // This table is only ever mounted by App.tsx while comparisonConfig is
  // set; the fallback to `config` just keeps it crash-proof if that ever
  // changes, rather than reading from a slot that doesn't exist yet.
  const configB = comparisonConfig ?? config;

  // Engine B only has an independent speed/angle while unlinked — while
  // linked the store (and the animation loop) keep both exactly equal to
  // engine A's, so reading `rpm`/`crankAngleRad` for B too is correct, not
  // just a convenient default.
  const rpmB = rpmLinked ? rpm : comparisonRpm;
  const angleRadB = rpmLinked ? crankAngleRad : comparisonCrankAngleRad;

  const metricsA = computeMetrics(config, rpm, crankAngleRad);
  const metricsB = computeMetrics(configB, rpmB, angleRadB);
  const outputA = matchingPresetOutput(config);
  const outputB = matchingPresetOutput(configB);

  const angleDegA = `${formatRounded(radToDeg(crankAngleRad), 1)}°`;
  const angleDegB = `${formatRounded(radToDeg(angleRadB), 1)}°`;

  // Cylinder count comes from each side's own layout (§24a) — a V8 has eight
  // because `v8-cross` has eight — never from a separately stored number, and
  // then filtered by that side's own cylinder-view preference through the
  // engine layer's own helper, so each side's total describes exactly what
  // is on stage for that side.
  const cylinderCountA = visibleCylinderCount(
    createEngineLayout(layoutId),
    singleCylinderView,
  );
  const cylinderCountB = visibleCylinderCount(
    createEngineLayout(comparisonLayoutId),
    comparisonSingleCylinderView,
  );
  const engineDisplacementCcA = metricsA.displacementCc * cylinderCountA;
  const engineDisplacementCcB = metricsB.displacementCc * cylinderCountB;
  // Engine displacement only says something beyond cylinder displacement
  // once at least one side has more than one cylinder on stage; with both
  // sides single-cylinder the row would just repeat the row above it, so it
  // is left out rather than shown as pure duplication. The moment either
  // side is multi-cylinder, though, the row is exactly the comparison being
  // made (e.g. a 4-cylinder's smaller total vs. a 6-cylinder's larger one)
  // and must appear even though the other side's own total still equals its
  // cylinder figure.
  const showEngineDisplacement = cylinderCountA > 1 || cylinderCountB > 1;

  const rows: TableRow[] = [
    {
      id: "cylinderDisplacement",
      label: "Cylinder displacement",
      a: `${formatRounded(metricsA.displacementCc, 1)} cc`,
      b: `${formatRounded(metricsB.displacementCc, 1)} cc`,
      difference: percentDifference(
        metricsA.displacementCc,
        metricsB.displacementCc,
      ),
    },
    ...(showEngineDisplacement
      ? [
          {
            id: "engineDisplacement",
            label: "Engine displacement",
            a: `${formatRounded(engineDisplacementCcA, 1)} cc`,
            b: `${formatRounded(engineDisplacementCcB, 1)} cc`,
            // Unlike every row above, this difference is computed on each
            // side's own total (per-cylinder cc times that side's own
            // visible cylinder count) — the whole point of this row's
            // existence is to compare the two engines' actual swept
            // volumes, not their per-cylinder geometry a second time.
            difference: percentDifference(
              engineDisplacementCcA,
              engineDisplacementCcB,
            ),
          },
        ]
      : []),
    {
      id: "boreStrokeRatio",
      label: "Bore-to-stroke ratio",
      a: `${formatRounded(metricsA.boreStrokeRatio, 2)}:1 · ${classifyBoreStrokeRatio(metricsA.boreStrokeRatio)}`,
      b: `${formatRounded(metricsB.boreStrokeRatio, 2)}:1 · ${classifyBoreStrokeRatio(metricsB.boreStrokeRatio)}`,
      // The classification label is descriptive, not numeric — the percent
      // difference still comes from the underlying numeric ratio alone.
      difference: percentDifference(
        metricsA.boreStrokeRatio,
        metricsB.boreStrokeRatio,
      ),
    },
    {
      id: "rodStrokeRatio",
      label: "Rod-to-stroke ratio",
      a: `${formatRounded(metricsA.rodStrokeRatio, 2)}:1`,
      b: `${formatRounded(metricsB.rodStrokeRatio, 2)}:1`,
      difference: percentDifference(
        metricsA.rodStrokeRatio,
        metricsB.rodStrokeRatio,
      ),
    },
    {
      id: "redline",
      label: "Redline",
      a: formatRpm(config.redlineRpm),
      b: formatRpm(configB.redlineRpm),
      difference: percentDifference(config.redlineRpm, configB.redlineRpm),
    },
    {
      id: "meanPistonSpeed",
      label: "Mean piston speed",
      a: `${formatRounded(metricsA.meanPistonSpeedMps, 2)} m/s`,
      b: `${formatRounded(metricsB.meanPistonSpeedMps, 2)} m/s`,
      difference: percentDifference(
        metricsA.meanPistonSpeedMps,
        metricsB.meanPistonSpeedMps,
      ),
    },
    {
      id: "meanPistonSpeedRedline",
      label: "Mean piston speed at redline",
      a: `${formatRounded(metricsA.meanPistonSpeedAtRedlineMps, 2)} m/s`,
      b: `${formatRounded(metricsB.meanPistonSpeedAtRedlineMps, 2)} m/s`,
      difference: percentDifference(
        metricsA.meanPistonSpeedAtRedlineMps,
        metricsB.meanPistonSpeedAtRedlineMps,
      ),
    },
    {
      id: "clearanceVolume",
      label: "Clearance volume",
      a: `${formatRounded(metricsA.clearanceVolumeCc, 1)} cc`,
      b: `${formatRounded(metricsB.clearanceVolumeCc, 1)} cc`,
      difference: percentDifference(
        metricsA.clearanceVolumeCc,
        metricsB.clearanceVolumeCc,
      ),
    },
    {
      id: "clearanceHeight",
      label: "Clearance height (TDC)",
      a: lengthForDisplay(metricsA.clearanceHeightMm, displayUnit),
      b: lengthForDisplay(metricsB.clearanceHeightMm, displayUnit),
      difference: percentDifference(
        metricsA.clearanceHeightMm,
        metricsB.clearanceHeightMm,
      ),
    },
    {
      id: "currentCrankAngle",
      label: "Current crank angle",
      a: angleDegA,
      b: angleDegB,
      // Linked engines share one crank angle by definition — not a
      // per-engine comparison, so no percentage there (a real "0.0%"
      // would misleadingly suggest this happens to match rather than can
      // never differ). Unlinked, the two angles genuinely drift apart, so
      // this is a real, meaningful difference like any other row's.
      difference: rpmLinked
        ? "—"
        : percentDifference(radToDeg(crankAngleRad), radToDeg(angleRadB)),
    },
    {
      id: "pistonToHeadRange",
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
      id: "pistonDisplacement",
      label: "Piston displacement from TDC",
      a: lengthForDisplay(metricsA.mechanism.pistonDisplacementMm, displayUnit),
      b: lengthForDisplay(metricsB.mechanism.pistonDisplacementMm, displayUnit),
      difference: percentDifference(
        metricsA.mechanism.pistonDisplacementMm,
        metricsB.mechanism.pistonDisplacementMm,
      ),
    },
    {
      id: "currentPistonToHead",
      label: "Current piston-to-head distance",
      a: lengthForDisplay(metricsA.pistonToHeadCurrentMm, displayUnit),
      b: lengthForDisplay(metricsB.pistonToHeadCurrentMm, displayUnit),
      difference: percentDifference(
        metricsA.pistonToHeadCurrentMm,
        metricsB.pistonToHeadCurrentMm,
      ),
    },
    {
      id: "rodAngle",
      label: "Connecting-rod angle",
      a: `${formatRounded(radToDeg(metricsA.mechanism.rodAngleRad), 1)}°`,
      b: `${formatRounded(radToDeg(metricsB.mechanism.rodAngleRad), 1)}°`,
      difference: percentDifference(
        radToDeg(metricsA.mechanism.rodAngleRad),
        radToDeg(metricsB.mechanism.rodAngleRad),
      ),
    },
    {
      // Whole-engine figures (all cylinders), unlike every other row above —
      // see this metric's METRIC_INFO_BY_ID entry, which says so plainly.
      // "—" on a side when that side's geometry matches no preset with
      // published output, same convention as every other preset-derived
      // value; the difference follows suit when either side is missing.
      id: "peakPower",
      label: "Peak power",
      a: peakOutputForDisplay(outputA?.powerHp, "hp", outputA?.powerRpm),
      b: peakOutputForDisplay(outputB?.powerHp, "hp", outputB?.powerRpm),
      difference:
        outputA && outputB
          ? percentDifference(outputA.powerHp, outputB.powerHp)
          : "—",
    },
    {
      id: "peakTorque",
      label: "Peak torque",
      a: peakOutputForDisplay(outputA?.torqueLbFt, "lb-ft", outputA?.torqueRpm),
      b: peakOutputForDisplay(outputB?.torqueLbFt, "lb-ft", outputB?.torqueRpm),
      difference:
        outputA && outputB
          ? percentDifference(outputA.torqueLbFt, outputB.torqueLbFt)
          : "—",
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
            {rows.map((row) => {
              const panelId = `${basePanelId}-${row.id}`;
              const isOpen = openMetricId === row.id;
              const info = METRIC_INFO_BY_ID.get(row.id);
              return (
                <Fragment key={row.id}>
                  <tr>
                    <th scope="row">
                      <MetricLabelButton
                        id={row.id}
                        label={row.label}
                        isOpen={isOpen}
                        onToggle={toggleMetric}
                        panelId={panelId}
                        className={styles.rowLabel}
                      />
                    </th>
                    <td>{row.a}</td>
                    <td>{row.b}</td>
                    <td className={styles.difference}>{row.difference}</td>
                  </tr>
                  {isOpen && info ? (
                    <tr>
                      <td className={styles.explanationCell} colSpan={4}>
                        <p className={styles.explanation} id={panelId}>
                          {info.body}
                        </p>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
