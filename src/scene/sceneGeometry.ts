/**
 * Shared rendering constants and derived part proportions for the engine
 * scene (TECHNICAL_DESIGN.md §12).
 *
 * Scene units: 1 unit = 1 mm. The crankshaft center is the origin, +Y points
 * toward the cylinder head, +Z is toward the viewer (the camera looks down
 * -Z). Crank angle 0 is TDC (§8.2).
 *
 * This module contains NO engine math: every animated position comes from
 * `calculateMechanismState`, and the clearance height above the piston crown
 * comes from `calculateClearanceHeightMm`. What lives here is purely cosmetic
 * part sizing — how thick a crank web is drawn, how deep the piston is
 * extruded — all of it derived from the real configured bore, stroke, rod
 * length, and compression ratio so the mechanism is never distorted relative
 * to itself (§12.2).
 */

import { useMemo } from "react";
import { calculateClearanceHeightMm } from "../engine/calculations";
import {
  createEngineLayout,
  sharesCrankpin,
  visibleCylinders,
} from "../engine/engineLayout";
import type {
  CylinderDefinition,
  EngineLayoutDefinition,
  EngineLayoutId,
  EngineLayoutKind,
} from "../engine/engineLayout";
import type { CrankMechanismConfig } from "../engine/types";
import { useEngineStore } from "../state/engineStore";
import { describeConfig } from "./mechanismLabels";

/**
 * Scene palette. Three.js cannot read the CSS custom properties in
 * `src/styles/globals.css`, so these mirror those tokens by hand:
 * background matches `--color-bg`, accent matches `--color-accent`.
 */
export const SCENE_COLORS = {
  background: "#14171c",
  /** Highlight for moving joints: crankpin and piston pin. */
  accent: "#ff9f43",
  /** Dimmed accent for static reference indicators. */
  accentDim: "#a86a2b",
  /** Fixed structure: bore walls, deck. */
  structure: "#39414d",
  structureDark: "#2a313b",
  /** Bore wall alongside the clearance volume, lifted so the space reads. */
  clearance: "#4d5766",
  /**
   * Combustion chamber during the **power** stroke — the four-stroke tint
   * (§24a), applied to the chamber surfaces `clearance` otherwise paints.
   *
   * A deep, desaturated red rather than a hot one: it has to read as
   * combustion at a glance while staying clearly distinct from `accent`, the
   * bright orange the moving joints are marked with, so a tinted chamber can
   * never be mistaken for a highlighted pin. Both tints sit at roughly the
   * same lightness as `clearance` itself, so a cylinder changes hue through
   * the cycle without flashing brighter or darker.
   */
  chamberFiring: "#a4402f",
  /** Combustion chamber during the **exhaust** stroke: cooling, spent gas. */
  chamberExhaust: "#3a6f96",
  piston: "#c3ccd8",
  rod: "#98a3b2",
  crank: "#7c8797",
  reference: "#5d6673",
  ring: "#1c2128",
} as const;

/** Ortho camera stand-off along +Z. Only affects clipping, not scale. */
export const CAMERA_DISTANCE_MM = 1000;

/** Fraction of extra space left around the mechanism when auto-framing. */
export const FRAME_PADDING = 1.1;

/**
 * Gap between compared engines, as a fraction of their mean width. Scaling it
 * to the engines themselves keeps the pair looking equally spaced whether the
 * comparison is two small motorcycle singles or two large-bore V8 cylinders.
 */
export const COMPARISON_GAP_FRACTION = 0.18;

/**
 * Vertical gap between stacked compared engines, as a fraction of their mean
 * height — the exact analogue of `COMPARISON_GAP_FRACTION` on the other axis,
 * and scaled to the engines for the same reason.
 *
 * Deliberately smaller than the horizontal fraction: two rows on separate
 * baselines already read as two engines without much help, whereas two rows
 * side by side would run into one another. The vertical axis is also the one
 * a stacked pair is most likely to be zoom-limited by, and every millimeter of
 * gap here costs both engines size on screen.
 */
export const COMPARISON_VERTICAL_GAP_FRACTION = 0.1;

/**
 * Crank-direction indicator (§19, front cylinder only): a static reference
 * ring around the crank center, drawn as a partial torus with a cone
 * arrowhead, showing which way the crank actually turns. It never animates
 * — it lives in the same fixed reference Z plane as the TDC/BDC ticks, and
 * like them is drawn on every render regardless of `showLabels` (that
 * preference gates only the name label; see `CylinderGuide`).
 *
 * The gap is centered at the bottom of the circle (standard angle -90°, "6
 * o'clock") purely for tidy placement, clear of the piston/rod above. All
 * of these angles are fixed layout constants — only the ring's radius
 * varies with engine geometry (`MechanismProportions.crankArrowRadiusMm`).
 *
 * Direction check (do not "eyeball" this — verify it against the math):
 * `calculateMechanismState` places the crankpin at
 * (r·sinθ, r·cosθ) — (0, r), straight up, at θ = 0 (TDC) — and
 * `CrankThrow` rotates the drawn crank by -θ about Z to match. As θ
 * increases from 0, standard angle (measured CCW from +X, matching the
 * torus/cone parametrization below) goes 90° → 0° → -90° → ... i.e. it
 * *decreases*: top, to right, to bottom, to left. That is clockwise as
 * drawn (+Y up, +X right, camera looking down -Z at the front of the
 * scene) — never counter-clockwise. `CRANK_ARROW_HEAD_ANGLE_RAD` and
 * `CRANK_ARROW_HEAD_ROTATION_Z_RAD` below encode exactly that clockwise
 * sense; if the crank's rotation sign in `CrankThrow`/`kinematics` ever
 * changes, this arrow's head must be re-derived, not just re-aimed.
 */
export const CRANK_ARROW_GAP_RAD = Math.PI / 3;
const CRANK_ARROW_GAP_CENTER_RAD = -Math.PI / 2;
/** Standard angle where the drawn arc begins (CCW, torus `arc` parameter). */
export const CRANK_ARROW_MESH_START_RAD =
  CRANK_ARROW_GAP_CENTER_RAD + CRANK_ARROW_GAP_RAD / 2;
/** How far the torus arc sweeps (CCW) from `CRANK_ARROW_MESH_START_RAD`. */
export const CRANK_ARROW_SWEEP_RAD = 2 * Math.PI - CRANK_ARROW_GAP_RAD;
/**
 * Standard angle of the arrowhead tip: the edge of the gap a point moving
 * *clockwise* (decreasing standard angle) reaches first — i.e. the leading
 * edge in the crank's true rotation direction, not the trailing one.
 */
