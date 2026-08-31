import { useEngineStore } from "../../state/engineStore";
import { cycleAngleRad, strokePhaseAt } from "../../engine/cycle";
import type { StrokePhase } from "../../engine/cycle";
import { radToDeg } from "../../engine/units";
import { formatRounded } from "../shared/formatting";
import styles from "./StrokeBadge.module.css";

const PHASE_LABEL: Record<StrokePhase, string> = {
  intake: "Intake",
  compression: "Compression",
  power: "Power",
  exhaust: "Exhaust",
};

/**
 * Four-stroke cycle badge (`src/engine/cycle.ts`'s pedagogical overlay):
 * names the current stroke and shows a 0–720° cycle counter, so the
 * mechanism's familiar 360° crank rotation reads against the four-stroke
 * engine's actual 720° cycle. Rendered inside `AnimationControls`, right
 * beside the crank-angle scrub readout it extends, and gated behind the
 * "Four-stroke cycle" preference (`UnitSelector`, off by default) — it is
 * optional pedagogy, not a readout most sessions need. The colored dot is
 * decorative (`aria-hidden`); the stroke name is always spelled out in text,
 * per §19's "avoid color as the only way to communicate state."
 *
 * Engine A only, tonight: this reads engine A's `crankAngleRad` and
 * `crankRevolutionParity` directly rather than taking a `slot` prop the way
 * `CalculationPanel`/`ComparisonTable` do, because `AnimationControls` is
 * itself a single shared instance in both comparison and non-comparison mode
 * (§16) — there is no per-engine copy of it to extend the badge into. Giving
 * engine B its own badge would mean either reshaping this into
 * `ComparisonTable`'s per-column table layout (a different markup shape
 * entirely from this shared control) or duplicating `AnimationControls`
 * itself; both are larger changes than this overlay earns tonight.
 *
 * Multi-cylinder note: reflects cylinder 1 only. Cylinder 1's crank-throw
 * offset is always 0 (`engineLayout.ts`'s phase tables), so engine A's own
 * crank angle already *is* cylinder 1's; other cylinders fire out of phase
 * with it and will get a per-cylinder display once firing order lands.
 */
export function StrokeBadge() {
  const showCycle = useEngineStore((state) => state.preferences.showCycle);
  const crankAngleRad = useEngineStore((state) => state.crankAngleRad);
  const crankRevolutionParity = useEngineStore(
    (state) => state.crankRevolutionParity,
  );

  if (!showCycle) {
    return null;
  }

  const cycleAngle = cycleAngleRad(crankAngleRad, crankRevolutionParity);
  const phase = strokePhaseAt(cycleAngle);
  const cycleDeg = radToDeg(cycleAngle);

  return (
    <p className={styles.badge} data-phase={phase}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>Four-stroke cycle</span>
      <span className={styles.value}>
        {PHASE_LABEL[phase]} · {formatRounded(cycleDeg, 0)}° / 720°
      </span>
    </p>
  );
}
