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
import { createEngineLayout } from "../engine/engineLayout";
import type {
  CylinderDefinition,
  SupportedCylinderCount,
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
 * Gap between adjacent cylinders of one engine, as a fraction of a single
 * cylinder's bounds width (§24).
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
 */
export interface PlacedCylinder extends CylinderDefinition {
  /** X of this cylinder's crankshaft center on the stage, scene millimeters. */
  offsetXMm: number;
}

/** One engine — a row of one or more identical cylinders — on the stage. */
export interface PlacedEngine {
  config: CrankMechanismConfig;
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
  /** Engine A, on the left when a comparison is shown. */
  primary: PlacedEngine;
  /** Engine B, on the right, or null when comparison is off. */
  secondary: PlacedEngine | null;
  /** Union of every placed engine's extents, in world coordinates. */
  bounds: SceneBounds;
}

function widthOf(bounds: SceneBounds): number {
  return bounds.maxX - bounds.minX;
}

/** Horizontal center of a span already expressed in world coordinates. */
function centerXOf(bounds: SceneBounds): number {
  return (bounds.minX + bounds.maxX) / 2;
}

/** An engine's row, measured but not yet positioned on the stage. */
interface MeasuredRow {
  config: CrankMechanismConfig;
  proportions: MechanismProportions;
  cylinders: readonly CylinderDefinition[];
  /** Distance between adjacent crankshaft centers. */
  spacingMm: number;
  /** Left edge of cylinder 0 to right edge of the last cylinder. */
  widthMm: number;
}

/**
 * Measures one engine as a row of `cylinderCount` identical cylinders.
 *
 * The phase table comes from `createEngineLayout`, which returns a shared
 * frozen layout — the scene never invents crank phases of its own (§24).
 * Spacing is a fraction of one cylinder's own width, so a big-bore engine
 * spaces its cylinders proportionally further apart and the row keeps the same
 * visual density at every size. A single cylinder measures exactly its own
 * bounds width, which is what keeps the one-cylinder framing identical to what
 * it was before rows existed.
 */
function measureRow(
  config: CrankMechanismConfig,
  cylinderCount: SupportedCylinderCount,
): MeasuredRow {
  const proportions = deriveProportions(config);
  const { cylinders } = createEngineLayout(cylinderCount);
  const cylinderWidth = widthOf(proportions.bounds);
  const spacingMm = cylinderWidth * (1 + INLINE_GAP_FRACTION);

  return {
    config,
    proportions,
    cylinders,
    spacingMm,
    widthMm: cylinderWidth + (cylinders.length - 1) * spacingMm,
  };
}

/**
 * Positions a measured row so its left edge lands on `leftXMm`, and returns
 * the placed cylinders plus the row's world extents.
 *
 * A cylinder's own bounds are relative to its crankshaft center, so the first
 * crank center sits at `leftXMm - bounds.minX` and each subsequent one is a
 * fixed spacing further right.
 */
function placeRow(
  row: MeasuredRow,
  leftXMm: number,
): { cylinders: PlacedCylinder[]; bounds: SceneBounds } {
  const firstCenterX = leftXMm - row.proportions.bounds.minX;

  return {
    cylinders: row.cylinders.map((cylinder) => ({
      ...cylinder,
      offsetXMm: firstCenterX + cylinder.index * row.spacingMm,
    })),
    bounds: {
      minX: leftXMm,
      maxX: leftXMm + row.widthMm,
      minY: row.proportions.bounds.minY,
      maxY: row.proportions.bounds.maxY,
    },
  };
}

/**
 * Places one or two engines side by side and returns the union of their
 * extents for auto-framing.
 *
 * Each engine is a row of `cylinderCount` cylinders laid left to right in
 * crankshaft order, all at the same scale (§24). A single engine's row is
 * centered on x = 0 — which for one cylinder is exactly where it sat before
 * multi-cylinder layouts existed, since a cylinder's bounds are symmetric
 * about its crank center.
 *
 * With a comparison engine, the pair is laid out left to right — A then a gap
 * proportional to their mean *row* width, then B — and centered on x = 0, so
 * the camera position does not have to move laterally when comparison toggles.
 * Scaling the gap to row widths rather than single-cylinder widths is what
 * keeps two inline-sixes from looking crammed together.
 *
 * When `showLabels` is set, a band is reserved below the mechanisms for their
 * name labels and included in the returned bounds, so auto-framing keeps the
 * labels on screen at every configuration. One label sits centered under each
 * engine's whole row, and both labels share one baseline — taken from the
 * union, not from each engine separately — so a tall engine beside a short one
 * still gets labels that line up.
 */
export function deriveLayout(
  config: CrankMechanismConfig,
  comparisonConfig: CrankMechanismConfig | null,
  showLabels = false,
  cylinderCount: SupportedCylinderCount = 1,
  comparisonCylinderCount: SupportedCylinderCount = 1,
): SceneLayout {
  const rowA = measureRow(config, cylinderCount);
  const rowB = comparisonConfig
    ? measureRow(comparisonConfig, comparisonCylinderCount)
    : null;

  // A lone row is centered on x = 0; a pair is laid out left to right with the
  // comparison gap between them and the pair as a whole is centered instead.
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

  if (!showLabels) {
    return {
      primary: { ...rowAsEngine(rowA, placedA), label: null },
      secondary:
        rowB && placedB ? { ...rowAsEngine(rowB, placedB), label: null } : null,
      bounds: content,
    };
  }

  const contentHeight = content.maxY - content.minY;
  const labelGap = LABEL_GAP_FRACTION * contentHeight;
  const labelBand = LABEL_BAND_FRACTION * contentHeight;
  // Labels are centered on this anchor, so the band spans half above and half
  // below it and the reserved space is exactly the band.
  const anchorY = content.minY - labelGap - labelBand / 2;
  const comparing = rowB !== null;

  return {
    primary: {
      ...rowAsEngine(rowA, placedA),
      label: {
        slot: comparing ? "A" : null,
        name: describeConfig(rowA.config),
        anchorXMm: centerXOf(placedA.bounds),
        anchorYMm: anchorY,
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
              anchorYMm: anchorY,
            },
          }
        : null,
    bounds: {
      ...content,
      minY: content.minY - labelGap - labelBand,
    },
  };
}

/** Joins a measured row with its placement, less the label the caller adds. */
function rowAsEngine(
  row: MeasuredRow,
  placed: { cylinders: PlacedCylinder[]; bounds: SceneBounds },
): Omit<PlacedEngine, "label"> {
  return {
    config: row.config,
    proportions: row.proportions,
    cylinders: placed.cylinders,
    bounds: placed.bounds,
  };
}

/**
 * Subscribes to both engine configurations, both cylinder counts, and the
 * label preference, and memoizes the stage layout. This is the single store
 * subscriber for stage placement: recomputed only when a configuration or
 * cylinder count changes, comparison is toggled, or labels are shown or
 * hidden — never per frame.
 */
export function useSceneLayout(): SceneLayout {
  const config = useEngineStore((s) => s.config);
  const comparisonConfig = useEngineStore((s) => s.comparisonConfig);
  const cylinderCount = useEngineStore((s) => s.cylinderCount);
  const comparisonCylinderCount = useEngineStore(
    (s) => s.comparisonCylinderCount,
  );
  const showLabels = useEngineStore((s) => s.preferences.showLabels);
  return useMemo(
    () =>
      deriveLayout(
        config,
        comparisonConfig,
        showLabels,
        cylinderCount,
        comparisonCylinderCount,
      ),
    [
      config,
      comparisonConfig,
      showLabels,
      cylinderCount,
      comparisonCylinderCount,
    ],
  );
}
