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

    bounds: {
      maxX: Math.max(
        markerInnerX + markerLength,
        r + crankWebWidth / 2,
        counterweightWidth / 2,
      ),
      minX: -Math.max(
        markerInnerX + markerLength,
        r + crankWebWidth / 2,
        counterweightWidth / 2,
      ),
      // The top of the deck, which now rides on the clearance height: a low
      // compression ratio pushes the head up and the camera frames wider.
      maxY: wallTop + deckThickness,
      minY: -(crankExtentY + 0.06 * bore),
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

/** One mechanism placed on the stage. */
export interface PlacedMechanism {
  config: CrankMechanismConfig;
  proportions: MechanismProportions;
  /** X offset of this mechanism's crankshaft center, in scene millimeters. */
  offsetXMm: number;
  /** Its name label, or null when labels are hidden. */
  label: LabelPlacement | null;
}

/**
 * Where each mechanism sits and what the camera must frame.
 *
 * Both engines are drawn at the same scale — 1 scene unit is 1 mm for
 * everything — so a large engine genuinely towers over a small one. Only the
 * offsets differ; neither mechanism is ever scaled to fit.
 */
export interface SceneLayout {
  /** Engine A, on the left when a comparison is shown. */
  primary: PlacedMechanism;
  /** Engine B, on the right, or null when comparison is off. */
  secondary: PlacedMechanism | null;
  /** Union of every placed mechanism's extents, in world coordinates. */
  bounds: SceneBounds;
}

function widthOf(bounds: SceneBounds): number {
  return bounds.maxX - bounds.minX;
}

/** Horizontal center of a mechanism's own bounds, once offset onto the stage. */
function centerXOf(proportions: MechanismProportions, offsetXMm: number) {
  return offsetXMm + (proportions.bounds.minX + proportions.bounds.maxX) / 2;
}

/**
 * Places one or two mechanisms side by side and returns the union of their
 * extents for auto-framing.
 *
 * With a comparison engine, the pair is laid out left to right — A then a gap
 * proportional to their mean width, then B — and centered on x = 0, so the
 * camera position does not have to move laterally when comparison toggles.
 *
 * When `showLabels` is set, a band is reserved below the mechanisms for their
 * name labels and included in the returned bounds, so auto-framing keeps the
 * labels on screen at every configuration. Both labels share one baseline —
 * taken from the union, not from each engine separately — so a tall engine
 * beside a short one still gets labels that line up.
 */
export function deriveLayout(
  config: CrankMechanismConfig,
  comparisonConfig: CrankMechanismConfig | null,
  showLabels = false,
): SceneLayout {
  const proportions = deriveProportions(config);
  const comparisonProportions = comparisonConfig
    ? deriveProportions(comparisonConfig)
    : null;

  let offsetA = 0;
  let offsetB = 0;
  let content: SceneBounds = proportions.bounds;

  if (comparisonProportions) {
    const widthA = widthOf(proportions.bounds);
    const widthB = widthOf(comparisonProportions.bounds);
    const gap = (COMPARISON_GAP_FRACTION * (widthA + widthB)) / 2;
    const total = widthA + gap + widthB;
    const left = -total / 2;

    // Each mechanism's own bounds are relative to its crankshaft center, so
    // the offset is whatever puts its left edge at the intended position.
    offsetA = left - proportions.bounds.minX;
    offsetB = left + widthA + gap - comparisonProportions.bounds.minX;

    content = {
      minX: left,
      maxX: left + total,
      minY: Math.min(
        proportions.bounds.minY,
        comparisonProportions.bounds.minY,
      ),
      maxY: Math.max(
        proportions.bounds.maxY,
        comparisonProportions.bounds.maxY,
      ),
    };
  }

  const placedSecondary =
    comparisonConfig && comparisonProportions
      ? {
          config: comparisonConfig,
          proportions: comparisonProportions,
          offsetXMm: offsetB,
        }
      : null;

  if (!showLabels) {
    return {
      primary: { config, proportions, offsetXMm: offsetA, label: null },
      secondary: placedSecondary ? { ...placedSecondary, label: null } : null,
      bounds: content,
    };
  }

  const contentHeight = content.maxY - content.minY;
  const labelGap = LABEL_GAP_FRACTION * contentHeight;
  const labelBand = LABEL_BAND_FRACTION * contentHeight;
  // Labels are centered on this anchor, so the band spans half above and half
  // below it and the reserved space is exactly the band.
  const anchorY = content.minY - labelGap - labelBand / 2;
  const comparing = comparisonProportions !== null;

  return {
    primary: {
      config,
      proportions,
      offsetXMm: offsetA,
      label: {
        slot: comparing ? "A" : null,
        name: describeConfig(config),
        anchorXMm: centerXOf(proportions, offsetA),
        anchorYMm: anchorY,
      },
    },
    secondary: placedSecondary
      ? {
          ...placedSecondary,
          label: {
            slot: "B",
            name: describeConfig(placedSecondary.config),
            anchorXMm: centerXOf(placedSecondary.proportions, offsetB),
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

/**
 * Subscribes to both engine configurations and the label preference, and
 * memoizes the stage layout. Recomputed only when a configuration changes,
 * comparison is toggled, or labels are shown or hidden — never per frame.
 */
export function useSceneLayout(): SceneLayout {
  const config = useEngineStore((s) => s.config);
  const comparisonConfig = useEngineStore((s) => s.comparisonConfig);
  const showLabels = useEngineStore((s) => s.preferences.showLabels);
  return useMemo(
    () => deriveLayout(config, comparisonConfig, showLabels),
    [config, comparisonConfig, showLabels],
  );
}
