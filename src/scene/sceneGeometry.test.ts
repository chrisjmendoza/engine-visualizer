/**
 * Verifies the static scene layout derived from a configuration: where the
 * cylinder head sits for a given compression ratio, and that the auto-framing
 * bounds contain everything the scene draws at the validated extremes.
 *
 * Pure arithmetic on `deriveProportions`, so it needs no WebGL.
 */

import { describe, expect, it } from "vitest";
import { calculateClearanceHeightMm } from "../engine/calculations";
import { DEFAULT_CONFIG, INPUT_RANGES } from "../engine/constants";
import type { CrankMechanismConfig } from "../engine/types";
import { deriveProportions } from "./sceneGeometry";

/** Geometry extremes that satisfy the `rodLength > stroke / 2` rule. */
const GEOMETRIES: Array<
  [string, Omit<CrankMechanismConfig, "compressionRatio">]
> = [
  ["default", { boreMm: 86, strokeMm: 86, rodLengthMm: 143 }],
  ["smallest", { boreMm: 20, strokeMm: 20, rodLengthMm: 30 }],
  ["largest", { boreMm: 200, strokeMm: 200, rodLengthMm: 400 }],
  ["big bore, short stroke", { boreMm: 200, strokeMm: 20, rodLengthMm: 400 }],
  ["small bore, long stroke", { boreMm: 20, strokeMm: 200, rodLengthMm: 400 }],
  ["shortest usable rod", { boreMm: 200, strokeMm: 200, rodLengthMm: 101 }],
];

const COMPRESSION_RATIOS = [
  INPUT_RANGES.compressionRatio.min,
  8.5,
  DEFAULT_CONFIG.compressionRatio,
  13,
  INPUT_RANGES.compressionRatio.max,
];

function configFor(
  geometry: Omit<CrankMechanismConfig, "compressionRatio">,
  compressionRatio: number,
): CrankMechanismConfig {
  return { ...geometry, compressionRatio };
}

describe("deriveProportions — cylinder head placement", () => {
  it("puts the crown at TDC one crown height above the TDC piston pin", () => {
    const p = deriveProportions(DEFAULT_CONFIG);
    expect(p.crownAtTdcYMm).toBeCloseTo(
      p.tdcPinYMm + p.pistonCrownAbovePinMm,
      10,
    );
  });

  for (const [geometryName, geometry] of GEOMETRIES) {
    for (const compressionRatio of COMPRESSION_RATIOS) {
      it(`places the deck face exactly the clearance height above the crown (${geometryName}, ${compressionRatio}:1)`, () => {
        const config = configFor(geometry, compressionRatio);
        const p = deriveProportions(config);

        const expected = calculateClearanceHeightMm(
          config.strokeMm,
          config.compressionRatio,
        );

        expect(p.clearanceHeightMm).toBeCloseTo(expected, 10);
        expect(p.cylinderWallTopYMm).toBeCloseTo(
          p.crownAtTdcYMm + expected,
          10,
        );
      });
    }
  }

  it("lowers the head as the compression ratio rises", () => {
    const gaps = COMPRESSION_RATIOS.map(
      (cr) =>
        deriveProportions(configFor(GEOMETRIES[0][1], cr)).clearanceHeightMm,
    );
    const heads = COMPRESSION_RATIOS.map(
      (cr) =>
        deriveProportions(configFor(GEOMETRIES[0][1], cr)).cylinderWallTopYMm,
    );

    for (let i = 1; i < gaps.length; i += 1) {
      expect(gaps[i]).toBeLessThan(gaps[i - 1]);
      expect(heads[i]).toBeLessThan(heads[i - 1]);
    }
  });

  it("gives a 13:1 engine a visibly tighter clearance than an 8.5:1 engine", () => {
    const tight = deriveProportions(configFor(GEOMETRIES[0][1], 13));
    const loose = deriveProportions(configFor(GEOMETRIES[0][1], 8.5));

    expect(tight.clearanceHeightMm).toBeLessThan(loose.clearanceHeightMm);
    // Same mechanism, so only the head moved.
    expect(tight.crownAtTdcYMm).toBeCloseTo(loose.crownAtTdcYMm, 10);
    expect(loose.cylinderWallTopYMm - tight.cylinderWallTopYMm).toBeCloseTo(
      loose.clearanceHeightMm - tight.clearanceHeightMm,
      10,
    );
  });

  it("runs the bore walls from below the skirt up to the deck face", () => {
    for (const [, geometry] of GEOMETRIES) {
      for (const compressionRatio of COMPRESSION_RATIOS) {
        const p = deriveProportions(configFor(geometry, compressionRatio));

        expect(p.cylinderWallBottomYMm).toBeLessThan(p.crownAtTdcYMm);
        expect(p.cylinderWallTopYMm).toBeGreaterThan(p.crownAtTdcYMm);
        // The walls must not reach down into the crank circle.
        expect(p.cylinderWallBottomYMm).toBeGreaterThanOrEqual(p.crankRadiusMm);
      }
    }
  });

  it("keeps the head face plate inside the clearance volume", () => {
    for (const [, geometry] of GEOMETRIES) {
      for (const compressionRatio of COMPRESSION_RATIOS) {
        const p = deriveProportions(configFor(geometry, compressionRatio));

        expect(p.headFaceThicknessMm).toBeGreaterThan(0);
        expect(p.headFaceThicknessMm).toBeLessThan(p.clearanceHeightMm);
        // Its underside stays above the piston crown at TDC.
        expect(p.cylinderWallTopYMm - p.headFaceThicknessMm).toBeGreaterThan(
          p.crownAtTdcYMm,
        );
      }
    }
  });
});