export const CRANK_ARROW_HEAD_ANGLE_RAD = CRANK_ARROW_MESH_START_RAD;

/**
 * Rotation about Z, in radians, that aims a +Y-pointing cone along the
 * clockwise tangent at `standardAngleRad` on the unit circle: for clockwise
 * motion (θ decreasing), velocity direction is (sinθ, -cosθ), and a cone's
 * default apex (+Y, standard angle 90°) reaches that heading after rotating
 * by `atan2(tangentY, tangentX) - π/2`.
 */
export function clockwiseTangentRotationZRad(standardAngleRad: number): number {
  const tangentX = Math.sin(standardAngleRad);
  const tangentY = -Math.cos(standardAngleRad);
  return Math.atan2(tangentY, tangentX) - Math.PI / 2;
}

/** Fixed rotation for the arrowhead cone, since its angle never varies. */
export const CRANK_ARROW_HEAD_ROTATION_Z_RAD = clockwiseTangentRotationZRad(
  CRANK_ARROW_HEAD_ANGLE_RAD,
);

/**
 * Gap between adjacent slots of one engine's row, as a fraction of the widest
 * reach one of its slots has across its own crank center (§24) — the
 * cylinder's plain bounds width for an upright layout, and the combined
 * rotated footprint of a throw's pair for a V or flat one (§24a).
 *
 * Much tighter than `COMPARISON_GAP_FRACTION`: cylinders of one engine share a
 * crankcase and should read as one machine, while two compared engines must
 * read as two. The bounds width already includes the TDC/BDC ticks outboard of
 * each bore, so a small fraction is enough to keep neighbouring ticks from
 * touching.
 */
export const INLINE_GAP_FRACTION = 0.06;

/**
 * Clear space between the bottom of the mechanisms and the label band, as a
 * fraction of the staged content's height.
 */
export const LABEL_GAP_FRACTION = 0.035;

/**
 * Height reserved for the label band, as a fraction of the staged content's
 * height. The labels themselves are DOM text at a fixed pixel size, so the
 * band cannot be sized in millimeters from the text; taking a fraction of the
 * content instead means the reserved band is a roughly constant share of the
 * viewport once the camera has fitted everything, whatever the engine size.
 */
export const LABEL_BAND_FRACTION = 0.075;

/** Cosmetic part sizes, all derived from the configured engine dimensions. */
export interface MechanismProportions {
  boreMm: number;
  crankRadiusMm: number;
  rodLengthMm: number;

  pistonWidthMm: number;
  pistonHeightMm: number;
  pistonDepthMm: number;
  pistonCrownAbovePinMm: number;
  pistonSkirtBelowPinMm: number;
  pistonPinRadiusMm: number;
  pistonPinLengthMm: number;

  rodWidthMm: number;
  rodDepthMm: number;
  rodBigEndRadiusMm: number;
  rodSmallEndRadiusMm: number;

  crankZMm: number;
  crankWebWidthMm: number;
  crankWebDepthMm: number;
  crankPinRadiusMm: number;
  crankPinLengthMm: number;
  crankPinZMm: number;
  journalRadiusMm: number;
  journalLengthMm: number;
  journalZMm: number;
  counterweightWidthMm: number;
  counterweightHeightMm: number;
  counterweightCenterYMm: number;

  cylinderWallThicknessMm: number;
  cylinderWallBottomYMm: number;
  /**
   * Deck face: the underside of the head and the top of the bore walls. Sits
   * exactly `clearanceHeightMm` above the piston crown at TDC, so raising the
   * compression ratio visibly lowers the head onto the piston.
   */
  cylinderWallTopYMm: number;
  cylinderDepthMm: number;
  deckThicknessMm: number;
  /** Piston crown height at TDC: the floor of the clearance volume. */
  crownAtTdcYMm: number;
  /** Clearance height from `calculateClearanceHeightMm` (never recomputed). */
  clearanceHeightMm: number;
  /** Thin plate marking the head face, capped to fit a tight clearance. */
  headFaceThicknessMm: number;

  /** Piston-pin height at top dead center (r + l). */
  tdcPinYMm: number;
  /** Piston-pin height at bottom dead center (l - r). */
  bdcPinYMm: number;
  markerLengthMm: number;
  markerThicknessMm: number;
  markerInnerXMm: number;
  centerlineWidthMm: number;
  /** Z plane for unlit reference geometry, in front of every solid part. */
  referenceZMm: number;

  /**
   * Crank-direction indicator (front cylinder only; see the constants
   * above). Radius sits just outside the crankpin's own drawn disc so the
   * static ring never merges with the moving crankpin when it swings past
   * the ring's position.
   */
  crankArrowRadiusMm: number;
  crankArrowTubeRadiusMm: number;
  crankArrowHeadRadiusMm: number;
  crankArrowHeadLengthMm: number;

  /**
   * Static extents of this mechanism, relative to its own crankshaft center.
   * Used to place it on the stage and to auto-frame the camera (§12.2).
   */
  bounds: SceneBounds;
}

/**
 * Derives every drawn dimension from one configuration. Pure and cheap; call
 * it only when the configuration changes, never per frame (§18).
 */
