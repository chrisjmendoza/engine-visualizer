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
import {
  calculateChamberDisplacementCc,
  calculateKFactor,
  calculateRotaryEngineDisplacementCc,
} from "../../engine/rotaryCalculations";
import type { EngineFamily } from "../../engine/shareLink";
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
  matchingRotaryPresetOutput,
  peakOutputForDisplay,
} from "../shared/calculationFormatting";
import { useMetricInfoToggle } from "../shared/useMetricInfoToggle";
import { MetricLabelButton } from "../shared/MetricLabelButton";
import styles from "./ComparisonTable.module.css";

/** Shown in a family-specific column/difference cell that does not apply to that side. */
const NOT_APPLICABLE = "—";

/** A row's cell for a family-gated metric: the real value on the matching family's side, else "—". */
function familyCell(
  family: EngineFamily,
  requiredFamily: EngineFamily,
  value: string,
): string {
  return family === requiredFamily ? value : NOT_APPLICABLE;
}

/**
 * A family-gated row's difference: only meaningful when BOTH sides belong to
 * the family the row describes (comparing a real piston-only figure against
 * "—" is not a percentage of anything).
 */
function familyDifference(
  familyA: EngineFamily,
  familyB: EngineFamily,
  requiredFamily: EngineFamily,
  numA: number,
  numB: number,
): string {
  if (familyA !== requiredFamily || familyB !== requiredFamily) {
    return NOT_APPLICABLE;
  }
  return percentDifference(numA, numB);
}

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
  const familyA = useEngineStore((state) => state.engineFamily);
  const familyB = useEngineStore((state) => state.comparisonEngineFamily);
  const rotaryConfigA = useEngineStore((state) => state.rotaryConfig);
  const rotaryConfigB = useEngineStore((state) => state.comparisonRotaryConfig);
  const rotorCountA = useEngineStore((state) => state.rotaryRotorCount);
  const rotorCountB = useEngineStore(
    (state) => state.comparisonRotaryRotorCount,
  );
  const showPistonRows = familyA === "piston" || familyB === "piston";
  const showRotaryRows = familyA === "rotary" || familyB === "rotary";

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
  // Each side's peak output comes from whichever family that side actually
  // shows (§27) — a piston preset match for a piston side, a rotary preset
  // match for a rotary one — so "peak power"/"peak torque" stay meaningful
  // even in a mixed piston-vs-rotary comparison.
  const outputA =
    familyA === "rotary"
      ? matchingRotaryPresetOutput(rotaryConfigA)
      : matchingPresetOutput(config);
  const outputB =
    familyB === "rotary"
      ? matchingRotaryPresetOutput(rotaryConfigB)
      : matchingPresetOutput(configB);

  const chamberDisplacementCcA = calculateChamberDisplacementCc(rotaryConfigA);
  const chamberDisplacementCcB = calculateChamberDisplacementCc(rotaryConfigB);
  const kFactorA = calculateKFactor(rotaryConfigA);
  const kFactorB = calculateKFactor(rotaryConfigB);

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
  // Each side's engine displacement and "unit" count (cylinders for piston,
  // rotors for rotary) come from that side's own family (§27) — a shared
  // row, unlike the family-gated ones below, because both families have a
  // genuine whole-engine displacement figure and comparing them (a rotary's
  // rated cc against a piston's) is exactly the kind of comparison this
  // table exists for.
  const engineDisplacementCcA =
    familyA === "rotary"
      ? calculateRotaryEngineDisplacementCc(rotaryConfigA, rotorCountA)
      : metricsA.displacementCc * cylinderCountA;
  const engineDisplacementCcB =
    familyB === "rotary"
      ? calculateRotaryEngineDisplacementCc(rotaryConfigB, rotorCountB)
      : metricsB.displacementCc * cylinderCountB;
  const unitCountA = familyA === "rotary" ? rotorCountA : cylinderCountA;
  const unitCountB = familyB === "rotary" ? rotorCountB : cylinderCountB;
  // Engine displacement only says something beyond cylinder/chamber
  // displacement once at least one side has more than one unit (cylinder or
  // rotor) on stage; with both sides single-unit the row would just repeat
  // the row above it, so it is left out rather than shown as pure
  // duplication. The moment either side has more than one, though, the row
  // is exactly the comparison being made and must appear even though the
  // other side's own total still equals its single-unit figure.
  const showEngineDisplacement = unitCountA > 1 || unitCountB > 1;

  // Piston-only and rotary-only rows appear only when at least one side
  // actually belongs to that family (§27) — a piston-vs-piston comparison
  // therefore shows exactly the row set it always has, and a rotary-vs-rotary
  // comparison shows only the rotary set, with the piston rows never
  // cluttering the table with an all-"—" column nobody asked to see. Only a
  // genuinely mixed piston-vs-rotary comparison shows both sets side by
  // side, "—" filling the gap on whichever side that row doesn't apply to.
  const rows: TableRow[] = [
    ...(showPistonRows
      ? [
          {
            id: "cylinderDisplacement",
            label: "Cylinder displacement",
            a: familyCell(
              familyA,
              "piston",
              `${formatRounded(metricsA.displacementCc, 1)} cc`,
            ),
            b: familyCell(
              familyB,
              "piston",
              `${formatRounded(metricsB.displacementCc, 1)} cc`,
            ),
            difference: familyDifference(
              familyA,
              familyB,
              "piston",
              metricsA.displacementCc,
              metricsB.displacementCc,
            ),
          },
        ]
      : []),
    ...(showRotaryRows
      ? [
          {
            id: "chamberDisplacement",
            label: "Chamber displacement",
            a: familyCell(
              familyA,
              "rotary",
              `${formatRounded(chamberDisplacementCcA, 1)} cc`,
            ),
            b: familyCell(
              familyB,
              "rotary",
              `${formatRounded(chamberDisplacementCcB, 1)} cc`,
            ),
            difference: familyDifference(
              familyA,
              familyB,
              "rotary",
              chamberDisplacementCcA,
              chamberDisplacementCcB,
            ),
          },
        ]
      : []),
    ...(showEngineDisplacement
      ? [
          {
            id: "engineDisplacement",
            label: "Engine displacement",
            a: `${formatRounded(engineDisplacementCcA, 1)} cc`,
            b: `${formatRounded(engineDisplacementCcB, 1)} cc`,
            // Unlike the family-gated rows above, this is a shared row: both
            // families have a genuine whole-engine displacement, computed by
            // each side's own convention (cylinder count for piston, rotor
            // count for rotary — see this metric's METRIC_INFO_BY_ID entry
            // for the rotary convention's own controversy), so the
            // difference is real even across a mixed comparison.
            difference: percentDifference(
              engineDisplacementCcA,
              engineDisplacementCcB,
            ),
          },
        ]
      : []),
    ...(showPistonRows
      ? [
          {
            id: "boreStrokeRatio",
            label: "Bore-to-stroke ratio",
            a: familyCell(
              familyA,
              "piston",
              `${formatRounded(metricsA.boreStrokeRatio, 2)}:1 · ${classifyBoreStrokeRatio(metricsA.boreStrokeRatio)}`,
            ),
            b: familyCell(
              familyB,
              "piston",
              `${formatRounded(metricsB.boreStrokeRatio, 2)}:1 · ${classifyBoreStrokeRatio(metricsB.boreStrokeRatio)}`,
            ),
            // The classification label is descriptive, not numeric — the percent
            // difference still comes from the underlying numeric ratio alone.
            difference: familyDifference(
              familyA,
              familyB,
              "piston",
              metricsA.boreStrokeRatio,
              metricsB.boreStrokeRatio,
            ),
          },
          {
            id: "rodStrokeRatio",
            label: "Rod-to-stroke ratio",
            a: familyCell(
              familyA,
              "piston",
              `${formatRounded(metricsA.rodStrokeRatio, 2)}:1`,
            ),
            b: familyCell(
              familyB,
              "piston",
              `${formatRounded(metricsB.rodStrokeRatio, 2)}:1`,
            ),
            difference: familyDifference(
              familyA,
              familyB,
              "piston",
              metricsA.rodStrokeRatio,
              metricsB.rodStrokeRatio,
            ),
          },
        ]
      : []),
    ...(showRotaryRows
      ? [
          {
            id: "kFactor",
            label: "K-factor",
            a: familyCell(familyA, "rotary", `${formatRounded(kFactorA, 2)}:1`),
            b: familyCell(familyB, "rotary", `${formatRounded(kFactorB, 2)}:1`),
            difference: familyDifference(
              familyA,
              familyB,
              "rotary",
              kFactorA,
              kFactorB,
            ),
          },
        ]
      : []),
    {
      // Shared row (§27): both families have a rated redline (a rotary's is
      // the eccentric-shaft rpm a rotary tachometer reads), so this compares
      // meaningfully across a mixed comparison too.
      id: "redline",
      label: "Redline",
      a: formatRpm(
        familyA === "rotary" ? rotaryConfigA.redlineRpm : config.redlineRpm,
      ),
      b: formatRpm(
        familyB === "rotary" ? rotaryConfigB.redlineRpm : configB.redlineRpm,
      ),
      difference: percentDifference(
        familyA === "rotary" ? rotaryConfigA.redlineRpm : config.redlineRpm,
        familyB === "rotary" ? rotaryConfigB.redlineRpm : configB.redlineRpm,
      ),
    },
    ...(showPistonRows
      ? [
          {
            id: "meanPistonSpeed",
            label: "Mean piston speed",
            a: familyCell(
              familyA,
              "piston",
              `${formatRounded(metricsA.meanPistonSpeedMps, 2)} m/s`,
            ),
            b: familyCell(
              familyB,
              "piston",
              `${formatRounded(metricsB.meanPistonSpeedMps, 2)} m/s`,
            ),
            difference: familyDifference(
              familyA,
              familyB,
              "piston",
              metricsA.meanPistonSpeedMps,
              metricsB.meanPistonSpeedMps,
            ),
          },
          {
            id: "meanPistonSpeedRedline",
            label: "Mean piston speed at redline",
            a: familyCell(
              familyA,
              "piston",
              `${formatRounded(metricsA.meanPistonSpeedAtRedlineMps, 2)} m/s`,
            ),
            b: familyCell(
              familyB,
              "piston",
              `${formatRounded(metricsB.meanPistonSpeedAtRedlineMps, 2)} m/s`,
            ),
            difference: familyDifference(
              familyA,
              familyB,
              "piston",
              metricsA.meanPistonSpeedAtRedlineMps,
              metricsB.meanPistonSpeedAtRedlineMps,
            ),
          },
        ]
      : []),
    {
      // Shared row (§27): both families have a compression ratio, computed
      // the same way (swept volume over clearance volume), so it compares
      // meaningfully across a mixed comparison too. Grouped here, right
      // above the piston-only clearance rows it produces, exactly as it was
      // before rotary existed.
      id: "compressionRatio",
      label: "Compression ratio",
      a: `${formatRounded(
        familyA === "rotary"
          ? rotaryConfigA.compressionRatio
          : config.compressionRatio,
        1,
      )}:1`,
      b: `${formatRounded(
        familyB === "rotary"
          ? rotaryConfigB.compressionRatio
          : configB.compressionRatio,
        1,
      )}:1`,
      difference: percentDifference(
        familyA === "rotary"
          ? rotaryConfigA.compressionRatio
          : config.compressionRatio,
        familyB === "rotary"
          ? rotaryConfigB.compressionRatio
          : configB.compressionRatio,
      ),
    },
    ...(showPistonRows
      ? [
          {
            id: "clearanceVolume",
            label: "Clearance volume",
            a: familyCell(
              familyA,
              "piston",
              `${formatRounded(metricsA.clearanceVolumeCc, 1)} cc`,
            ),
            b: familyCell(
              familyB,
              "piston",
              `${formatRounded(metricsB.clearanceVolumeCc, 1)} cc`,
            ),
            difference: familyDifference(
              familyA,
              familyB,
              "piston",
              metricsA.clearanceVolumeCc,
              metricsB.clearanceVolumeCc,
            ),
          },
          {
            id: "clearanceHeight",
            label: "Clearance height (TDC)",
            a: familyCell(
              familyA,
              "piston",
              lengthForDisplay(metricsA.clearanceHeightMm, displayUnit),
            ),
            b: familyCell(
              familyB,
              "piston",
              lengthForDisplay(metricsB.clearanceHeightMm, displayUnit),
            ),
            difference: familyDifference(
              familyA,
              familyB,
              "piston",
              metricsA.clearanceHeightMm,
              metricsB.clearanceHeightMm,
            ),
          },
          {
            id: "currentCrankAngle",
            label: "Current crank angle",
            a: familyCell(familyA, "piston", angleDegA),
            b: familyCell(familyB, "piston", angleDegB),
            // Linked engines share one crank angle by definition — not a
            // per-engine comparison, so no percentage there (a real "0.0%"
            // would misleadingly suggest this happens to match rather than can
            // never differ). Unlinked, the two angles genuinely drift apart, so
            // this is a real, meaningful difference like any other row's.
            difference:
              familyA !== "piston" || familyB !== "piston"
                ? NOT_APPLICABLE
                : rpmLinked
                  ? NOT_APPLICABLE
                  : percentDifference(
                      radToDeg(crankAngleRad),
                      radToDeg(angleRadB),
                    ),
          },
          {
            id: "pistonToHeadRange",
            label: "Piston-to-head distance",
            a: familyCell(
              familyA,
              "piston",
              lengthRangeForDisplay(
                metricsA.pistonToHeadMinMm,
                metricsA.pistonToHeadMaxMm,
                displayUnit,
              ),
            ),
            b: familyCell(
              familyB,
              "piston",
              lengthRangeForDisplay(
                metricsB.pistonToHeadMinMm,
                metricsB.pistonToHeadMaxMm,
                displayUnit,
              ),
            ),
            // A min-max range, not a single scalar — no one percentage applies.
            difference: NOT_APPLICABLE,
          },
          {
            id: "pistonDisplacement",
            label: "Piston displacement from TDC",
            a: familyCell(
              familyA,
              "piston",
              lengthForDisplay(
                metricsA.mechanism.pistonDisplacementMm,
                displayUnit,
              ),
            ),
            b: familyCell(
              familyB,
              "piston",
              lengthForDisplay(
                metricsB.mechanism.pistonDisplacementMm,
                displayUnit,
              ),
            ),
            difference: familyDifference(
              familyA,
              familyB,
              "piston",
              metricsA.mechanism.pistonDisplacementMm,
              metricsB.mechanism.pistonDisplacementMm,
            ),
          },
          {
            id: "currentPistonToHead",
            label: "Current piston-to-head distance",
            a: familyCell(
              familyA,
              "piston",
              lengthForDisplay(metricsA.pistonToHeadCurrentMm, displayUnit),
            ),
            b: familyCell(
              familyB,
              "piston",
              lengthForDisplay(metricsB.pistonToHeadCurrentMm, displayUnit),
            ),
            difference: familyDifference(
              familyA,
              familyB,
              "piston",
              metricsA.pistonToHeadCurrentMm,
              metricsB.pistonToHeadCurrentMm,
            ),
          },
        ]
      : []),
    ...(showPistonRows
      ? [
          {
            id: "rodAngle",
            label: "Connecting-rod angle",
            a: familyCell(
              familyA,
              "piston",
              `${formatRounded(radToDeg(metricsA.mechanism.rodAngleRad), 1)}°`,
            ),
            b: familyCell(
              familyB,
              "piston",
              `${formatRounded(radToDeg(metricsB.mechanism.rodAngleRad), 1)}°`,
            ),
            difference: familyDifference(
              familyA,
              familyB,
              "piston",
              radToDeg(metricsA.mechanism.rodAngleRad),
              radToDeg(metricsB.mechanism.rodAngleRad),
            ),
          },
        ]
      : []),
    {
      // Whole-engine figures (all cylinders/rotors), unlike every family-gated
      // row above — see this metric's METRIC_INFO_BY_ID entry, which says so
      // plainly. A shared row (§27): `outputA`/`outputB` already resolve to
      // each side's own family's preset match, so this compares meaningfully
      // across a mixed comparison too. "—" on a side when that side's
      // geometry matches no preset with published output, same convention as
      // every other preset-derived value; the difference follows suit when
      // either side is missing.
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
          : NOT_APPLICABLE,
    },
    {
      id: "peakTorque",
      label: "Peak torque",
      a: peakOutputForDisplay(outputA?.torqueLbFt, "lb-ft", outputA?.torqueRpm),
      b: peakOutputForDisplay(outputB?.torqueLbFt, "lb-ft", outputB?.torqueRpm),
      difference:
        outputA && outputB
          ? percentDifference(outputA.torqueLbFt, outputB.torqueLbFt)
          : NOT_APPLICABLE,
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
