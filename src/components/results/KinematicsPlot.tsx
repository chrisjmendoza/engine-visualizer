import { useMemo } from "react";
import { useEngineStore } from "../../state/engineStore";
import {
  calculateMechanismState,
  calculatePistonAccelerationMmPerRad2,
  calculatePistonVelocityMmPerRad,
} from "../../engine/kinematics";
import {
  calculatePistonAccelerationMps2,
  calculatePistonVelocityMps,
} from "../../engine/calculations";
import { normalizeAngleRad } from "../../engine/units";
import { TWO_PI } from "../../engine/constants";
import type { CrankMechanismConfig, DisplayUnit } from "../../engine/types";
import { formatRounded } from "../shared/formatting";
import { lengthForDisplay } from "../shared/calculationFormatting";
import styles from "./KinematicsPlot.module.css";

/**
 * Samples per curve across one full revolution, inclusive of both ends, so
 * index i is exactly crank angle 2i degrees and the last sample closes the
 * loop back onto the first. 181 points is comfortably past the resolution of
 * a panel-width strip while staying cheap enough to recompute synchronously
 * whenever a configuration changes.
 */
const SAMPLE_COUNT = 181;

/**
 * The plot's user-space box: one unit per crank degree horizontally, so an
 * x coordinate *is* an angle in degrees. `preserveAspectRatio="none"` lets
 * the strip stretch to the panel's width, and every stroke carries
 * `vectorEffect="non-scaling-stroke"` so that stretch never thickens or
 * thins a line.
 */
const PLOT_WIDTH = 360;
const PLOT_HEIGHT = 100;
/** Vertical breathing room so a peak's stroke is not clipped by the edge. */
const PLOT_PADDING_Y = 8;

/** Quarter-revolution gridlines, the angles worth reading a curve against. */
const GRIDLINE_DEGREES = [90, 180, 270];

interface CurveSamples {
  displacementMm: number[];
  velocityMmPerRad: number[];
  accelerationMmPerRad2: number[];
}

/**
 * One engine's three curves over a revolution, in canonical units. The two
 * derivatives stay in the crank-angle domain (per radian, per radian
 * squared) — they are pure geometry there, so these samples survive an rpm
 * change untouched and only the peak *labels* need recomputing.
 */
function sampleCurves(config: CrankMechanismConfig): CurveSamples {
  const displacementMm: number[] = [];
  const velocityMmPerRad: number[] = [];
  const accelerationMmPerRad2: number[] = [];

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const theta = (i / (SAMPLE_COUNT - 1)) * TWO_PI;
    displacementMm.push(
      calculateMechanismState(config, theta).pistonDisplacementMm,
    );
    velocityMmPerRad.push(calculatePistonVelocityMmPerRad(config, theta));
    accelerationMmPerRad2.push(
      calculatePistonAccelerationMmPerRad2(config, theta),
    );
  }

  return { displacementMm, velocityMmPerRad, accelerationMmPerRad2 };
}

/**
 * Decimals that keep a peak readable across the range these quantities
 * actually span — a 2.21 m/s² idle figure and a 22,080 m/s² redline figure
 * both come out of the same label.
 */
function formatPeakMagnitude(value: number): string {
  const magnitude = Math.abs(value);
  const decimals = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2;
  return formatRounded(value, decimals);
}

interface StripDefinition {
  id: string;
  label: string;
  select: (samples: CurveSamples) => number[];
  /** Peak magnitude in real, time-domain units at a given engine speed. */
  formatPeak: (peak: number, rpm: number, unit: DisplayUnit) => string;
}

/**
 * Three stacked strips rather than one combined plot: position, velocity,
 * and acceleration differ by orders of magnitude *and* by unit, so a single
 * shared vertical axis would flatten two of them into the baseline. Each
 * strip is scaled to its own quantity's range and states its peak in real
 * units, which is where the magnitudes get compared.
 */
const STRIPS: StripDefinition[] = [
  {
    id: "position",
    label: "Position",
    select: (samples) => samples.displacementMm,
    // Position is already a length in canonical units, so it follows the
    // mm/in display preference like every other length in the panel;
    // velocity and acceleration stay in SI, matching "mean piston speed".
    formatPeak: (peak, _rpm, unit) => lengthForDisplay(peak, unit),
  },
  {
    id: "velocity",
    label: "Velocity",
    select: (samples) => samples.velocityMmPerRad,
    formatPeak: (peak, rpm) =>
      `${formatPeakMagnitude(calculatePistonVelocityMps(peak, rpm))} m/s`,
  },
  {
    id: "acceleration",
    label: "Acceleration",
    select: (samples) => samples.accelerationMmPerRad2,
    formatPeak: (peak, rpm) =>
      `${formatPeakMagnitude(calculatePistonAccelerationMps2(peak, rpm))} m/s²`,
  },
];

