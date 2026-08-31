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
    body: "The volume one piston sweeps between top and bottom dead center (π/4 × bore² × stroke). More swept volume means more air and fuel can be burned per cycle, which is the most direct route to more torque. Multiply by the cylinder count for the engine's advertised size — eight of the LS3's 770 cc cylinders make its 6.2 liters.",
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
    body: "The engine's maximum power output and the rpm where it happens — a whole-engine figure for all cylinders, unlike the per-cylinder geometry elsewhere in this panel. Power is torque multiplied by rpm, so it peaks well after peak torque: the engine is making somewhat less twist per revolution but doing it far more often. This is why high-revving engines like the F20C can out-power a larger engine that makes more torque.",
  },
  {
    id: "peakTorque",
    label: "Peak torque",
    body: "The maximum twisting force the engine produces and the rpm where it happens — again a whole-engine figure. Torque peaks where the cylinders fill with air most effectively, which is why big-displacement engines make their peak low and small turbocharged engines make theirs wherever the turbo comes on song. The gap between the torque peak and the power peak tells you how the car feels: a narrow gap is punchy and relaxed, a wide one rewards revving it out.",
  },
  {
    id: "rodAngle",
    label: "Connecting-rod angle",
    body: "How far the rod is tilted from the cylinder's centerline, positive when the crankpin has swung toward the right of the scene. The tilt is what converts rotation into straight-line piston motion, but it also presses the piston sideways into the cylinder wall — the dominant source of piston friction and skirt wear. Engines with short rods relative to stroke swing to larger angles.",
  },
] as const;
