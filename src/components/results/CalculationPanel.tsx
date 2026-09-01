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
import {
  createEngineLayout,
  visibleCylinderCount,
} from "../../engine/engineLayout";
import {
  calculateChamberDisplacementCc,
  calculateKFactor,
  calculateRotaryEngineDisplacementCc,
} from "../../engine/rotaryCalculations";
import { radToDeg } from "../../engine/units";
import {
  classifyBoreStrokeRatio,
  formatRounded,
  formatRpm,
} from "../shared/formatting";
import {
  resolveSlotConfig,
  resolveSlotFamily,
  resolveSlotRotaryConfig,
  resolveSlotRotorCount,
} from "../shared/configSlot";
import type { ConfigSlot } from "../shared/configSlot";
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
import styles from "./CalculationPanel.module.css";

interface ResultRow {
  id: string;
  label: string;
  value: string;
}

/**
 * A rotary slot's results (§27): chamber displacement, engine displacement
 * (gated on rotor count > 1, mirroring the piston panel's cylinder-count
 * gate below), K-factor, compression ratio, redline, and peak output for a
 * matched preset. There is no rotary equivalent of bore/stroke/rod ratios,
 * piston speeds, clearance-height-as-a-gap, or any crank-angle row — a
 * rotary has no piston and no single crank angle to report a position
 * against in this codebase yet (its "shaft angle" already IS the readout the
 * scrub slider and the current-crank-angle row would otherwise duplicate),
 * so those piston-only rows are simply absent rather than shown as "—".
 */