export function deriveProportions(
  config: CrankMechanismConfig,
): MechanismProportions {
  // Guard against a degenerate config reaching the renderer; validation
  // (§13) is expected to have rejected these upstream.
  const bore = Math.max(config.boreMm, 1);
  const stroke = Math.max(config.strokeMm, 1);
  const rodLength = Math.max(config.rodLengthMm, 1);
  // Only the input is guarded, so the clearance height stays exactly what
  // `calculateClearanceHeightMm` returns for every valid compression ratio.
  const compressionRatio = Math.max(config.compressionRatio, 1.05);
  const r = stroke / 2;

  const pistonHeight = 0.6 * bore;
  const pistonWidth = 0.98 * bore;
  const pistonDepth = 0.6 * bore;
  // The pin sits low in the piston, as on a real piston: 65% of the height
  // above the pin, 35% below it.
  const pistonCrownAbovePin = 0.65 * pistonHeight;
  const pistonSkirtBelowPin = 0.35 * pistonHeight;

  const wallThickness = 0.1 * bore;
  const deckThickness = 0.1 * bore;
  const crownAtTdc = r + rodLength + pistonCrownAbovePin;
  const skirtAtBdc = rodLength - r - pistonSkirtBelowPin;
  // The clearance volume is modeled as a flat disc above the crown at TDC, so
  // the deck face is that height above the crown. Its size comes from the
  // engine layer; the scene never recomputes stroke / (CR - 1).
  const clearanceHeight = calculateClearanceHeightMm(stroke, compressionRatio);
  const wallTop = crownAtTdc + clearanceHeight;
  // The bore cannot extend into the crank circle; a short rod simply means
  // the skirt leaves the bore at BDC, exactly as it would in a real engine.
  const wallBottom = Math.max(skirtAtBdc - 0.15 * bore, r + 0.06 * bore);

  const crankPinRadius = Math.min(0.09 * bore, 0.35 * r);
  const crankWebWidth = Math.min(0.3 * bore, 1.2 * r);
  const journalRadius = Math.min(0.14 * bore, 0.5 * r);
  const counterweightWidth = Math.min(1.3 * r, bore);
  const counterweightHeight = 0.7 * r;
  const counterweightCenterY = -0.45 * r;

  const markerLength = 0.22 * bore;
  const markerInnerX = bore / 2 + wallThickness;

  const crankExtentY = Math.max(
    r + crankWebWidth / 2,
    -counterweightCenterY + counterweightHeight / 2,
    journalRadius,
  );

  // Crank-direction reference ring: sized to clear the crankpin's own drawn
  // disc (radius r, thickness crankPinRadius) by a comfortable margin, so
  // the static ring never merges with the pin as it swings past.
  const crankArrowTubeRadius = Math.max(0.7, 0.012 * bore);
  const crankArrowRadius = r + crankPinRadius * 1.5;
  const crankArrowHeadRadius = crankArrowTubeRadius * 2.5;
  const crankArrowHeadLength = crankArrowTubeRadius * 5;
  // The largest radial reach the ring + arrowhead can have from the crank
  // center, in any direction — folded into the bounds below exactly like
  // the TDC/BDC ticks, so auto-framing never clips it.
  const crankArrowExtent = crankArrowRadius + crankArrowHeadLength;

  return {
    boreMm: bore,
    crankRadiusMm: r,
    rodLengthMm: rodLength,

    pistonWidthMm: pistonWidth,
    pistonHeightMm: pistonHeight,
    pistonDepthMm: pistonDepth,
    pistonCrownAbovePinMm: pistonCrownAbovePin,
    pistonSkirtBelowPinMm: pistonSkirtBelowPin,
    pistonPinRadiusMm: Math.min(0.085 * bore, 0.35 * r),
    pistonPinLengthMm: 0.36 * bore,

    rodWidthMm: 0.15 * bore,
    rodDepthMm: 0.12 * bore,
    rodBigEndRadiusMm: Math.max(1.7 * crankPinRadius, 0.1 * bore),
    rodSmallEndRadiusMm: Math.max(1.3 * crankPinRadius, 0.075 * bore),

    crankZMm: -0.1 * bore,
    crankWebWidthMm: crankWebWidth,
    crankWebDepthMm: 0.16 * bore,
    crankPinRadiusMm: crankPinRadius,
    crankPinLengthMm: 0.34 * bore,
    // Pushes the crankpin's front face past the rod so the accent-colored
    // joint stays visible from the fixed front viewpoint.
    crankPinZMm: 0.06 * bore,
    journalRadiusMm: journalRadius,
    journalLengthMm: 0.25 * bore,
    journalZMm: -0.1 * bore,
    counterweightWidthMm: counterweightWidth,
    counterweightHeightMm: counterweightHeight,
    counterweightCenterYMm: counterweightCenterY,

    cylinderWallThicknessMm: wallThickness,
    cylinderWallBottomYMm: wallBottom,
    cylinderWallTopYMm: wallTop,
    cylinderDepthMm: 0.7 * bore,
    deckThicknessMm: deckThickness,
    crownAtTdcYMm: crownAtTdc,
    clearanceHeightMm: clearanceHeight,
    // Capped so a high-compression engine's thin clearance disc is still
    // closed by a plate that cannot reach down through the piston crown.
    headFaceThicknessMm: Math.min(0.024 * bore, 0.35 * clearanceHeight),

    tdcPinYMm: r + rodLength,
    bdcPinYMm: rodLength - r,
    markerLengthMm: markerLength,
    markerThicknessMm: Math.max(0.7, 0.012 * bore),
    markerInnerXMm: markerInnerX,
    centerlineWidthMm: Math.max(0.5, 0.008 * bore),
    referenceZMm: 0.45 * bore,

    crankArrowRadiusMm: crankArrowRadius,
    crankArrowTubeRadiusMm: crankArrowTubeRadius,
    crankArrowHeadRadiusMm: crankArrowHeadRadius,
    crankArrowHeadLengthMm: crankArrowHeadLength,

    bounds: {
      maxX: Math.max(
        markerInnerX + markerLength,
        r + crankWebWidth / 2,
        counterweightWidth / 2,
        crankArrowExtent,
      ),
      minX: -Math.max(
        markerInnerX + markerLength,
        r + crankWebWidth / 2,
        counterweightWidth / 2,
        crankArrowExtent,
      ),
      // The top of the deck, which now rides on the clearance height: a low
      // compression ratio pushes the head up and the camera frames wider.
      maxY: wallTop + deckThickness,
      minY: -Math.max(crankExtentY + 0.06 * bore, crankArrowExtent),
    },
  };
}

/** Axis-aligned extents in scene millimeters. */
export interface SceneBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Where and what to draw for one mechanism's name label. */
export interface LabelPlacement {
  /** "A" or "B" while comparing; null when a single engine is on stage. */
  slot: "A" | "B" | null;
  /** The engine's preset name, or "Custom engine". */
  name: string;
  /** Anchor point, centered under the mechanism, in scene millimeters. */
  anchorXMm: number;
  anchorYMm: number;
}

/**
 * One cylinder of one engine, placed on the stage (§24).
 *
 * Carries the whole `CylinderDefinition` rather than just the phase so the
 * frame loop can hand it straight to `cylinderCrankAngleRad` and index the
 * stage's per-cylinder registry by `index`, without rebuilding anything.
 *
 * `bankOffsetRad` comes through with it as the engine's *real* bank geometry;
 * what the renderer actually rotates by is `drawnRotationRad` below, which is
 * a presentation decision made in one place (`drawnRotationRad`).
 */
