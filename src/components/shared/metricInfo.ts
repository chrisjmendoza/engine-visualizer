/**
 * Explanatory content for calculated-result metrics, shown in the info
 * popups on the results panel and comparison table. Pure data.
 *
 * Wording rules: define the metric in the first sentence, then say what
 * difference it makes in a real engine. Plain language, no formulas unless
 * the formula IS the explanation. These strings are user-facing prose.
 */

export interface MetricInfo {
  /** Stable key used by the results components to look up an entry. */
  id: string;
  /** Display label, matching the row label in the results table. */
  label: string;
  /** What the metric is and why it matters, 2–4 sentences. */
  body: string;
}

export const METRIC_INFO: readonly MetricInfo[] = [
  {
    id: "cylinderDisplacement",
    label: "Cylinder displacement",
    body: "The volume one piston sweeps between top and bottom dead center (π/4 × bore² × stroke). More swept volume means more air and fuel one cylinder can burn per cycle, which is what actually determines that individual mechanism's behavior — piston speed, torque per cylinder, how the rod loads up. See engine displacement, just below, for what all the cylinders add up to.",
  },
  {
    id: "engineDisplacement",
    label: "Engine displacement",
    body: "The whole engine's total swept volume: cylinder displacement multiplied by the number of cylinders. This is the figure a car is usually sold by — a \"2.0 litre\" or \"6.2 litre\" engine is being named by its engine displacement, not any one cylinder's — while cylinder displacement above is what determines the individual mechanism's behavior. Eight of the LS3's 770 cc cylinders make its 6.2 liters.",
  },
  {
    id: "boreStrokeRatio",
    label: "Bore-to-stroke ratio",
    body: 'Bore diameter divided by stroke length. Over 1:1 is "oversquare" (short-stroke): room for bigger valves, less piston travel per revolution, so the engine can rev higher before piston speed becomes the limit. Under 1:1 is "undersquare" (long-stroke): a smaller bore burns more completely and favors low-rpm torque, at the cost of revs. Exactly 1:1 is "square", like the 86 × 86 mm 2JZ.',
  },
  {
    id: "rodStrokeRatio",
    label: "Rod-to-stroke ratio",
    body: "Connecting-rod length divided by stroke. A longer rod (higher ratio) stays closer to vertical, so it pushes the piston against the cylinder wall less and accelerates it more gently around top dead center — one reason the S2000's 1.82 ratio revs so sweetly. A shorter rod (the LS7 sits at 1.52) makes the engine physically shorter and lighter but trades away some of that mechanical gentleness. Watch the rod sway in the animation: a low-ratio engine visibly swings harder.",
  },
  {
    id: "meanPistonSpeed",
    label: "Mean piston speed",
    body: "The piston's average speed at the CURRENT rpm setting: it travels two strokes per revolution, so this is 2 × stroke × rpm. Piston speed — not rpm — is what actually stresses pistons, rings, and rods, and it drives friction losses. Note this readout follows the RPM slider, not the engine's redline.",
  },
  {
    id: "meanPistonSpeedRedline",
    label: "Mean piston speed at redline",
    body: "The same average piston speed, computed at the engine's rated redline — the great equalizer between engines. Most production performance engines converge on roughly 20–25 m/s here regardless of layout: the S2000 revs to 9,000 rpm because its stroke is short, while the LS7's long stroke reaches a similar piston speed by 7,000. If this number is unusually high, the engine is working its reciprocating parts hard.",
  },
  {
    id: "compressionRatio",
    label: "Compression ratio",
    body: "How much the cylinder squeezes the intake charge: the ratio of cylinder volume at bottom dead center to the volume left at top dead center — the input that clearance volume and clearance height, just below, are both derived from. Higher compression extracts more work from the same charge, which is why the naturally aspirated ND Miata pushes it to 13.0:1; forced induction already raises the charge's pressure before the piston starts squeezing, so boosted engines back the ratio off to avoid knock instead — 8.5:1 on the 2JZ-GTE, well below any naturally aspirated engine in this roster.",
  },
  {
    id: "clearanceVolume",
    label: "Clearance volume",
    body: "The space left above the piston at top dead center — swept volume divided by (compression ratio − 1). Squeezing the charge into a smaller clearance volume raises compression, which extracts more work from the same fuel, until the fuel's knock resistance sets the ceiling. This is why high-compression engines want premium fuel and boosted engines (like the 8.5:1 2JZ-GTE) start low.",
  },
  {
    id: "clearanceHeight",
    label: "Clearance height (TDC)",
    body: "The clearance volume expressed as a height: how tall the gap above the piston crown is at top dead center, modeling that space as a flat disc (real chambers have shaped domes and dishes, which this visualizer doesn't model). Higher compression ratio = shorter gap — visible in the animation as the head sitting closer to the piston's highest point.",
  },
  {
    id: "pistonToHeadRange",
    label: "Piston-to-head distance",
    body: "The minimum and maximum gap between the piston crown and the cylinder head over a full revolution: the clearance height at top dead center, and clearance height plus stroke at bottom dead center. The tight end of this range is why valve timing matters so much in real engines — at TDC there is very little room for anything else in the chamber.",
  },
  {
    id: "currentCrankAngle",
    label: "Current crank angle",
    body: "The crankshaft's rotation from top dead center: 0° puts the piston at its highest point, 180° at its lowest, and 360° completes one revolution. A four-stroke engine's full cycle spans two revolutions (720°) — this visualizer currently animates the mechanical revolution only.",
  },
  {
    id: "pistonDisplacement",
    label: "Piston displacement from TDC",
    body: "How far the piston has traveled down the bore from its highest point. Notice it is NOT a smooth sine wave: because the rod tilts, the piston is already past its mid-stroke point before the crank reaches 90°. That asymmetry — faster motion near TDC than near BDC — is the signature of real slider-crank geometry, and it grows as the rod-to-stroke ratio shrinks.",
  },
  {
    id: "currentPistonToHead",
    label: "Current piston-to-head distance",
    body: "The live gap between the piston crown and the cylinder head at this instant: the clearance height plus the current piston displacement. It runs from the clearance height (at top dead center) to clearance height plus stroke (at bottom dead center).",
  },
  {
    id: "redline",
    label: "Redline",
    body: "The engine's rated maximum speed. It isn't arbitrary: it's set by what the reciprocating parts survive — chiefly piston speed (stroke × rpm) and valvetrain control. That's why short-stroke engines like the S2000's F20C can be rated to 9,000 rpm while the long-stroke LS7 is done at 7,000, yet both reach similar piston speeds at their limits.",
  },
  {
    id: "peakPower",
    label: "Peak power",
    body: "The manufacturer-published peak power output and the rpm at which it occurs, for the specific market/model-year variant this preset documents — a whole-engine figure for all cylinders, unlike the per-cylinder geometry elsewhere in this panel. Power is torque multiplied by rpm, so it peaks well after peak torque: the engine is making somewhat less twist per revolution but doing it far more often. This is a single verified data point, not a measured curve — it says nothing about how power builds between idle and this peak.",
  },
  {
    id: "peakTorque",
    label: "Peak torque",
    body: "The manufacturer-published peak torque and the rpm at which it occurs, for the specific market/model-year variant this preset documents — again a whole-engine figure, not per-cylinder. Torque peaks where the cylinders fill with air most effectively, which is why big-displacement engines make their peak low and small turbocharged engines make theirs wherever the turbo comes on song. This is a single verified data point, not a measured curve — it says nothing about how torque builds between idle and this peak.",
  },
  {
    id: "rodAngle",
    label: "Connecting-rod angle",
    body: "How far the rod is tilted from the cylinder's centerline, positive when the crankpin has swung toward the right of the scene. The tilt is what converts rotation into straight-line piston motion, but it also presses the piston sideways into the cylinder wall — the dominant source of piston friction and skirt wear. Engines with short rods relative to stroke swing to larger angles.",
  },
] as const;