type EngineKey = "a" | "b";

const ENGINE_LABELS: Record<EngineKey, string> = {
  a: "Engine A",
  b: "Engine B",
};

/** Maps a sampled value to a y coordinate within the strip's own range. */
function yFor(value: number, min: number, max: number): number {
  const span = max - min || 1;
  const usableHeight = PLOT_HEIGHT - 2 * PLOT_PADDING_Y;
  return PLOT_PADDING_Y + ((max - value) / span) * usableHeight;
}

function buildPath(values: number[], min: number, max: number): string {
  return values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * PLOT_WIDTH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${yFor(value, min, max).toFixed(2)}`;
    })
    .join(" ");
}

/** The largest-magnitude sample, signed — a curve's headline number. */
function peakOf(values: number[]): number {
  return values.reduce(
    (best, value) => (Math.abs(value) > Math.abs(best) ? value : best),
    0,
  );
}

interface StripGeometry {
  definition: StripDefinition;
  zeroY: number;
  curves: { key: EngineKey; path: string; peak: number }[];
}

/**
 * Everything about a strip that depends on geometry alone: the path
 * strings, where zero falls, and each curve's peak. Split out from the
 * component so it can sit behind one memo — rebuilding 181-point path
 * strings on every ~10 Hz cursor tick would be exactly the per-frame work
 * §11's design goes to such lengths to avoid, just moved into the render.
 *
 * A strip's vertical scale spans *both* engines' values, which is what keeps
 * two overlaid curves honest about their relative magnitude.
 */
function buildStripGeometry(
  engines: { key: EngineKey; samples: CurveSamples }[],
): StripGeometry[] {
  return STRIPS.map((definition) => {
    const perEngine = engines.map((engine) => ({
      key: engine.key,
      values: definition.select(engine.samples),
    }));
    const allValues = perEngine.flatMap((engine) => engine.values);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    return {
      definition,
      zeroY: yFor(0, min, max),
      curves: perEngine.map((engine) => ({
        key: engine.key,
        path: buildPath(engine.values, min, max),
        peak: peakOf(engine.values),
      })),
    };
  });
}

/**
 * Crank angle to the strip's x coordinate, which is degrees by
 * construction. The angle arrives unwrapped from the animation loop (it only
 * ever grows), so it is folded back into one revolution first. Rounding to
 * two decimals is deliberate: it is finer than any pixel this strip will be
 * drawn at, and it keeps floating-point dust ("90.00000000000001") out of
 * the rendered attribute.
 */
function xForAngle(crankAngleRad: number): number {
  const degrees = (normalizeAngleRad(crankAngleRad) / TWO_PI) * PLOT_WIDTH;
  return Number(degrees.toFixed(2));
}

/**
 * Piston position, velocity, and acceleration across one crank revolution
 * (TECHNICAL_DESIGN.md §9.4 and its first two derivatives, §15). Hand-rolled
 * SVG rather than a charting library: three sparkline strips need a path
 * string and a couple of lines, which is not worth the bundle weight §18
 * budgets so carefully.
 *
 * **What the shapes are for.** A piston does not move sinusoidally, and
 * these curves are where that stops being a claim: velocity peaks before
 * 90°, and acceleration is markedly larger at TDC than at BDC. Both effects
 * are rod angularity, and both grow as the rod-to-stroke ratio shrinks —
 * which is exactly what comparison mode overlays.
 *
 * **Scaling.** Each strip is scaled to its own quantity's range across
 * *both* engines, not per engine. Normalizing each curve to its own peak
 * would make two engines' curves overlay at the same amplitude no matter how
 * far apart their real numbers were, hiding the magnitude difference while
 * showing the shape one; a shared per-strip scale keeps both readable, and
 * the peak labels carry the absolute values.
 *
 * **Updating.** The curves are memoized per config, so playback does not
 * recompute them. The cursor reads `crankAngleRad` from the store — the
 * throttled ~10 Hz mirror the animation loop already writes (§11) — and is a
 * single x coordinate derived from it. This component never touches the
 * frame loop and holds no per-frame state; a cursor stepping at the readout
 * rate is smooth enough, and buying 60 fps here would cost the render budget
 * the whole store-mirroring design exists to protect.
 */
export function KinematicsPlot() {
  const config = useEngineStore((state) => state.config);
  const comparisonConfig = useEngineStore((state) => state.comparisonConfig);
  const rpm = useEngineStore((state) => state.rpm);
  const comparisonRpm = useEngineStore((state) => state.comparisonRpm);
  const rpmLinked = useEngineStore((state) => state.rpmLinked);
  const crankAngleRad = useEngineStore((state) => state.crankAngleRad);
  const comparisonCrankAngleRad = useEngineStore(
    (state) => state.comparisonCrankAngleRad,
  );
  const displayUnit = useEngineStore((state) => state.preferences.displayUnit);

  const samplesA = useMemo(() => sampleCurves(config), [config]);
  const samplesB = useMemo(
    () => (comparisonConfig ? sampleCurves(comparisonConfig) : null),
    [comparisonConfig],
  );

  const strips = useMemo(() => {
    const engines: { key: EngineKey; samples: CurveSamples }[] = [
      { key: "a", samples: samplesA },
    ];
    if (samplesB) {
      engines.push({ key: "b", samples: samplesB });
    }
    return buildStripGeometry(engines);
  }, [samplesA, samplesB]);

  const isComparing = samplesB !== null;
  const engineKeys: EngineKey[] = isComparing ? ["a", "b"] : ["a"];

  // Engine B only has its own speed and angle while unlinked; linked, the
  // store keeps both exactly equal to engine A's, so reading A's is correct
  // rather than merely convenient — the same resolution `ComparisonTable`
  // makes.
  const rpmByEngine: Record<EngineKey, number> = {
    a: rpm,
    b: rpmLinked ? rpm : comparisonRpm,
  };

  const cursors: { key: EngineKey; crankAngleRad: number }[] = [
    { key: "a", crankAngleRad },
  ];
  if (isComparing && !rpmLinked) {
    cursors.push({ key: "b", crankAngleRad: comparisonCrankAngleRad });
  }

  return (
    <details className={styles.panel} open>
      <summary className={styles.summary}>Kinematic curves</summary>

      <p className={styles.caption}>
        One crank revolution, 0° (TDC) to 360°. Each strip is scaled to its own
        range; peaks are shown in real units at the current engine speed.
      </p>

      {isComparing ? (
        <ul className={styles.legend}>
          {engineKeys.map((key) => (
            <li className={styles.legendItem} key={key}>
              <span
                className={styles.swatch}
                data-engine={key}
                aria-hidden="true"
              />
              {ENGINE_LABELS[key]}
            </li>
          ))}
        </ul>
      ) : null}

      {strips.map((strip) => {
        // Formatting is all that is left to do per render: the peak values
        // themselves came out of the memo above, and only their units depend
        // on rpm and the display preference.
        const peakSummary = strip.curves.map((curve) => {
          const text = strip.definition.formatPeak(
            curve.peak,
            rpmByEngine[curve.key],
            displayUnit,
          );
          return isComparing ? `${curve.key.toUpperCase()} ${text}` : text;
        });

        return (
          <section className={styles.strip} key={strip.definition.id}>
            <div className={styles.stripHeader}>
              <h3 className={styles.stripLabel}>{strip.definition.label}</h3>
              <p className={styles.stripPeak}>peak {peakSummary.join(" · ")}</p>
            </div>
            <svg
              className={styles.chart}
              viewBox={`0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${strip.definition.label} against crank angle over one revolution. Peak ${peakSummary.join(", ")}.`}
              data-strip={strip.definition.id}
            >
              {GRIDLINE_DEGREES.map((degrees) => (
                <line
                  className={styles.gridline}
                  key={degrees}
                  x1={degrees}
                  y1={0}
                  x2={degrees}
                  y2={PLOT_HEIGHT}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {/*
               * The zero line sits wherever zero falls in this strip's own
               * range, not at mid-height — which is the point for
               * acceleration, whose TDC peak genuinely outruns its BDC one.
               */}
              <line
                className={styles.zeroLine}
                x1={0}
                y1={strip.zeroY}
                x2={PLOT_WIDTH}
                y2={strip.zeroY}
                vectorEffect="non-scaling-stroke"
              />
              {strip.curves.map((curve) => (
                <path
                  className={styles.curve}
                  key={curve.key}
                  data-engine={curve.key}
                  d={curve.path}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {cursors.map((cursor) => (
                <line
                  className={styles.cursor}
                  key={cursor.key}
                  data-engine={cursor.key}
                  x1={xForAngle(cursor.crankAngleRad)}
                  y1={0}
                  x2={xForAngle(cursor.crankAngleRad)}
                  y2={PLOT_HEIGHT}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          </section>
        );
      })}

      <div className={styles.axis} aria-hidden="true">
        <span>0°</span>
        <span>90°</span>
        <span>180°</span>
        <span>270°</span>
        <span>360°</span>
      </div>
    </details>
  );
}