export interface PlacedCylinder extends CylinderDefinition {
  /**
   * Which slot of the row this cylinder is drawn in — a **throw** slot, not a
   * cylinder slot (§24a). Inline and single layouts give every cylinder its own
   * slot, so this is just `index`. V and flat layouts draw the pair `2k` /
   * `2k+1` in slot `k`, around one crank center: for a V that pair genuinely
   * shares one throw, and for a boxer it is two adjacent throws 180° apart that
   * the schematic collapses into one plane.
   *
   * Cylinders of one slot share an `offsetXMm` and an `offsetYMm`; only
   * `offsetZMm` and the bank tilt tell them apart.
   */
  throwIndex: number;
  /** X of this cylinder's crankshaft center on the stage, scene millimeters. */
  offsetXMm: number;
  /**
   * Y of this cylinder's crankshaft center on the stage, scene millimeters.
   * Always 0 except for the lower engine of a stacked comparison (§24a), which
   * is what lets two multi-cylinder engines be compared column by column.
   */
  offsetYMm: number;
  /**
   * Depth of this cylinder's whole drawn mechanism, scene millimeters. Zero for
   * the first cylinder of every slot — which is every cylinder of an inline
   * engine — and a small negative step for the second cylinder of a throw pair,
   * pushing it just behind its partner (§24a).
   *
   * Two cylinders sharing one plane would otherwise put coincident faces at
   * identical depths and z-fight: a boxer pair's main journals sit on the same
   * axis, and its bore centerlines are outright collinear. The step is also
   * physically honest — the two cylinders of a real throw pair *are* at
   * different axial positions, which is the very dimension this cutaway view
   * cannot show — and it puts the two rods of a shared-pin V side by side on
   * the pin, as they are in the real engine.
   *
   * The step is deliberately small (half a rod thickness): big enough that
   * nothing is coplanar, small enough that the shifted cylinder's reference
   * plane stays in front of its partner's solid parts.
   */
  offsetZMm: number;
  /**
   * Whether this cylinder draws its own crank throw, or only its rod, piston,
   * guide, and reference marks (§24a).
   *
   * False exactly when an earlier cylinder in the same slot already drew a
   * crank this one would land on top of — i.e. when `sharesCrankpin` holds, as
   * it does for a plain-pin V pair, whose crank drawings coincide at every
   * crank angle. The single drawn crankpin is then genuinely shared by both
   * rods, which is what a real V engine does. A flying-arm V (`v6-60`) and a
   * boxer both have two real, distinct pins in the pair, so both cylinders draw
   * their own.
   */
  drawsCrank: boolean;
  /**
   * How far this cylinder's whole drawing is rotated about its own crankshaft
   * center, radians — what `drawnRotationRad` decided, and what the renderer
   * actually applies (§24a).
   *
   * Usually the cylinder's real `bankOffsetRad`, but not always: the
   * single-cylinder view draws every cylinder upright, and
   * `uprightFlatEngines` adds a quarter turn to a flat engine's. See
   * `drawnRotationRad` for why both are deliberate. `bankOffsetRad` is still
   * carried alongside, unchanged, as the engine's real geometry.
   */
  drawnRotationRad: number;
  /**
   * This cylinder's extents relative to its own crankshaft center, already
   * rotated by `drawnRotationRad` (§24a). Equal to `proportions.bounds` for a
   * cylinder drawn upright; for a tilted one it is the axis-aligned envelope
   * of the rotated mechanism, which is what keeps a tilted bore from
   * overlapping its neighbour or being clipped by the camera.
   *
   * Still per cylinder, not per slot: a slot's own footprint is the union of
   * its cylinders' (see `MeasuredThrow`), but framing checks and label
   * placement want the real reach of each drawn mechanism.
   */
  bounds: SceneBounds;
}

/** One engine — a row of one or more identical cylinders — on the stage. */
export interface PlacedEngine {
  config: CrankMechanismConfig;
  /**
   * The architecture this row was built from — the shared frozen instance
   * `createEngineLayout` returns, carried through unchanged rather than rebuilt
   * (§24). The frame loop needs it to ask the engine layer each cylinder's
   * four-stroke phase (`cylinderStrokePhaseAt`), which depends on the layout's
   * firing order and so cannot be answered from a `PlacedCylinder` alone.
   *
   * Note that this is the whole architecture even when only cylinder 0 is
   * drawn: `cylinders` below has already applied `visibleCylinders`, and a V8
   * viewed as one cylinder is still a V8.
   */
  layout: EngineLayoutDefinition;
  /**
   * One shared proportions object: every cylinder of an engine has the same
   * bore, stroke, rod, and compression ratio, so they are drawn identically
   * and differ only in crank phase and X offset.
   */
  proportions: MechanismProportions;
  /** Its cylinders, left to right, in crankshaft order (front to back). */
  cylinders: readonly PlacedCylinder[];
  /** Its name label, or null when labels are hidden. */
  label: LabelPlacement | null;
  /**
   * Extents of the whole row in world coordinates — already offset onto the
   * stage, unlike `proportions.bounds`, which is relative to one crankshaft
   * center. Used for comparison placement, label centering, and framing.
   */
  bounds: SceneBounds;
}

/**
 * Where each engine sits and what the camera must frame.
 *
 * Both engines are drawn at the same scale — 1 scene unit is 1 mm for
 * everything — so a large engine genuinely towers over a small one. Only the
 * offsets differ; no mechanism is ever scaled to fit.
 */
export interface SceneLayout {
  /**
   * How the stage is arranged: one engine, a side-by-side pair (both showing
   * a single cylinder), or a stacked pair (either showing more than one).
   */
  arrangement: ComparisonArrangement;
  /** Engine A: to the left of, or above, engine B when comparing. */
  primary: PlacedEngine;
  /** Engine B, to the right of or below A, or null when comparison is off. */
  secondary: PlacedEngine | null;
  /** Union of every placed engine's extents, in world coordinates. */
  bounds: SceneBounds;
}

/**
 * Which axis a comparison pair is laid out along (§24a), or `"single"` when
 * only one engine is on stage. See `deriveLayout` for the rule that picks it.
 */
export type ComparisonArrangement = "single" | "side-by-side" | "stacked";

/** Horizontal center of a span already expressed in world coordinates. */
function centerXOf(bounds: SceneBounds): number {
  return (bounds.minX + bounds.maxX) / 2;
}

/**
 * The axis-aligned envelope of `bounds` after rotating it about the origin
 * (the crankshaft center) by `angleRad` — a cylinder's real footprint once it
 * has been tilted onto its bank (§24a).
 *
 * Rotating the four corners and re-enveloping them is deliberately generous:
 * the true rotated shape is a tilted rectangle, so its axis-aligned envelope
 * is at least as large. Framing and spacing computed from it can never clip or
 * overlap, which is the property that matters. For an unrotated cylinder
 * (`angleRad === 0`) it returns the original numbers untouched, so inline
 * layouts keep exactly the framing they had before banks existed.
 */
