/**
 * Verifies the static scene layout derived from the configurations: where the
 * cylinder head sits for a given compression ratio, how a comparison pair is
 * placed side by side, and that the auto-framing bounds contain everything the
 * scene draws at the validated extremes.
 *
 * Pure arithmetic on `deriveProportions` and `deriveLayout`, so it needs no
 * WebGL.
 */

import { describe, expect, it } from "vitest";
import { calculateClearanceHeightMm } from "../engine/calculations";
import { DEFAULT_CONFIG, INPUT_RANGES } from "../engine/constants";
import type { CrankMechanismConfig } from "../engine/types";
import { ENGINE_PRESETS } from "../engine/presets";
import { CUSTOM_ENGINE_LABEL } from "./mechanismLabels";
import {
  COMPARISON_GAP_FRACTION,
  LABEL_BAND_FRACTION,
  LABEL_GAP_FRACTION,
  deriveLayout,
  deriveProportions,
} from "./sceneGeometry";
import type { PlacedMechanism, SceneBounds } from "./sceneGeometry";

/** Geometry extremes that satisfy the `rodLength > stroke / 2` rule. */
const GEOMETRIES: Array<
  [string, Omit<CrankMechanismConfig, "compressionRatio" | "redlineRpm">]
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
  geometry: Omit<CrankMechanismConfig, "compressionRatio" | "redlineRpm">,
  compressionRatio: number,
): CrankMechanismConfig {
  return {
    ...geometry,
    compressionRatio,
    redlineRpm: DEFAULT_CONFIG.redlineRpm,
  };
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

/** A large-displacement V8 cylinder and a small four-cylinder's cylinder. */
const LS7: CrankMechanismConfig = {
  boreMm: 104.8,
  strokeMm: 101.6,
  rodLengthMm: 168.15,
  compressionRatio: 11,
  redlineRpm: 7000,
};

const B6_1_6: CrankMechanismConfig = {
  boreMm: 78,
  strokeMm: 83.6,
  rodLengthMm: 133.4,
  compressionRatio: 9.4,
  redlineRpm: 7000,
};

/** World-space extents of a placed mechanism. */
function worldBounds(placed: PlacedMechanism): SceneBounds {
  const { bounds } = placed.proportions;
  return {
    minX: bounds.minX + placed.offsetXMm,
    maxX: bounds.maxX + placed.offsetXMm,
    minY: bounds.minY,
    maxY: bounds.maxY,
  };
}

describe("deriveLayout — single engine", () => {
  it("places one mechanism at the origin and frames its own bounds", () => {
    const layout = deriveLayout(DEFAULT_CONFIG, null);

    expect(layout.secondary).toBeNull();
    expect(layout.primary.offsetXMm).toBe(0);
    expect(layout.primary.config).toBe(DEFAULT_CONFIG);
    expect(layout.bounds).toEqual(deriveProportions(DEFAULT_CONFIG).bounds);
  });
});

describe("deriveLayout — comparison pair", () => {
  it("draws both engines at the same scale, unchanged from standalone", () => {
    const layout = deriveLayout(LS7, B6_1_6);

    // Identical proportions to each engine on its own: the layout only moves
    // mechanisms, it never rescales them.
    expect(layout.primary.proportions).toEqual(deriveProportions(LS7));
    expect(layout.secondary?.proportions).toEqual(deriveProportions(B6_1_6));
  });

  it("lets the larger engine tower over the smaller one", () => {
    const layout = deriveLayout(LS7, B6_1_6);
    const big = worldBounds(layout.primary);
    const small = worldBounds(layout.secondary!);

    const bigHeight = big.maxY - big.minY;
    const smallHeight = small.maxY - small.minY;

    expect(bigHeight).toBeGreaterThan(smallHeight);
    // The union takes the taller engine's height, so the shared zoom is set
    // by the LS7 and the B6 is drawn genuinely smaller.
    expect(layout.bounds.maxY - layout.bounds.minY).toBeCloseTo(
      Math.max(bigHeight, smallHeight),
      10,
    );
    expect(layout.bounds.maxY).toBeCloseTo(Math.max(big.maxY, small.maxY), 10);
  });

  it("puts engine A on the left and engine B on the right", () => {
    const layout = deriveLayout(LS7, B6_1_6);
    const a = worldBounds(layout.primary);
    const b = worldBounds(layout.secondary!);

    expect(a.maxX).toBeLessThan(b.minX);
  });

  it("separates them by a gap proportional to their mean width", () => {
    const layout = deriveLayout(LS7, B6_1_6);
    const a = worldBounds(layout.primary);
    const b = worldBounds(layout.secondary!);

    const widthA = a.maxX - a.minX;
    const widthB = b.maxX - b.minX;
    const expectedGap = (COMPARISON_GAP_FRACTION * (widthA + widthB)) / 2;

    expect(b.minX - a.maxX).toBeCloseTo(expectedGap, 10);
    expect(expectedGap).toBeGreaterThan(0);
  });

  it("centers the pair on x = 0 so the camera need not pan when toggled", () => {
    const layout = deriveLayout(LS7, B6_1_6);
    expect((layout.bounds.minX + layout.bounds.maxX) / 2).toBeCloseTo(0, 10);
  });

  it("mirrors the placement when the two engines are swapped", () => {
    const forward = deriveLayout(LS7, B6_1_6);
    const reversed = deriveLayout(B6_1_6, LS7);

    expect(reversed.primary.offsetXMm).toBeCloseTo(
      -forward.secondary!.offsetXMm,
      10,
    );
    expect(reversed.secondary!.offsetXMm).toBeCloseTo(
      -forward.primary.offsetXMm,
      10,
    );
    expect(reversed.bounds.maxX).toBeCloseTo(forward.bounds.maxX, 10);
  });

  for (const [nameA, geometryA] of GEOMETRIES) {
    for (const [nameB, geometryB] of GEOMETRIES) {
      it(`keeps the pair separated and framed (${nameA} vs ${nameB})`, () => {
        // Pair the extremes of geometry with the extremes of compression.
        const configA = configFor(geometryA, INPUT_RANGES.compressionRatio.min);
        const configB = configFor(geometryB, INPUT_RANGES.compressionRatio.max);
        const layout = deriveLayout(configA, configB);
        const a = worldBounds(layout.primary);
        const b = worldBounds(layout.secondary!);

        // Neither mechanism's drawn extent may reach into the other's.
        expect(a.maxX).toBeLessThan(b.minX);

        // The framed union contains both, exactly.
        expect(layout.bounds.minX).toBeCloseTo(a.minX, 10);
        expect(layout.bounds.maxX).toBeCloseTo(b.maxX, 10);
        expect(layout.bounds.minY).toBeCloseTo(Math.min(a.minY, b.minY), 10);
        expect(layout.bounds.maxY).toBeCloseTo(Math.max(a.maxY, b.maxY), 10);

        for (const value of Object.values(layout.bounds)) {
          expect(Number.isFinite(value)).toBe(true);
        }
      });
    }
  }

  it("widens the framed union compared with either engine alone", () => {
    const solo = deriveLayout(LS7, null);
    const pair = deriveLayout(LS7, B6_1_6);

    const soloWidth = solo.bounds.maxX - solo.bounds.minX;
    const pairWidth = pair.bounds.maxX - pair.bounds.minX;

    expect(pairWidth).toBeGreaterThan(soloWidth);
  });
});

describe("deriveLayout — mechanism labels", () => {
  const CUSTOM: CrankMechanismConfig = {
    boreMm: 61,
    strokeMm: 57,
    rodLengthMm: 99,
    compressionRatio: 12.25,
    redlineRpm: 12_000,
  };

  it("omits labels and reserves no space when they are hidden", () => {
    const hidden = deriveLayout(DEFAULT_CONFIG, null, false);
    const shown = deriveLayout(DEFAULT_CONFIG, null, true);

    expect(hidden.primary.label).toBeNull();
    expect(hidden.bounds).toEqual(deriveProportions(DEFAULT_CONFIG).bounds);
    // Showing labels is the only difference, and it only extends downward.
    expect(shown.bounds.minY).toBeLessThan(hidden.bounds.minY);
    expect(shown.bounds.maxY).toBeCloseTo(hidden.bounds.maxY, 10);
    expect(shown.bounds.minX).toBeCloseTo(hidden.bounds.minX, 10);
    expect(shown.bounds.maxX).toBeCloseTo(hidden.bounds.maxX, 10);
  });

  it("hides both labels in comparison mode when the preference is off", () => {
    const layout = deriveLayout(LS7, B6_1_6, false);
    expect(layout.primary.label).toBeNull();
    expect(layout.secondary?.label).toBeNull();
  });

  it("labels a single engine with no slot prefix", () => {
    const preset = ENGINE_PRESETS[0];
    const layout = deriveLayout(preset.config, null, true);

    expect(layout.primary.label).not.toBeNull();
    expect(layout.primary.label?.slot).toBeNull();
    expect(layout.primary.label?.name).toBe(preset.name);
  });

  it("marks the compared engines as A and B, left to right", () => {
    const layout = deriveLayout(LS7, B6_1_6, true);

    expect(layout.primary.label?.slot).toBe("A");
    expect(layout.secondary?.label?.slot).toBe("B");
    expect(layout.primary.label!.anchorXMm).toBeLessThan(
      layout.secondary!.label!.anchorXMm,
    );
  });

  it("names each engine from its own configuration", () => {
    const z06 = ENGINE_PRESETS.find((p) => p.id === "corvette-z06-c6-ls7")!;
    const layout = deriveLayout(z06.config, CUSTOM, true);

    expect(layout.primary.label?.name).toBe(z06.name);
    expect(layout.secondary?.label?.name).toBe(CUSTOM_ENGINE_LABEL);
  });

  it("centers each label under its own mechanism", () => {
    const layout = deriveLayout(LS7, B6_1_6, true);

    for (const placed of [layout.primary, layout.secondary!]) {
      const world = worldBounds(placed);
      const center = (world.minX + world.maxX) / 2;

      expect(placed.label!.anchorXMm).toBeCloseTo(center, 10);
      // And therefore inside that mechanism's own footprint.
      expect(placed.label!.anchorXMm).toBeGreaterThan(world.minX);
      expect(placed.label!.anchorXMm).toBeLessThan(world.maxX);
    }
  });

  it("puts both labels on one baseline even for unequal engines", () => {
    const layout = deriveLayout(LS7, B6_1_6, true);

    expect(layout.primary.label!.anchorYMm).toBeCloseTo(
      layout.secondary!.label!.anchorYMm,
      10,
    );
  });

  for (const [geometryName, geometry] of GEOMETRIES) {
    for (const compressionRatio of COMPRESSION_RATIOS) {
      it(`keeps the label clear of the mechanism and inside the bounds (${geometryName}, ${compressionRatio}:1)`, () => {
        const config = configFor(geometry, compressionRatio);
        const layout = deriveLayout(config, null, true);
        const content = deriveProportions(config).bounds;
        const label = layout.primary.label!;

        const contentHeight = content.maxY - content.minY;
        const gap = LABEL_GAP_FRACTION * contentHeight;
        const band = LABEL_BAND_FRACTION * contentHeight;

        // Below everything the mechanism draws, including the counterweight
        // sweep, with clear space in between.
        expect(label.anchorYMm).toBeLessThan(content.minY);
        expect(content.minY - label.anchorYMm).toBeGreaterThanOrEqual(gap);

        // The whole band the label is centered in is inside the framed
        // bounds: its lower edge is exactly the framed bottom.
        expect(layout.bounds.minY).toBeCloseTo(label.anchorYMm - band / 2, 9);
        expect(label.anchorYMm + band / 2).toBeLessThanOrEqual(content.minY);
        expect(Number.isFinite(layout.bounds.minY)).toBe(true);

        // Reserved space is exactly the gap plus the band.
        expect(content.minY - layout.bounds.minY).toBeCloseTo(gap + band, 10);
      });
    }
  }

  for (const [nameA, geometryA] of GEOMETRIES) {
    for (const [nameB, geometryB] of GEOMETRIES) {
      it(`frames both labels of a comparison pair (${nameA} vs ${nameB})`, () => {
        const configA = configFor(geometryA, INPUT_RANGES.compressionRatio.min);
        const configB = configFor(geometryB, INPUT_RANGES.compressionRatio.max);
        const layout = deriveLayout(configA, configB, true);
        const labelA = layout.primary.label!;
        const labelB = layout.secondary!.label!;

        for (const label of [labelA, labelB]) {
          expect(Number.isFinite(label.anchorXMm)).toBe(true);
          expect(label.anchorYMm).toBeLessThan(
            Math.min(
              layout.primary.proportions.bounds.minY,
              layout.secondary!.proportions.bounds.minY,
            ),
          );
          expect(label.anchorYMm).toBeGreaterThan(layout.bounds.minY);
          expect(label.anchorXMm).toBeGreaterThan(layout.bounds.minX);
          expect(label.anchorXMm).toBeLessThan(layout.bounds.maxX);
        }

        // Each label sits under its own engine, never over the other's.
        const worldA = worldBounds(layout.primary);
        const worldB = worldBounds(layout.secondary!);
        expect(labelA.anchorXMm).toBeLessThan(worldB.minX);
        expect(labelB.anchorXMm).toBeGreaterThan(worldA.maxX);
      });
    }
  }

  it("moves the label anchor with the configuration", () => {
    const small = deriveLayout(configFor(GEOMETRIES[1][1], 10.5), null, true);
    const large = deriveLayout(configFor(GEOMETRIES[2][1], 10.5), null, true);

    // A physically larger engine reaches further below the crank, so its
    // label anchor sits lower in scene millimeters.
    expect(large.primary.label!.anchorYMm).toBeLessThan(
      small.primary.label!.anchorYMm,
    );
  });
});
