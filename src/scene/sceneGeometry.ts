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

  /** Static extents used to auto-frame the orthographic camera (§12.2). */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
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

/**
 * Subscribes to the configured engine dimensions and memoizes the derived
 * part sizes, so Three.js geometry is rebuilt only when a dimension actually
 * changes — never on an animation frame (§18).
 */
export function useMechanismProportions(): MechanismProportions {
  const config = useEngineStore((s) => s.config);
  return useMemo(() => deriveProportions(config), [config]);
}