export function rotateBounds(
  bounds: SceneBounds,
  angleRad: number,
): SceneBounds {
  if (angleRad === 0) {
    return bounds;
  }

  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const xs: number[] = [];
  const ys: number[] = [];

  for (const x of [bounds.minX, bounds.maxX]) {
    for (const y of [bounds.minY, bounds.maxY]) {
      xs.push(x * cos - y * sin);
      ys.push(x * sin + y * cos);
    }
  }

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * Extra rotation applied to a flat/boxer engine when the "stand flat engines
 * upright" preference is on: a quarter turn, which takes a bank pointing along
 * ±X to one pointing along ±Y.
 */
export const UPRIGHT_FLAT_ROTATION_RAD = Math.PI / 2;

/**
 * **The** rule for how far a cylinder's whole drawing is rotated about its own
 * crankshaft center (§24a) — bore, piston, rod, crank, and reference marks
 * alike.
 *
 * This is the single place that decision is made, and every consumer goes
 * through it: the footprint each cylinder is measured by (`groupIntoThrows`,
 * which feeds row spacing and camera framing) and the rotation the renderer
 * applies (`PlacedCylinder.drawnRotationRad` → `CrankMechanism`). Drawn
 * orientation is a *presentation* concern and is deliberately kept separate
 * from the layout's real geometry: `CylinderDefinition.bankOffsetRad` in
 * `src/engine/` always describes the real engine, whatever this returns, and
 * neither of the two adjustments below touches the kinematics — every cylinder
 * is still driven at `cylinderCrankAngleRad(θ, cylinder)`.
 *
 * Two deliberate departures from the real bank offset:
 *
 * - **Single-cylinder view draws the cylinder upright, whatever the layout.**
 *   Not a bug: that view already isolates one cylinder from its engine, so the
 *   cylinder's *installed orientation* is not the subject — its proportions
 *   are. Drawing a boxer's cylinder 0 lying on its side and a V8's tilted made
 *   comparing cylinder *size* between two engines needlessly hard, especially
 *   in comparison mode, where the two would sit next to each other in
 *   different orientations. The full-engine view keeps every real orientation.
 * - **`uprightFlatEngines` stands a flat/boxer engine on end** in the
 *   full-engine view, by adding a quarter turn to *every* cylinder's rotation.
 *   Bank 0 (`−π/2`) then points +Y and bank 1 (`+π/2`) points −Y, so an
 *   opposed pair has one piston above the crank and its partner below —
 *   still one crank, still 180° opposed — and its pistons move in the same
 *   vertical direction as every other engine's. Because the whole pair turns
 *   by the same angle, the pair's pin geometry is untouched: `sharesCrankpin`
 *   and the one-crank-per-throw decision are facts about the engine and read
 *   the real `bankOffsetRad`, never this. V and inline layouts ignore the
 *   preference entirely.
 */
export function drawnRotationRad(
  cylinder: CylinderDefinition,
  kind: EngineLayoutKind,
  singleCylinderView: boolean,
  uprightFlatEngines: boolean,
): number {
  if (singleCylinderView) {
    return 0;
  }
  if (uprightFlatEngines && kind === "flat") {
    return cylinder.bankOffsetRad + UPRIGHT_FLAT_ROTATION_RAD;
  }
  return cylinder.bankOffsetRad;
}

/** One cylinder of a measured row: its definition and its rotated footprint. */
interface MeasuredCylinder {
  definition: CylinderDefinition;
  /** What `drawnRotationRad` decided for it; becomes the placed cylinder's. */
  drawnRotationRad: number;
  bounds: SceneBounds;
  /**
   * Position within its slot: 0 for the cylinder that owns the plane, 1 for the
   * partner drawn behind it. Becomes `offsetZMm` once proportions are known.
   */
  slotPosition: number;
  drawsCrank: boolean;
}

/**
 * One slot of a measured row — one crank center, one cutaway plane (§24a).
 *
 * Holds one cylinder for an inline or single layout and the two cylinders of a
 * throw pair for a V or flat one. Its bounds are the union of its cylinders'
 * rotated footprints, which is what both the row spacing and the camera framing
 * are derived from: a V pair's two tilted mechanisms occupy one slot between
 * them, so a V8 needs four slots rather than eight.
 */
interface MeasuredThrow {
  cylinders: readonly MeasuredCylinder[];
  bounds: SceneBounds;
}

/** An engine's row, measured but not yet positioned on the stage. */
interface MeasuredRow {
  config: CrankMechanismConfig;
  /** The architecture measured, carried through to `PlacedEngine.layout`. */
  layout: EngineLayoutDefinition;
  proportions: MechanismProportions;
  throws: readonly MeasuredThrow[];
  /** How many cylinders are on stage, across every slot. */
  cylinderCount: number;
  /** Distance between adjacent crankshaft centers. */
  spacingMm: number;
  /** Left edge of slot 0 to right edge of the last slot. */
  widthMm: number;
  /** Leftmost reach of the row, relative to slot 0's crankshaft center. */
  leftReachMm: number;
  minYMm: number;
  maxYMm: number;
}

/** How far a row reaches either side of slot 0 at a given spacing. */
interface RowExtents {
  leftReachMm: number;
  widthMm: number;
}

/**
 * A row's horizontal extents at an arbitrary slot spacing, relative to slot 0's
 * crankshaft center.
 *
 * Spacing is normally the row's own (`MeasuredRow.spacingMm`), but a stacked
 * comparison drives both rows at one shared spacing so corresponding slots line
 * up in columns, and then neither row's own extents apply.
 */
function rowExtentsAt(
  throws: readonly MeasuredThrow[],
  spacingMm: number,
): RowExtents {
  const lefts = throws.map((t, i) => i * spacingMm + t.bounds.minX);
  const rights = throws.map((t, i) => i * spacingMm + t.bounds.maxX);
  const leftReachMm = Math.min(...lefts);
  return { leftReachMm, widthMm: Math.max(...rights) - leftReachMm };
}

/**
 * Groups an engine's visible cylinders into the slots the row draws them in
 * (§24a): one cylinder per slot for inline and single layouts, and the pair
 * `2k` / `2k+1` in slot `k` for V and flat layouts, whose cylinder order
 * already alternates banks.
 *
 * Grouping by *position in the visible list* rather than by `index` keeps the
 * single-cylinder view working: it shows cylinder 0 alone, which is then the
 * only occupant of the only slot, exactly as an inline cylinder would be.
 */
function groupIntoThrows(
  definitions: readonly CylinderDefinition[],
  kind: EngineLayoutKind,
  proportions: MechanismProportions,
  singleCylinderView: boolean,
  uprightFlatEngines: boolean,
): MeasuredThrow[] {
  const paired = kind === "v" || kind === "flat";
  const perThrow = paired ? 2 : 1;
  const throws: MeasuredThrow[] = [];

  for (let start = 0; start < definitions.length; start += perThrow) {
    const group = definitions.slice(start, start + perThrow);
    const cylinders: MeasuredCylinder[] = group.map((definition, position) => {
      // One rule, one call: the footprint a cylinder is measured by is the
      // footprint of the rotation it will actually be drawn at.
      const rotationRad = drawnRotationRad(
        definition,
        kind,
        singleCylinderView,
        uprightFlatEngines,
      );
      return {
        definition,
        drawnRotationRad: rotationRad,
        bounds: rotateBounds(proportions.bounds, rotationRad),
        slotPosition: position,
        // A cylinder draws its own crank unless one already drawn in this slot
        // would coincide with it at every crank angle. That is a question about
        // the pins, not about the layout kind: a plain-pin V pair shares one, a
        // flying-arm V and a boxer each have two real ones. It reads the real
        // `bankOffsetRad` through `sharesCrankpin`, never the drawn rotation:
        // whether a pair shares a pin is a fact about the engine, and both
        // cylinders of a pair are rotated equally anyway.
        drawsCrank: !group.some(
          (earlier, j) => j < position && sharesCrankpin(earlier, definition),
        ),
      };
    });

    throws.push({
      cylinders,
      bounds: unionBounds(cylinders.map((c) => c.bounds)),
    });
  }

  return throws;
}

/** Axis-aligned envelope of several extents. */
function unionBounds(all: readonly SceneBounds[]): SceneBounds {
  return {
    minX: Math.min(...all.map((b) => b.minX)),
    maxX: Math.max(...all.map((b) => b.maxX)),
    minY: Math.min(...all.map((b) => b.minY)),
    maxY: Math.max(...all.map((b) => b.maxY)),
  };
}

/**
 * Measures one engine as a row of slots — one per cylinder for an inline or
 * single layout, one per **throw** for a V or flat one, each slot's cylinders
 * tilted onto their own banks around one shared crank center (§24a).
 *
 * The layout — phases, bank indices, and bank offsets — comes from
 * `createEngineLayout`, which returns a shared frozen instance; the scene
 * never invents crank phases of its own (§24).
 *
 * Drawing a V's two banks in one plane is what makes it read as a V: the
 * alternative — a plane per cylinder — makes a V8 eight units wide and
 * stubbornly short, so the shared zoom goes width-constrained and the engine is
 * drawn tiny with the vertical space empty. Four V-shaped slots use both axes
 * and halve the row.
 *
 * Spacing is derived from the widest reach any *slot* of this engine has to
 * either side of its crank center, so a V8's paired tilts and a flat engine's
 * opposed bores get the room they actually occupy. It stays a fraction of the
 * engine's own size, so a big-bore engine spaces its slots proportionally
 * further apart and the row keeps the same visual density at every size. For an
 * upright single cylinder this reduces exactly to the old
 * `width * (1 + INLINE_GAP_FRACTION)`, which is what keeps the one-cylinder
 * framing identical to what it was before rows existed — and for any inline
 * layout it reduces to exactly the per-cylinder spacing it had before throws
 * existed, since each slot is then one cylinder.
 */
function measureRow(
  config: CrankMechanismConfig,
  layoutId: EngineLayoutId,
  singleCylinderView: boolean,
  uprightFlatEngines: boolean,
): MeasuredRow {
  const proportions = deriveProportions(config);
  const layout = createEngineLayout(layoutId);
  // Which cylinders are on stage is decided in exactly one place, in the
  // engine layer (§24a) — the scene never re-derives it from the view flag.
  const definitions = visibleCylinders(layout, singleCylinderView);
  // How each of them is *rotated* is decided in exactly one place too, in
  // `drawnRotationRad`, which `groupIntoThrows` calls per cylinder.
  const throws = groupIntoThrows(
    definitions,
    layout.kind,
    proportions,
    singleCylinderView,
    uprightFlatEngines,
  );

  // Uniform spacing, sized so the widest right-hand reach clears the widest
  // left-hand reach whichever two slots end up adjacent.
  const rightReach = Math.max(...throws.map((t) => t.bounds.maxX));
  const leftReach = Math.max(...throws.map((t) => -t.bounds.minX));
  const spacingMm = (rightReach + leftReach) * (1 + INLINE_GAP_FRACTION);

  return {
    config,
    layout,
    proportions,
    throws,
    cylinderCount: definitions.length,
    spacingMm,
    ...rowExtentsAt(throws, spacingMm),
    minYMm: Math.min(...throws.map((t) => t.bounds.minY)),
    maxYMm: Math.max(...throws.map((t) => t.bounds.maxY)),
  };
}

/** A row of cylinders placed on the stage, with its world extents. */
interface PlacedRow {
  cylinders: PlacedCylinder[];
  bounds: SceneBounds;
}

/**
 * Positions a measured row so its left edge lands on `leftXMm` and its
 * crankshaft centerline on `centerYMm`, and returns the placed cylinders plus
 * the row's world extents.
 *
 * A slot's own bounds are relative to its crankshaft center, so the first crank
 * center sits at `leftXMm - leftReachMm` and each subsequent one is a fixed
 * spacing further right. Both cylinders of a throw pair take that one X, which
 * is what draws them around a single crank center.
 *
 * `spacingMm` is normally the row's own; a stacked comparison passes one
 * shared spacing for both rows so that slot *i* of each engine lands on the
 * same X (see `deriveLayout`), and `extents` must then be measured at that
 * spacing rather than read off the row.
 */
function placeRow(
  row: MeasuredRow,
  leftXMm: number,
  spacingMm: number = row.spacingMm,
  centerYMm = 0,
  extents: RowExtents = row,
): PlacedRow {
  const firstCenterX = leftXMm - extents.leftReachMm;
  // Half a rod thickness per step behind the slot's first cylinder: enough to
  // break every coincident face, small enough to leave the depth order of the
  // drawn parts alone. See `PlacedCylinder.offsetZMm`.
  const zStepMm = row.proportions.rodDepthMm / 2;

  return {
    cylinders: row.throws.flatMap((measured, throwIndex) =>
      measured.cylinders.map((cylinder) => ({
        ...cylinder.definition,
        throwIndex,
        bounds: cylinder.bounds,
        drawnRotationRad: cylinder.drawnRotationRad,
        drawsCrank: cylinder.drawsCrank,
        offsetXMm: firstCenterX + throwIndex * spacingMm,
        offsetYMm: centerYMm,
        // Spelled out rather than multiplied, so the untouched first cylinder
        // of every slot gets a plain +0 and an inline row stays byte-identical.
        offsetZMm:
          cylinder.slotPosition === 0 ? 0 : -cylinder.slotPosition * zStepMm,
      })),
    ),
    bounds: {
      minX: leftXMm,
      maxX: leftXMm + extents.widthMm,
      minY: centerYMm + row.minYMm,
      maxY: centerYMm + row.maxYMm,
    },
  };
}

/** Where the rows ended up, plus everything the label pass needs. */
interface StagePlacement {
  placedA: PlacedRow;
  placedB: PlacedRow | null;
  /** Union of the placed rows, before any label band is reserved. */
  content: SceneBounds;
  /** Baseline for engine A's label; only meaningful when labels are shown. */
  labelAnchorYA: number;
  /** Baseline for engine B's label. Equals A's unless the pair is stacked. */
  labelAnchorYB: number;
  /** Framed bottom once the label band(s) below the engines are reserved. */
  labelledMinY: number;
}

/**
 * The classic arrangement: one row centered on x = 0, or a pair laid out left
 * to right with the comparison gap between them, the pair itself centered.
 *
 * Both rows keep their crankshaft centerlines on y = 0, and both labels share
 * one baseline taken from the union — so a tall engine beside a short one
 * still gets labels that line up.
 */
function placeSideBySide(
  rowA: MeasuredRow,
  rowB: MeasuredRow | null,
): StagePlacement {
  const gap = rowB
    ? (COMPARISON_GAP_FRACTION * (rowA.widthMm + rowB.widthMm)) / 2
    : 0;
  const totalWidth = rowB ? rowA.widthMm + gap + rowB.widthMm : rowA.widthMm;
  const leftA = -totalWidth / 2;
  const leftB = leftA + rowA.widthMm + gap;

  const placedA = placeRow(rowA, leftA);
  const placedB = rowB ? placeRow(rowB, leftB) : null;

  const content: SceneBounds = placedB
    ? {
        minX: placedA.bounds.minX,
        maxX: placedB.bounds.maxX,
        minY: Math.min(placedA.bounds.minY, placedB.bounds.minY),
        maxY: Math.max(placedA.bounds.maxY, placedB.bounds.maxY),
      }
    : placedA.bounds;

  const contentHeight = content.maxY - content.minY;
  const labelGap = LABEL_GAP_FRACTION * contentHeight;
  const labelBand = LABEL_BAND_FRACTION * contentHeight;
  // Labels are centered on this anchor, so the band spans half above and half
  // below it and the reserved space is exactly the band.
  const anchorY = content.minY - labelGap - labelBand / 2;

  return {
    placedA,
    placedB,
    content,
    labelAnchorYA: anchorY,
    labelAnchorYB: anchorY,
    labelledMinY: content.minY - labelGap - labelBand,
  };
}

/**
 * Engine A above engine B, for a comparison where either side is showing more
 * than one cylinder (§24a).
 *
 * Two multi-cylinder engines placed left to right force the camera to fit a
 * dozen cylinders across, shrinking both, and they push cylinder 1 of A as far
 * as possible from cylinder 1 of B — the comparison a viewer actually wants.
 * Stacking fixes both: the rows are driven at **one shared slot spacing** (the
 * wider of the two, so neither engine's slots can collide) and share one slot-0
 * crank center, which puts corresponding slots in vertical columns. The columns
 * are throws, not cylinders (§24a), so a V8 stacked over an inline-6 lines its
 * four V units up with the first four of the six.
 *
 * The zoom is still shared and no engine is ever rescaled (§12.2) — only the
 * axis of arrangement changes, so a big engine still visibly towers over a
 * small one, now directly above or below it.
 *
 * Each engine keeps its own label, under its own row: A's sits in the gap
 * between the two engines, B's below the stage. The vertical separation
 * therefore grows by exactly the reserved band when labels are shown, which is
 * what keeps A's label clear of B's cylinder heads. Band sizing follows the
 * side-by-side rule — a fraction of the staged content's height — measured on
 * the unlabelled stack, so the two are not defined in terms of each other.
 */
function placeStacked(
  rowA: MeasuredRow,
  rowB: MeasuredRow,
  showLabels: boolean,
): StagePlacement {
  // One spacing for both rows, wide enough for whichever engine needs more
  // room, so column i of A sits directly above column i of B.
  const spacingMm = Math.max(rowA.spacingMm, rowB.spacingMm);
  const extentsA = rowExtentsAt(rowA.throws, spacingMm);
  const extentsB = rowExtentsAt(rowB.throws, spacingMm);

  // Shared slot-0 crank center, chosen so the union of the two rows is
  // centered on x = 0 — the same centering the side-by-side pair gets.
  const unionLeft = Math.min(extentsA.leftReachMm, extentsB.leftReachMm);
  const unionRight = Math.max(
    extentsA.leftReachMm + extentsA.widthMm,
    extentsB.leftReachMm + extentsB.widthMm,
  );
  const firstCenterXMm = -(unionLeft + unionRight) / 2;

  const heightA = rowA.maxYMm - rowA.minYMm;
  const heightB = rowB.maxYMm - rowB.minYMm;
  const verticalGap =
    (COMPARISON_VERTICAL_GAP_FRACTION * (heightA + heightB)) / 2;

  const stackHeight = heightA + verticalGap + heightB;
  const labelGap = LABEL_GAP_FRACTION * stackHeight;
  const labelBand = LABEL_BAND_FRACTION * stackHeight;
  const labelReserve = showLabels ? labelGap + labelBand : 0;

  // Engine A keeps its crankshaft on y = 0 — exactly where it sits with
  // comparison off — and engine B drops below it by the gap, plus the band
  // engine A's own label needs.
  const centerYB = rowA.minYMm - verticalGap - labelReserve - rowB.maxYMm;

  const placedA = placeRow(
    rowA,
    firstCenterXMm + extentsA.leftReachMm,
    spacingMm,
    0,
    extentsA,
  );
  const placedB = placeRow(
    rowB,
    firstCenterXMm + extentsB.leftReachMm,
    spacingMm,
    centerYB,
    extentsB,
  );

  const content: SceneBounds = {
    minX: Math.min(placedA.bounds.minX, placedB.bounds.minX),
    maxX: Math.max(placedA.bounds.maxX, placedB.bounds.maxX),
    minY: placedB.bounds.minY,
    maxY: placedA.bounds.maxY,
  };

  return {
    placedA,
    placedB,
    content,
    labelAnchorYA: placedA.bounds.minY - labelGap - labelBand / 2,
    labelAnchorYB: placedB.bounds.minY - labelGap - labelBand / 2,
    labelledMinY: placedB.bounds.minY - labelGap - labelBand,
  };
}

/**
 * Places one or two engines on the stage and returns the union of their
 * extents for auto-framing.
 *
 * Each engine is a row of slots (`singleCylinderView` picks one cylinder or the
 * whole engine, §24a) laid left to right in crankshaft order, all at the same
 * scale (§24), each cylinder rotated by whatever `drawnRotationRad` decides for
 * it — its real bank tilt, except where the single-cylinder view or
 * `uprightFlatEngines` deliberately overrides it. A slot is one cylinder
 * for an inline or single layout and one throw — both of its cylinders, around
 * one crank center — for a V or flat one, which is what makes a V8 four
 * V-shaped units rather than eight separate mechanisms. A single engine's row
 * is centered on x = 0 — which for one cylinder is exactly where it sat before
 * multi-cylinder layouts existed, since an upright cylinder's bounds are
 * symmetric about its crank center.
 *
 * A comparison pair is arranged along whichever axis reads better:
 *
 * - **Side by side** when both engines are showing exactly one cylinder. A
 *   lone mechanism is tall and narrow and reads best beside its twin, and this
 *   is the arrangement — down to the arithmetic — that comparison has always
 *   used.
 * - **Stacked**, A above B, as soon as either side shows more than one. See
 *   `placeStacked` for why.
 *
 * Either way both engines stay at one shared zoom: only the axis changes, and
 * no mechanism is ever scaled to fit (§12.2).
 *
 * When `showLabels` is set, a band is reserved below the mechanisms for their
 * name labels and included in the returned bounds, so auto-framing keeps the
 * labels on screen at every configuration. One label sits centered under each
 * engine's whole row.
 */
export function deriveLayout(
  config: CrankMechanismConfig,
  comparisonConfig: CrankMechanismConfig | null,
  showLabels = false,
  layoutId: EngineLayoutId = "single",
  comparisonLayoutId: EngineLayoutId = "single",
  singleCylinderView = false,
  comparisonSingleCylinderView = false,
  uprightFlatEngines = false,
): SceneLayout {
  const rowA = measureRow(
    config,
    layoutId,
    singleCylinderView,
    uprightFlatEngines,
  );
  const rowB = comparisonConfig
    ? measureRow(
        comparisonConfig,
        comparisonLayoutId,
        comparisonSingleCylinderView,
        uprightFlatEngines,
      )
    : null;

  const arrangement: ComparisonArrangement =
    rowB === null
      ? "single"
      : rowA.cylinderCount > 1 || rowB.cylinderCount > 1
        ? "stacked"
        : "side-by-side";

  const placement =
    arrangement === "stacked"
      ? placeStacked(rowA, rowB as MeasuredRow, showLabels)
      : placeSideBySide(rowA, rowB);
  const { placedA, placedB, content } = placement;

  if (!showLabels) {
    return {
      arrangement,
      primary: { ...rowAsEngine(rowA, placedA), label: null },
      secondary:
        rowB && placedB ? { ...rowAsEngine(rowB, placedB), label: null } : null,
      bounds: content,
    };
  }

  const comparing = rowB !== null;

  return {
    arrangement,
    primary: {
      ...rowAsEngine(rowA, placedA),
      label: {
        slot: comparing ? "A" : null,
        name: describeConfig(rowA.config),
        anchorXMm: centerXOf(placedA.bounds),
        anchorYMm: placement.labelAnchorYA,
      },
    },
    secondary:
      rowB && placedB
        ? {
            ...rowAsEngine(rowB, placedB),
            label: {
              slot: "B",
              name: describeConfig(rowB.config),
              anchorXMm: centerXOf(placedB.bounds),
              anchorYMm: placement.labelAnchorYB,
            },
          }
        : null,
    bounds: {
      ...content,
      minY: placement.labelledMinY,
    },
  };
}

/** Joins a measured row with its placement, less the label the caller adds. */
function rowAsEngine(
  row: MeasuredRow,
  placed: PlacedRow,
): Omit<PlacedEngine, "label"> {
  return {
    config: row.config,
    layout: row.layout,
    proportions: row.proportions,
    cylinders: placed.cylinders,
    bounds: placed.bounds,
  };
}

/**
 * Subscribes to both engine configurations, both layouts, both cylinder-view
 * preferences, and the label and flat-upright preferences, and memoizes the
 * stage layout. This is the single store subscriber for stage placement:
 * recomputed only when a configuration, layout, or view changes, comparison is
 * toggled, or one of those preferences is switched — never per frame.
 */
export function useSceneLayout(): SceneLayout {
  const config = useEngineStore((s) => s.config);
  const comparisonConfig = useEngineStore((s) => s.comparisonConfig);
  const layoutId = useEngineStore((s) => s.layoutId);
  const comparisonLayoutId = useEngineStore((s) => s.comparisonLayoutId);
  const singleCylinderView = useEngineStore((s) => s.singleCylinderView);
  const comparisonSingleCylinderView = useEngineStore(
    (s) => s.comparisonSingleCylinderView,
  );
  const showLabels = useEngineStore((s) => s.preferences.showLabels);
  const uprightFlatEngines = useEngineStore(
    (s) => s.preferences.uprightFlatEngines,
  );
  return useMemo(
    () =>
      deriveLayout(
        config,
        comparisonConfig,
        showLabels,
        layoutId,
        comparisonLayoutId,
        singleCylinderView,
        comparisonSingleCylinderView,
        uprightFlatEngines,
      ),
    [
      config,
      comparisonConfig,
      showLabels,
      layoutId,
      comparisonLayoutId,
      singleCylinderView,
      comparisonSingleCylinderView,
      uprightFlatEngines,
    ],
  );
}
