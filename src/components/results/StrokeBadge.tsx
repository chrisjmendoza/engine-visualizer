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
 * `crankRevolutionIndex` directly rather than taking a `slot` prop the way
 * `CalculationPanel`/`ComparisonTable` do, because `AnimationControls` is
 * itself a single shared instance in both comparison and non-comparison mode
 * (§16) — there is no per-engine copy of it to extend the badge into. Giving
 * engine B its own badge would mean either reshaping this into
 * `ComparisonTable`'s per-column table layout (a different markup shape
 * entirely from this shared control) or duplicating `AnimationControls`
 * itself; both are larger changes than this overlay earns tonight.
 *
 * Multi-cylinder note: this badge reflects **cylinder 1 only**, and that is now
 * a deliberate division of labor rather than a limitation. Cylinder 1's
 * crank-throw offset is always 0 (`engineLayout.ts`'s phase tables) and its
 * firing angle is 0 by construction (`cylinderFiringAngleRad`), so engine A's
 * own crank angle already *is* cylinder 1's and `strokePhaseAt` needs no
 * layout here. The per-cylinder story is told by the scene instead: the same
 * preference that shows this badge tints every cylinder's combustion chamber
 * by its own stroke (`src/scene/chamberTint.ts`), which is where a firing order
 * can actually be *seen*. The two can never disagree — the tint routes cylinder
 * 0 through `cylinderStrokePhaseAt`, which reduces to exactly this
 * `strokePhaseAt` call for that cylinder.
 *
 * Piston-only, for now (section 27): a rotary's four "phases" are a real,
 * analogous pedagogical overlay (`rotaryPhaseAt` in
 * `src/engine/rotaryCycle.ts` mirrors `strokePhaseAt` exactly), but this
 * badge is wired specifically to `cycleAngleRad`/`strokePhaseAt`'s
 * 720-degree-crank framing, which has no rotary-cycle-angle counterpart
 * here yet. Extending it is the natural follow-up once a rotary
 * chamber-volume readout exists, not this task, so it simply renders
 * nothing while engine A is rotary rather than showing a piston-shaped
 * badge for a mechanism with no piston.
 */
export function StrokeBadge() {
  const showCycle = useEngineStore((state) => state.preferences.showCycle);
  const engineFamily = useEngineStore((state) => state.engineFamily);
  const crankAngleRad = useEngineStore((state) => state.crankAngleRad);
  // The loop's revolution counter runs mod 6 so one counter can serve both
  // engine families (`CrankRevolutionIndex`); a four-stroke cycle only cares
  // which of two crank revolutions it is on, so the parity is `% 2`. Six is
  // even, so that derivation is exact at every wrap.
  const crankRevolutionIndex = useEngineStore(
    (state) => state.crankRevolutionIndex,
  );

  if (!showCycle || engineFamily === "rotary") {
    return null;
  }

  const cycleAngle = cycleAngleRad(
    crankAngleRad,
    crankRevolutionIndex % 2 === 0 ? 0 : 1,
  );
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