describe("deriveProportions — auto-framing bounds", () => {
  for (const [geometryName, geometry] of GEOMETRIES) {
    for (const compressionRatio of COMPRESSION_RATIOS) {
      it(`contains every drawn feature (${geometryName}, ${compressionRatio}:1)`, () => {
        const p = deriveProportions(configFor(geometry, compressionRatio));
        const { bounds } = p;

        for (const value of [
          bounds.minX,
          bounds.maxX,
          bounds.minY,
          bounds.maxY,
        ]) {
          expect(Number.isFinite(value)).toBe(true);
        }
        expect(bounds.maxX).toBeGreaterThan(bounds.minX);
        expect(bounds.maxY).toBeGreaterThan(bounds.minY);

        // Top: the deck above the clearance volume, which rides on the
        // compression ratio, plus everything below it.
        const deckTop = p.cylinderWallTopYMm + p.deckThicknessMm;
        expect(bounds.maxY).toBeGreaterThanOrEqual(deckTop);
        expect(bounds.maxY).toBeGreaterThan(p.crownAtTdcYMm);
        expect(bounds.maxY).toBeGreaterThan(p.tdcPinYMm);

        // Bottom: below the crank circle and the counterweight.
        expect(bounds.minY).toBeLessThan(-p.crankRadiusMm);
        expect(bounds.minY).toBeLessThan(
          p.counterweightCenterYMm - p.counterweightHeightMm / 2,
        );

        // Sides: the bore walls, the TDC/BDC ticks outboard of them, and the
        // crank throw's sweep.
        const markerTip = p.markerInnerXMm + p.markerLengthMm;
        expect(bounds.maxX).toBeGreaterThanOrEqual(markerTip);
        expect(bounds.minX).toBeLessThanOrEqual(-markerTip);
        expect(bounds.maxX).toBeGreaterThanOrEqual(
          p.crankRadiusMm + p.crankWebWidthMm / 2,
        );
        expect(bounds.maxX).toBeGreaterThanOrEqual(p.counterweightWidthMm / 2);
      });
    }
  }

  it("frames taller when the compression ratio drops", () => {
    const high = deriveProportions(configFor(GEOMETRIES[0][1], 20));
    const low = deriveProportions(configFor(GEOMETRIES[0][1], 5));

    expect(low.bounds.maxY).toBeGreaterThan(high.bounds.maxY);
    expect(low.bounds.minY).toBeCloseTo(high.bounds.minY, 10);
  });

  it("survives a degenerate compression ratio without producing NaN", () => {
    const p = deriveProportions({ ...DEFAULT_CONFIG, compressionRatio: 1 });

    expect(Number.isFinite(p.clearanceHeightMm)).toBe(true);
    expect(Number.isFinite(p.bounds.maxY)).toBe(true);
    expect(p.cylinderWallTopYMm).toBeGreaterThan(p.crownAtTdcYMm);
  });
});