function rotaryResultsFor(
  rotaryConfig: ReturnType<typeof resolveSlotRotaryConfig>,
  rotorCount: ReturnType<typeof resolveSlotRotorCount>,
): ResultRow[] {
  const chamberDisplacementCc = calculateChamberDisplacementCc(rotaryConfig);
  const kFactor = calculateKFactor(rotaryConfig);
  const output = matchingRotaryPresetOutput(rotaryConfig);

  return [
    {
      id: "chamberDisplacement",
      label: "Chamber displacement",
      value: `${formatRounded(chamberDisplacementCc, 1)} cc`,
    },
    ...(rotorCount > 1
      ? [
          {
            id: "engineDisplacement",
            label: "Engine displacement",
            value: `${formatRounded(
              calculateRotaryEngineDisplacementCc(rotaryConfig, rotorCount),
              1,
            )} cc`,
          },
        ]
      : []),
    {
      id: "kFactor",
      label: "K-factor",
      value: `${formatRounded(kFactor, 2)}:1`,
    },
    {
      id: "compressionRatio",
      label: "Compression ratio",
      value: `${formatRounded(rotaryConfig.compressionRatio, 1)}:1`,
    },
    {
      id: "redline",
      label: "Redline",
      value: formatRpm(rotaryConfig.redlineRpm),
    },
    {
      id: "peakPower",
      label: "Peak power",
      value: peakOutputForDisplay(output?.powerHp, "hp", output?.powerRpm),
    },
    {
      id: "peakTorque",
      label: "Peak torque",
      value: peakOutputForDisplay(
        output?.torqueLbFt,
        "lb-ft",
        output?.torqueRpm,
      ),
    },
  ];
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
 *
 * Each row's label doubles as a trigger that expands an inline explainer
 * (from `METRIC_INFO`) directly beneath that row — see
 * `useMetricInfoToggle` for the open/close/Escape behavior shared with
 * `ComparisonTable`.
 */
export function CalculationPanel({ slot = "primary" }: CalculationPanelProps) {
  const engineFamily = useEngineStore((state) => state.engineFamily);
  const comparisonEngineFamily = useEngineStore(
    (state) => state.comparisonEngineFamily,
  );
  const slotFamily = resolveSlotFamily(
    slot,
    engineFamily,
    comparisonEngineFamily,
  );
  const rotaryConfig = useEngineStore((state) => state.rotaryConfig);
  const comparisonRotaryConfig = useEngineStore(
    (state) => state.comparisonRotaryConfig,
  );
  const slotRotaryConfig = resolveSlotRotaryConfig(
    slot,
    rotaryConfig,
    comparisonRotaryConfig,
  );
  const rotaryRotorCount = useEngineStore((state) => state.rotaryRotorCount);
  const comparisonRotaryRotorCount = useEngineStore(
    (state) => state.comparisonRotaryRotorCount,
  );
  const slotRotorCount = resolveSlotRotorCount(
    slot,
    rotaryRotorCount,
    comparisonRotaryRotorCount,
  );

  const config = useEngineStore((state) => state.config);
  const comparisonConfig = useEngineStore((state) => state.comparisonConfig);
  const slotConfig = resolveSlotConfig(slot, config, comparisonConfig);
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
  // The engine's cylinder count is a property of its layout (§24a), not a
  // store field of its own: a V8 has eight because `v8-cross` has eight. What
  // is *shown* is then filtered by the cylinder-view preference through the
  // engine layer's own helper — the same one the scene uses — so the total
  // displacement below always describes exactly what is on stage.
  const slotCylinderCount = visibleCylinderCount(
    createEngineLayout(slot === "comparison" ? comparisonLayoutId : layoutId),
    slot === "comparison" ? comparisonSingleCylinderView : singleCylinderView,
  );
  const rpm = useEngineStore((state) => state.rpm);
  const crankAngleRad = useEngineStore((state) => state.crankAngleRad);
  const displayUnit = useEngineStore((state) => state.preferences.displayUnit);

  const { openMetricId, toggleMetric } = useMetricInfoToggle();
  const basePanelId = useId();

  const results: ResultRow[] =
    slotFamily === "rotary"
      ? rotaryResultsFor(slotRotaryConfig, slotRotorCount)
      : pistonResultsFor();

  function pistonResultsFor(): ResultRow[] {
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
    const slotOutput = matchingPresetOutput(slotConfig);

    return [
      {
        id: "cylinderDisplacement",
        label: "Cylinder displacement",
        value: `${formatRounded(displacementCc, 1)} cc`,
      },
      // Engine displacement (per-cylinder cc times visible cylinder count) is
      // only a distinct figure once there is more than one cylinder on stage;
      // with exactly one it would equal the row above, so it's left out
      // rather than shown as pure duplication (§24a) — see this metric's
      // METRIC_INFO_BY_ID entry for what the total means.
      ...(slotCylinderCount > 1
        ? [
            {
              id: "engineDisplacement",
              label: "Engine displacement",
              value: `${formatRounded(displacementCc * slotCylinderCount, 1)} cc`,
            },
          ]
        : []),
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
        // Compression ratio is what produces the two rows below it (clearance
        // volume, then clearance height) — grouped here, right above them,
        // rather than with bore-to-stroke/rod-to-stroke above, so the ratio
        // and the two figures it implies read as one sequence: ratio, the
        // volume it implies, the height at TDC that volume implies. Like
        // redline below, this is an input value rather than a derived one,
        // but the panel already shows redline this way, so this is consistent
        // with existing precedent rather than a new category of row.
        id: "compressionRatio",
        label: "Compression ratio",
        value: `${formatRounded(slotConfig.compressionRatio, 1)}:1`,
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
      {
        // Whole-engine figures (all cylinders), unlike every other row above —
        // see this metric's METRIC_INFO_BY_ID entry, which says so plainly.
        // "—" when the current geometry matches no preset with published
        // output, same convention as every other preset-derived value here.
        id: "peakPower",
        label: "Peak power",
        value: peakOutputForDisplay(
          slotOutput?.powerHp,
          "hp",
          slotOutput?.powerRpm,
        ),
      },
      {
        id: "peakTorque",
        label: "Peak torque",
        value: peakOutputForDisplay(
          slotOutput?.torqueLbFt,
          "lb-ft",
          slotOutput?.torqueRpm,
        ),
      },
    ];
  }

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
