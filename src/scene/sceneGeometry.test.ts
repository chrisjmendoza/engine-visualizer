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
  ENGINE_LAYOUT_IDS,
  createEngineLayout,
  sharesCrankpin,
} from "../engine/engineLayout";
import type { EngineLayoutId } from "../engine/engineLayout";
import {
  COMPARISON_GAP_FRACTION,
  FRAME_PADDING,
  COMPARISON_VERTICAL_GAP_FRACTION,
  INLINE_GAP_FRACTION,
  LABEL_BAND_FRACTION,
  LABEL_GAP_FRACTION,
  UPRIGHT_FLAT_ROTATION_RAD,
  deriveLayout,
  deriveProportions,
  drawnRotationRad,
  rotateBounds,
} from "./sceneGeometry";
import type {
  PlacedCylinder,
  PlacedEngine,
  SceneBounds,
} from "./sceneGeometry";

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

/**
 * World-space extents of a placed engine's whole cylinder row, recomputed from
 * its cylinders' own placements rather than read from `placed.bounds`, so the
 * tests check the published bounds instead of trusting them.
 *
 * Each cylinder carries its own bounds because a V or flat cylinder is tilted
 * onto its bank (§24a) and so no longer occupies the upright footprint in
 * `proportions.bounds`, and its own crank-center offset because a stacked
 * comparison moves engine B's whole row down the stage.
 */
function worldBounds(placed: PlacedEngine): SceneBounds {
  const { cylinders } = placed;
  return {
    minX: Math.min(...cylinders.map((c) => c.offsetXMm + c.bounds.minX)),
    maxX: Math.max(...cylinders.map((c) => c.offsetXMm + c.bounds.maxX)),
    minY: Math.min(...cylinders.map((c) => c.offsetYMm + c.bounds.minY)),
    maxY: Math.max(...cylinders.map((c) => c.offsetYMm + c.bounds.maxY)),
  };
}

/** One slot of a placed row: its crank center and the cylinders drawn there. */
interface ThrowSlot {
  offsetXMm: number;
  offsetYMm: number;
  cylinders: PlacedCylinder[];
  /** Union of the slot's cylinders' own footprints, relative to its center. */
  bounds: SceneBounds;
}

/**
 * Regroups a placed engine's cylinders into the slots they are drawn in
 * (§24a) — one per cylinder for an inline engine, one per throw for a V or
 * flat one — rebuilding the grouping from the published `throwIndex` rather
 * than assuming it, and checking as it goes that a slot really is one crank
 * center.
 */
function throwSlots(placed: PlacedEngine): ThrowSlot[] {
  const slots: ThrowSlot[] = [];

  for (const cylinder of placed.cylinders) {
    const slot = slots[cylinder.throwIndex];
    if (!slot) {
      // Slots must appear in order, so a throw index can never skip ahead.
      expect(cylinder.throwIndex).toBe(slots.length);
      slots.push({
        offsetXMm: cylinder.offsetXMm,
        offsetYMm: cylinder.offsetYMm,
        cylinders: [cylinder],
        bounds: { ...cylinder.bounds },
      });
      continue;
    }
    // Everything in one slot shares one crank center — that is what "drawn in
    // one plane, around one crank center" means.
    expect(cylinder.offsetXMm).toBe(slot.offsetXMm);
    expect(cylinder.offsetYMm).toBe(slot.offsetYMm);
    slot.cylinders.push(cylinder);
    slot.bounds = {
      minX: Math.min(slot.bounds.minX, cylinder.bounds.minX),
      maxX: Math.max(slot.bounds.maxX, cylinder.bounds.maxX),
      minY: Math.min(slot.bounds.minY, cylinder.bounds.minY),
      maxY: Math.max(slot.bounds.maxY, cylinder.bounds.maxY),
    };
  }

  return slots;
}

/**
 * The slot spacing an engine measures for itself, taken from the one place it
 * is unambiguous: that engine alone on the stage, with no comparison at all.
 *
 * This is the yardstick the stacked comparison must now match (§24a) — each
 * row is laid out at exactly the spacing it would have alone, never stretched
 * to a partner's.
 */
function slotSpacingAlone(
  config: CrankMechanismConfig,
  id: EngineLayoutId,
  singleCylinderView = false,
): number {
  const slots = throwSlots(
    deriveLayout(config, null, false, id, "single", singleCylinderView).primary,
  );
  expect(slots.length).toBeGreaterThan(1);
  return slots[1].offsetXMm - slots[0].offsetXMm;
}

describe("deriveLayout — single engine", () => {
  it("places one mechanism at the origin and frames its own bounds", () => {
    const layout = deriveLayout(DEFAULT_CONFIG, null);

    expect(layout.secondary).toBeNull();
    expect(layout.primary.cylinders).toHaveLength(1);
    expect(layout.primary.cylinders[0].offsetXMm).toBe(0);
    expect(layout.primary.config).toBe(DEFAULT_CONFIG);
    expect(layout.bounds).toEqual(deriveProportions(DEFAULT_CONFIG).bounds);
  });

  it("publishes row bounds matching the single cylinder's own extents", () => {
    const layout = deriveLayout(DEFAULT_CONFIG, null);
    expect(layout.primary.bounds).toEqual(worldBounds(layout.primary));
  });

  it("gives the one cylinder index 0 and zero phase", () => {
    const layout = deriveLayout(DEFAULT_CONFIG, null);
    const [cylinder] = layout.primary.cylinders;

    expect(cylinder.index).toBe(0);
    expect(cylinder.crankPhaseRad).toBe(0);
    expect(cylinder.bankIndex).toBe(0);
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

    expect(reversed.primary.cylinders[0].offsetXMm).toBeCloseTo(
      -forward.secondary!.cylinders[0].offsetXMm,
      10,
    );
    expect(reversed.secondary!.cylinders[0].offsetXMm).toBeCloseTo(
      -forward.primary.cylinders[0].offsetXMm,
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

describe("deriveLayout — multi-cylinder rows", () => {
  /** Expected center-to-center cylinder spacing for a configuration. */
  function spacingFor(config: CrankMechanismConfig): number {
    const { bounds } = deriveProportions(config);
    return (bounds.maxX - bounds.minX) * (1 + INLINE_GAP_FRACTION);
  }

  it("lays an inline-4 out as four cylinders in crankshaft order", () => {
    const layout = deriveLayout(DEFAULT_CONFIG, null, false, "inline-4");
    const indices = layout.primary.cylinders.map((c) => c.index);

    expect(layout.primary.cylinders).toHaveLength(4);
    expect(indices).toEqual([0, 1, 2, 3]);
    // Left to right, in the same order as along the crankshaft.
    const offsets = layout.primary.cylinders.map((c) => c.offsetXMm);
    for (let i = 1; i < offsets.length; i += 1) {
      expect(offsets[i]).toBeGreaterThan(offsets[i - 1]);
    }
  });

  it("carries the inline-4 crank-throw phases through to the stage", () => {
    const layout = deriveLayout(DEFAULT_CONFIG, null, false, "inline-4");

    expect(layout.primary.cylinders.map((c) => c.crankPhaseRad)).toEqual([
      0,
      Math.PI,
      Math.PI,
      0,
    ]);
    for (const cylinder of layout.primary.cylinders) {
      expect(cylinder.bankIndex).toBe(0);
      // An inline layout is upright, so nothing is rotated and every
      // cylinder keeps the mechanism's own footprint.
      expect(cylinder.bankOffsetRad).toBe(0);
      expect(cylinder.bounds).toEqual(layout.primary.proportions.bounds);
    }
  });

  it("spaces the cylinders evenly by the inline gap fraction", () => {
    const layout = deriveLayout(DEFAULT_CONFIG, null, false, "inline-4");
    const spacing = spacingFor(DEFAULT_CONFIG);
    const offsets = layout.primary.cylinders.map((c) => c.offsetXMm);

    for (let i = 1; i < offsets.length; i += 1) {
      expect(offsets[i] - offsets[i - 1]).toBeCloseTo(spacing, 10);
    }
  });

  it("leaves clear space between neighbouring cylinders", () => {
    for (const id of ["inline-3", "inline-4", "inline-6"] as const) {
      for (const [, geometry] of GEOMETRIES) {
        const config = configFor(geometry, 10.5);
        const layout = deriveLayout(config, null, false, id);
        const placed = layout.primary.cylinders;

        for (let i = 1; i < placed.length; i += 1) {
          const gap =
            placed[i].offsetXMm +
            placed[i].bounds.minX -
            (placed[i - 1].offsetXMm + placed[i - 1].bounds.maxX);
          expect(gap).toBeGreaterThan(0);
        }
      }
    }
  });

  it("centers a lone row on x = 0 and frames exactly the row", () => {
    for (const id of ["single", "inline-3", "inline-4", "inline-6"] as const) {
      const layout = deriveLayout(DEFAULT_CONFIG, null, false, id);
      const world = worldBounds(layout.primary);

      expect((world.minX + world.maxX) / 2).toBeCloseTo(0, 10);
      expect(layout.primary.bounds.minX).toBeCloseTo(world.minX, 10);
      expect(layout.primary.bounds.maxX).toBeCloseTo(world.maxX, 10);
      expect(layout.bounds.minX).toBeCloseTo(world.minX, 10);
      expect(layout.bounds.maxX).toBeCloseTo(world.maxX, 10);
    }
  });

  it("widens the framed union with each extra cylinder, height unchanged", () => {
    const one = deriveLayout(DEFAULT_CONFIG, null, false, "single");
    const four = deriveLayout(DEFAULT_CONFIG, null, false, "inline-4");
    const six = deriveLayout(DEFAULT_CONFIG, null, false, "inline-6");

    const widthOf = (b: SceneBounds) => b.maxX - b.minX;
    expect(widthOf(four.bounds)).toBeGreaterThan(widthOf(one.bounds));
    expect(widthOf(six.bounds)).toBeGreaterThan(widthOf(four.bounds));

    // Only the row grows: a taller frame would mean the cylinders were
    // rescaled, which the stage never does.
    expect(six.bounds.minY).toBeCloseTo(one.bounds.minY, 10);
    expect(six.bounds.maxY).toBeCloseTo(one.bounds.maxY, 10);
    expect(six.primary.proportions).toEqual(one.primary.proportions);
  });

  it("matches the pre-multi-cylinder layout for two single cylinders", () => {
    const implicit = deriveLayout(LS7, B6_1_6, true);
    const explicitOne = deriveLayout(LS7, B6_1_6, true, "single", "single");

    expect(explicitOne).toEqual(implicit);
  });
});

describe("deriveLayout — comparing engines of different layouts", () => {
  it("stacks an inline-4 above a single-cylinder engine, clear of it", () => {
    const layout = deriveLayout(LS7, B6_1_6, false, "inline-4", "single");
    const a = worldBounds(layout.primary);
    const b = worldBounds(layout.secondary!);

    expect(layout.arrangement).toBe("stacked");
    expect(layout.primary.cylinders).toHaveLength(4);
    expect(layout.secondary!.cylinders).toHaveLength(1);
    // Engine A above engine B, with real space between them.
    expect(b.maxY).toBeLessThan(a.minY);
  });

  it("frames the union of both rows exactly", () => {
    const layout = deriveLayout(LS7, B6_1_6, false, "inline-4", "inline-3");
    const a = worldBounds(layout.primary);
    const b = worldBounds(layout.secondary!);

    expect(layout.bounds.minX).toBeCloseTo(Math.min(a.minX, b.minX), 10);
    expect(layout.bounds.maxX).toBeCloseTo(Math.max(a.maxX, b.maxX), 10);
    expect(layout.bounds.minY).toBeCloseTo(Math.min(a.minY, b.minY), 10);
    expect(layout.bounds.maxY).toBeCloseTo(Math.max(a.maxY, b.maxY), 10);
    expect((layout.bounds.minX + layout.bounds.maxX) / 2).toBeCloseTo(0, 10);
  });

  it("scales the side-by-side gap to the two row widths, not one cylinder", () => {
    // Still the side-by-side arrangement: both engines show one cylinder, of
    // an inline-6 each. The gap is measured against the placed rows.
    const layout = deriveLayout(
      LS7,
      B6_1_6,
      false,
      "inline-6",
      "inline-6",
      true,
      true,
    );
    const a = worldBounds(layout.primary);
    const b = worldBounds(layout.secondary!);

    expect(layout.arrangement).toBe("side-by-side");
    const expectedGap =
      (COMPARISON_GAP_FRACTION * (a.maxX - a.minX + (b.maxX - b.minX))) / 2;
    expect(b.minX - a.maxX).toBeCloseTo(expectedGap, 10);
  });

  it("centers one label under each engine's whole row", () => {
    const layout = deriveLayout(LS7, B6_1_6, true, "inline-4", "inline-3");

    for (const placed of [layout.primary, layout.secondary!]) {
      const world = worldBounds(placed);
      expect(placed.label!.anchorXMm).toBeCloseTo(
        (world.minX + world.maxX) / 2,
        10,
      );
    }

    // One label per engine. Stacked, each sits under its own row rather than
    // on a shared baseline: A's in the gap above B, B's below the stage.
    expect(layout.primary.label!.anchorYMm).toBeGreaterThan(
      layout.secondary!.label!.anchorYMm,
    );
    expect(layout.primary.label!.anchorYMm).toBeLessThan(
      worldBounds(layout.primary).minY,
    );
    expect(layout.primary.label!.anchorYMm).toBeGreaterThan(
      worldBounds(layout.secondary!).maxY,
    );
  });
});

describe("deriveLayout — stacked vs side-by-side arrangement (§24a)", () => {
  /** Every cylinder of one placed engine, as world-space boxes. */
  function boxes(placed: PlacedEngine): SceneBounds[] {
    return placed.cylinders.map((c) => ({
      minX: c.offsetXMm + c.bounds.minX,
      maxX: c.offsetXMm + c.bounds.maxX,
      minY: c.offsetYMm + c.bounds.minY,
      maxY: c.offsetYMm + c.bounds.maxY,
    }));
  }

  function overlaps(a: SceneBounds, b: SceneBounds): boolean {
    return (
      a.minX < b.maxX - 1e-9 &&
      b.minX < a.maxX - 1e-9 &&
      a.minY < b.maxY - 1e-9 &&
      b.minY < a.maxY - 1e-9
    );
  }

  const MULTI = ["inline-4", "inline-6", "v8-cross", "flat-4"] as const;

  it("goes side by side only when both engines show exactly one cylinder", () => {
    for (const id of MULTI) {
      for (const other of MULTI) {
        // Both single-cylinder views: the lone-mechanism case, unchanged.
        expect(
          deriveLayout(LS7, B6_1_6, false, id, other, true, true).arrangement,
        ).toBe("side-by-side");
        // Either side showing its whole engine tips the pair into a stack.
        expect(
          deriveLayout(LS7, B6_1_6, false, id, other, false, true).arrangement,
        ).toBe("stacked");
        expect(
          deriveLayout(LS7, B6_1_6, false, id, other, true, false).arrangement,
        ).toBe("stacked");
        expect(
          deriveLayout(LS7, B6_1_6, false, id, other, false, false).arrangement,
        ).toBe("stacked");
      }
    }
  });

  it("calls a lone engine's arrangement `single`, whatever it is showing", () => {
    expect(deriveLayout(LS7, null, false, "v8-cross").arrangement).toBe(
      "single",
    );
    expect(
      deriveLayout(LS7, null, false, "v8-cross", "single", true).arrangement,
    ).toBe("single");
  });

  it("centers each stacked row on the midpoint of its own crank span", () => {
    const layout = deriveLayout(LS7, B6_1_6, false, "v8-cross", "inline-6");
    const a = throwSlots(layout.primary);
    const b = throwSlots(layout.secondary!);

    expect(a).toHaveLength(4);
    expect(b).toHaveLength(6);
    // Rows of unequal length share the stack's center line, not a left-hand
    // datum: each one's crank span — first crank center to last — is centered
    // on x = 0 (§24a). Beyond that the two rows run at their own spacings.
    for (const slots of [a, b]) {
      expect(
        (slots[0].offsetXMm + slots[slots.length - 1].offsetXMm) / 2,
      ).toBeCloseTo(0, 9);
    }
    // Each engine keeps its own crankshaft order left to right, evenly spaced.
    for (const slots of [a, b]) {
      const spacing = slots[1].offsetXMm - slots[0].offsetXMm;
      expect(spacing).toBeGreaterThan(0);
      for (let i = 1; i < slots.length; i += 1) {
        expect(slots[i].offsetXMm - slots[i - 1].offsetXMm).toBeCloseTo(
          spacing,
          9,
        );
      }
    }
  });

  it("never overlaps the two engines, in either arrangement", () => {
    for (const [, geometryA] of GEOMETRIES) {
      for (const [, geometryB] of GEOMETRIES) {
        const configA = configFor(geometryA, INPUT_RANGES.compressionRatio.min);
        const configB = configFor(geometryB, INPUT_RANGES.compressionRatio.max);

        for (const views of [
          [true, true],
          [false, true],
          [true, false],
          [false, false],
        ] as const) {
          const layout = deriveLayout(
            configA,
            configB,
            false,
            "v8-cross",
            "inline-6",
            views[0],
            views[1],
          );
          const a = worldBounds(layout.primary);
          const b = worldBounds(layout.secondary!);

          if (layout.arrangement === "side-by-side") {
            expect(a.maxX).toBeLessThan(b.minX);
          } else {
            expect(b.maxY).toBeLessThan(a.minY);
          }

          // Nothing drawn for engine A may touch anything drawn for B, even
          // for a tilted bore reaching outside its row's nominal band.
          for (const boxA of boxes(layout.primary)) {
            for (const boxB of boxes(layout.secondary!)) {
              expect(overlaps(boxA, boxB)).toBe(false);
            }
          }
        }
      }
    }
  });

  it("separates the stacked rows by a gap scaled to their heights", () => {
    const layout = deriveLayout(LS7, B6_1_6, false, "inline-6", "inline-4");
    const a = worldBounds(layout.primary);
    const b = worldBounds(layout.secondary!);

    const expectedGap =
      (COMPARISON_VERTICAL_GAP_FRACTION *
        (a.maxY - a.minY + (b.maxY - b.minY))) /
      2;
    expect(a.minY - b.maxY).toBeCloseTo(expectedGap, 10);
    expect(expectedGap).toBeGreaterThan(0);
  });

  it("keeps one shared zoom: a big engine still towers over a small one", () => {
    const layout = deriveLayout(LS7, B6_1_6, false, "inline-4", "inline-4");

    // Neither engine is rescaled to fit its half of the stage.
    expect(layout.primary.proportions).toEqual(deriveProportions(LS7));
    expect(layout.secondary!.proportions).toEqual(deriveProportions(B6_1_6));

    const a = worldBounds(layout.primary);
    const b = worldBounds(layout.secondary!);
    expect(a.maxY - a.minY).toBeGreaterThan(b.maxY - b.minY);
    expect(a.maxX - a.minX).toBeGreaterThan(b.maxX - b.minX);
  });

  it("frames the union of a stacked pair exactly, centered on x = 0", () => {
    for (const id of ["inline-4", "v8-cross", "flat-6"] as const) {
      const layout = deriveLayout(LS7, B6_1_6, false, id, "inline-3");
      const a = worldBounds(layout.primary);
      const b = worldBounds(layout.secondary!);

      expect(layout.bounds.minX).toBeCloseTo(Math.min(a.minX, b.minX), 10);
      expect(layout.bounds.maxX).toBeCloseTo(Math.max(a.maxX, b.maxX), 10);
      expect(layout.bounds.minY).toBeCloseTo(b.minY, 10);
      expect(layout.bounds.maxY).toBeCloseTo(a.maxY, 10);
      expect((layout.bounds.minX + layout.bounds.maxX) / 2).toBeCloseTo(0, 10);
    }
  });

  it("keeps both stacked labels inside the framed bounds and clear of the engines", () => {
    for (const [, geometryA] of GEOMETRIES) {
      for (const [, geometryB] of GEOMETRIES) {
        const configA = configFor(geometryA, INPUT_RANGES.compressionRatio.min);
        const configB = configFor(geometryB, INPUT_RANGES.compressionRatio.max);
        const layout = deriveLayout(
          configA,
          configB,
          true,
          "inline-4",
          "v8-cross",
        );
        expect(layout.arrangement).toBe("stacked");

        const a = worldBounds(layout.primary);
        const b = worldBounds(layout.secondary!);
        const labelA = layout.primary.label!;
        const labelB = layout.secondary!.label!;

        for (const label of [labelA, labelB]) {
          expect(Number.isFinite(label.anchorXMm)).toBe(true);
          expect(label.anchorYMm).toBeGreaterThan(layout.bounds.minY);
          expect(label.anchorYMm).toBeLessThan(layout.bounds.maxY);
          expect(label.anchorXMm).toBeGreaterThanOrEqual(layout.bounds.minX);
          expect(label.anchorXMm).toBeLessThanOrEqual(layout.bounds.maxX);
        }

        // A's label sits in the gap between the engines, B's below the stack.
        expect(labelA.anchorYMm).toBeLessThan(a.minY);
        expect(labelA.anchorYMm).toBeGreaterThan(b.maxY);
        expect(labelB.anchorYMm).toBeLessThan(b.minY);

        // Showing labels only extends the frame downward; the engines
        // themselves still fit inside it.
        expect(layout.bounds.minY).toBeLessThan(b.minY);
        expect(layout.bounds.maxY).toBeCloseTo(a.maxY, 10);
      }
    }
  });

  it("reserves the stacked label bands out of the stack's own height", () => {
    const unlabelled = deriveLayout(LS7, B6_1_6, false, "inline-4", "inline-4");
    const labelled = deriveLayout(LS7, B6_1_6, true, "inline-4", "inline-4");

    const stackHeight = unlabelled.bounds.maxY - unlabelled.bounds.minY;
    const gap = LABEL_GAP_FRACTION * stackHeight;
    const band = LABEL_BAND_FRACTION * stackHeight;

    // Engine A does not move; engine B drops by exactly one reserved band,
    // making room for engine A's label above it, and the frame gains one more
    // band below engine B for B's own label.
    expect(labelled.bounds.maxY).toBeCloseTo(unlabelled.bounds.maxY, 10);
    expect(worldBounds(labelled.secondary!).maxY).toBeCloseTo(
      worldBounds(unlabelled.secondary!).maxY - (gap + band),
      10,
    );
    expect(
      worldBounds(labelled.secondary!).minY - labelled.bounds.minY,
    ).toBeCloseTo(gap + band, 10);
  });

  it("leaves the single-engine layout untouched by the arrangement rule", () => {
    for (const id of ["inline-4", "v8-cross", "flat-4"] as const) {
      for (const singleCylinderView of [true, false]) {
        const layout = deriveLayout(
          DEFAULT_CONFIG,
          null,
          true,
          id,
          "single",
          singleCylinderView,
        );
        // A lone row still sits on y = 0, centered on x = 0, framed exactly.
        const world = worldBounds(layout.primary);
        expect(layout.secondary).toBeNull();
        expect(layout.primary.cylinders.every((c) => c.offsetYMm === 0)).toBe(
          true,
        );
        expect((world.minX + world.maxX) / 2).toBeCloseTo(0, 10);
        expect(layout.bounds.maxY).toBeCloseTo(world.maxY, 10);
      }
    }
  });
});

describe("deriveLayout — each stacked row keeps its own spacing (§24a)", () => {
  /**
   * The comparisons this rule exists for. Each entry is the pair of
   * architectures and the two single-cylinder-view flags, so a lone mechanism
   * compared against a whole engine is covered by the same table.
   */
  const STACKED_PAIRS: Array<
    [EngineLayoutId, EngineLayoutId, boolean, boolean]
  > = [
    // The reported regression: a narrow inline row against a wide V one.
    ["inline-6", "v8-cross", false, false],
    ["v8-cross", "inline-6", false, false],
    // The owner's real comparison: the two GT-R engines.
    ["inline-6", "v6-60", false, false],
    ["v6-60", "inline-6", false, false],
    // Matched architectures — the case that used to be the rule's whole point.
    ["inline-4", "inline-4", false, false],
    // Two paired layouts of very different slot widths.
    ["flat-4", "v12-60", false, false],
    ["v12-60", "flat-4", false, false],
    // A one-cylinder engine against a multi-cylinder one: the degenerate crank
    // span, whose first and last crank center are the same point.
    ["single", "inline-6", false, false],
    ["v12-60", "single", false, false],
    // One cylinder against a whole engine, both ways round.
    ["v8-cross", "inline-6", true, false],
    ["inline-6", "v8-cross", false, true],
  ];

  /** Slot X positions of a placed row, left to right. */
  function slotXs(placed: PlacedEngine): number[] {
    return throwSlots(placed).map((s) => s.offsetXMm);
  }

  /**
   * Asserts that a placed row is exactly the row that engine would draw alone,
   * translated — never re-spaced. This is the whole of the fix stated once:
   * the stage may move a row, but it may not stretch it.
   *
   * The translation is the property being asserted; the expected *offset* is
   * checked alongside it, and it is now **zero**. A lone row is centered on
   * x = 0 by its bounds and a stacked row by its crank span, and for every
   * layout in the roster those two coincide: each slot of a row is measured
   * from the same proportions and the same set of bank rotations (a paired
   * layout's slot is always one bank-0 plus one bank-1 cylinder), so every
   * slot's footprint is the same box and is symmetric about its own crank
   * center. A stacked row therefore lands exactly where that engine's lone row
   * would, which is a stronger guarantee than translation alone — but only
   * translation is the rule, so both are asserted.
   */
  function expectPureTranslationOfLoneRow(
    placed: PlacedEngine,
    config: CrankMechanismConfig,
    id: EngineLayoutId,
    singleCylinderView: boolean,
  ) {
    const alone = slotXs(
      deriveLayout(config, null, false, id, "single", singleCylinderView)
        .primary,
    );
    const staged = slotXs(placed);

    expect(staged).toHaveLength(alone.length);
    const shift = staged[0] - alone[0];
    expect(shift).toBeCloseTo(0, 9);
    for (let i = 0; i < alone.length; i += 1) {
      expect(staged[i]).toBeCloseTo(alone[i] + shift, 9);
    }
  }

  it("keeps an inline-6 at its own cylinder pitch beside a V8", () => {
    // The regression this change fixes: the inline-6's six cylinders used to
    // be spread across spacing sized for the V8's much wider throw planes.
    const own = slotSpacingAlone(LS7, "inline-6");
    const v8Own = slotSpacingAlone(LS7, "v8-cross");
    // The premise — the V8's throw plane really is much the wider of the two,
    // so a shared spacing would have stretched the inline row substantially.
    expect(v8Own).toBeGreaterThan(2 * own);

    for (const [a, b] of [
      ["inline-6", "v8-cross"],
      ["v8-cross", "inline-6"],
    ] as const) {
      const layout = deriveLayout(LS7, LS7, false, a, b);
      expect(layout.arrangement).toBe("stacked");

      const inlineRow = a === "inline-6" ? layout.primary : layout.secondary!;
      const vRow = a === "inline-6" ? layout.secondary! : layout.primary;
      const inlineSlots = slotXs(inlineRow);
      const vSlots = slotXs(vRow);

      expect(inlineSlots[1] - inlineSlots[0]).toBeCloseTo(own, 9);
      expect(vSlots[1] - vSlots[0]).toBeCloseTo(v8Own, 9);
      // And the row really is shorter than it used to be: six cylinders at
      // their own pitch cannot span what six at the V8's pitch would.
      expect(inlineRow.bounds.maxX - inlineRow.bounds.minX).toBeLessThan(
        5 * v8Own,
      );
    }
  });

  it("lays every stacked row out exactly as that engine would alone", () => {
    for (const [idA, idB, viewA, viewB] of STACKED_PAIRS) {
      for (const [, geometry] of GEOMETRIES) {
        const configB = configFor(geometry, 10.5);
        const layout = deriveLayout(
          LS7,
          configB,
          false,
          idA,
          idB,
          viewA,
          viewB,
        );

        expect(layout.arrangement).toBe("stacked");
        expectPureTranslationOfLoneRow(layout.primary, LS7, idA, viewA);
        expectPureTranslationOfLoneRow(layout.secondary!, configB, idB, viewB);
      }
    }
  });

  it("still shares one spacing, and one set of columns, for matched engines", () => {
    // The desirable consequence of the rule: two engines of the same layout
    // and the same dimensions measure the same spacing for themselves, so
    // their columns line up exactly as the old shared spacing made them.
    for (const id of ["inline-4", "inline-6", "v8-cross", "flat-4"] as const) {
      const layout = deriveLayout(LS7, LS7, false, id, id);
      const a = slotXs(layout.primary);
      const b = slotXs(layout.secondary!);

      expect(a).toHaveLength(b.length);
      for (let i = 0; i < a.length; i += 1) {
        expect(a[i]).toBeCloseTo(b[i], 9);
      }
      // Both rows are also identical to that engine's lone row, and the pair
      // is centered, so the two sit squarely one above the other.
      expect(layout.primary.bounds.minX).toBeCloseTo(
        layout.secondary!.bounds.minX,
        9,
      );
      expect(layout.primary.bounds.maxX).toBeCloseTo(
        layout.secondary!.bounds.maxX,
        9,
      );
    }
  });

  it("sizes each row to its own engine when the two differ in size", () => {
    // Same architecture, different dimensions: spacing is a fraction of the
    // engine's own size, so the smaller engine draws a tighter row rather
    // than being stretched to the larger one's pitch.
    const layout = deriveLayout(LS7, B6_1_6, false, "inline-4", "inline-4");
    const a = slotXs(layout.primary);
    const b = slotXs(layout.secondary!);

    expect(a[1] - a[0]).toBeCloseTo(slotSpacingAlone(LS7, "inline-4"), 9);
    expect(b[1] - b[0]).toBeCloseTo(slotSpacingAlone(B6_1_6, "inline-4"), 9);
    expect(b[1] - b[0]).toBeLessThan(a[1] - a[0]);
    // Equal slot counts, unequal pitch: the two rows no longer share a first
    // throw, they share a center line — each row's crank span is centered on
    // x = 0, so the tighter row sits symmetrically inside the wider one.
    expect((a[0] + a[a.length - 1]) / 2).toBeCloseTo(0, 9);
    expect((b[0] + b[b.length - 1]) / 2).toBeCloseTo(0, 9);
    expect(b[0]).toBeGreaterThan(a[0]);
    expect(b[b.length - 1]).toBeLessThan(a[a.length - 1]);
  });

  it("leaves clear space between throws of a row and between the two rows", () => {
    for (const [idA, idB, viewA, viewB] of STACKED_PAIRS) {
      for (const [, geometry] of GEOMETRIES) {
        const configB = configFor(geometry, INPUT_RANGES.compressionRatio.max);
        const layout = deriveLayout(
          LS7,
          configB,
          false,
          idA,
          idB,
          viewA,
          viewB,
        );

        // Within each row, no slot's footprint may touch its neighbour's.
        for (const placed of [layout.primary, layout.secondary!]) {
          const slots = throwSlots(placed);
          for (let i = 1; i < slots.length; i += 1) {
            const gap =
              slots[i].offsetXMm +
              slots[i].bounds.minX -
              (slots[i - 1].offsetXMm + slots[i - 1].bounds.maxX);
            expect(gap).toBeGreaterThan(0);
          }
        }

        // And nothing drawn for A may touch anything drawn for B.
        const a = worldBounds(layout.primary);
        const b = worldBounds(layout.secondary!);
        expect(b.maxY).toBeLessThan(a.minY);
      }
    }
  });

  it("frames the union of the two rows exactly, centered on x = 0", () => {
    for (const [idA, idB, viewA, viewB] of STACKED_PAIRS) {
      const layout = deriveLayout(LS7, B6_1_6, false, idA, idB, viewA, viewB);
      const a = worldBounds(layout.primary);
      const b = worldBounds(layout.secondary!);

      expect(layout.bounds.minX).toBeCloseTo(Math.min(a.minX, b.minX), 9);
      expect(layout.bounds.maxX).toBeCloseTo(Math.max(a.maxX, b.maxX), 9);
      expect(layout.bounds.minY).toBeCloseTo(b.minY, 9);
      expect(layout.bounds.maxY).toBeCloseTo(a.maxY, 9);
      expect((layout.bounds.minX + layout.bounds.maxX) / 2).toBeCloseTo(0, 9);

      // Each engine's published row bounds still describe its own cylinders.
      expect(layout.primary.bounds.minX).toBeCloseTo(a.minX, 9);
      expect(layout.primary.bounds.maxX).toBeCloseTo(a.maxX, 9);
      expect(layout.secondary!.bounds.minX).toBeCloseTo(b.minX, 9);
      expect(layout.secondary!.bounds.maxX).toBeCloseTo(b.maxX, 9);
    }
  });

  /**
   * The superseded rule, written out independently: both rows driven at the
   * wider of the two spacings, anchored at one slot-0 crank center. Kept only
   * to measure what the change bought — it is never what the source does now.
   */
  function unionWidthAtSharedSpacing(
    configA: CrankMechanismConfig,
    idA: EngineLayoutId,
    configB: CrankMechanismConfig,
    idB: EngineLayoutId,
  ): number {
    const rows = [
      throwSlots(deriveLayout(configA, null, false, idA).primary),
      throwSlots(deriveLayout(configB, null, false, idB).primary),
    ];
    const spacing = Math.max(
      ...rows.map((slots) => slots[1].offsetXMm - slots[0].offsetXMm),
    );
    const reaches = rows.map((slots) => ({
      left: Math.min(...slots.map((s, i) => i * spacing + s.bounds.minX)),
      right: Math.max(...slots.map((s, i) => i * spacing + s.bounds.maxX)),
    }));

    return (
      Math.max(...reaches.map((r) => r.right)) -
      Math.min(...reaches.map((r) => r.left))
    );
  }

  it("frames a mismatched pair tighter than the shared spacing did", () => {
    // The other half of the payoff: with neither row stretched, the union the
    // one shared zoom has to fit is narrower, so both engines are drawn
    // larger. Matched engines are unaffected — their spacings were already
    // equal — so the union comes out identical there.
    const widthOf = (b: SceneBounds) => b.maxX - b.minX;

    for (const [idA, idB] of [
      ["inline-6", "v8-cross"],
      ["v8-cross", "inline-6"],
      ["flat-4", "v12-60"],
    ] as const) {
      const layout = deriveLayout(LS7, B6_1_6, false, idA, idB);
      expect(widthOf(layout.bounds)).toBeLessThan(
        unionWidthAtSharedSpacing(LS7, idA, B6_1_6, idB),
      );
    }

    for (const id of ["inline-4", "v8-cross"] as const) {
      const layout = deriveLayout(LS7, LS7, false, id, id);
      expect(widthOf(layout.bounds)).toBeCloseTo(
        unionWidthAtSharedSpacing(LS7, id, LS7, id),
        9,
      );
    }
  });

  it("leaves every single-engine layout exactly as it was", () => {
    // Nothing outside the stacked path may move. A lone row is still spaced by
    // its own widest slot, centered on x = 0, and framed exactly — the rule
    // recomputed here from the placed slots rather than read off the source.
    for (const id of [
      "single",
      "inline-3",
      "inline-4",
      "inline-5",
      "inline-6",
      "v6-60",
      "v6-90-odd",
      "v8-cross",
      "v8-flat",
      "v10-72",
      "v12-60",
      "flat-4",
      "flat-6",
    ] as const) {
      for (const singleCylinderView of [true, false]) {
        for (const [, geometry] of GEOMETRIES) {
          const config = configFor(geometry, 10.5);
          const layout = deriveLayout(
            config,
            null,
            false,
            id,
            "single",
            singleCylinderView,
          );
          const slots = throwSlots(layout.primary);
          const world = worldBounds(layout.primary);

          expect(layout.secondary).toBeNull();
          expect((world.minX + world.maxX) / 2).toBeCloseTo(0, 9);
          expect(layout.bounds).toEqual(layout.primary.bounds);
          expect(layout.primary.bounds.minX).toBeCloseTo(world.minX, 9);
          expect(layout.primary.bounds.maxX).toBeCloseTo(world.maxX, 9);

          if (slots.length < 2) {
            continue;
          }
          const expected =
            (Math.max(...slots.map((s) => s.bounds.maxX)) +
              Math.max(...slots.map((s) => -s.bounds.minX))) *
            (1 + INLINE_GAP_FRACTION);
          for (let i = 1; i < slots.length; i += 1) {
            expect(slots[i].offsetXMm - slots[i - 1].offsetXMm).toBeCloseTo(
              expected,
              9,
            );
          }
          expect(layout.primary.cylinders.every((c) => c.offsetYMm === 0)).toBe(
            true,
          );
        }
      }
    }
  });
});

describe("deriveLayout — each stacked row is centered on its crank span (§24a)", () => {
  /**
   * The pairings this rule exists for, each written in both orders so neither
   * engine gets to be the one that happens to be centered.
   */
  const CENTERED_PAIRS: Array<[EngineLayoutId, EngineLayoutId]> = [
    // A narrow inline row against a wide V one — the unequal-length case.
    ["inline-6", "v8-cross"],
    ["v8-cross", "inline-6"],
    // The owner's real comparison: RB26DETT against VR38DETT.
    ["inline-6", "v6-60"],
    ["v6-60", "inline-6"],
    // Two paired layouts of very different lengths.
    ["flat-4", "v12-60"],
    ["v12-60", "flat-4"],
    // A one-cylinder engine against a multi-cylinder one: the degenerate span.
    ["single", "inline-6"],
    ["inline-6", "single"],
  ];

  /** The two GT-R engines the comparison was reported against. */
  const RB26DETT = ENGINE_PRESETS.find((p) => p.id === "skyline-gtr-rb26dett")!;
  const VR38DETT = ENGINE_PRESETS.find((p) => p.id === "gtr-r35-vr38dett")!;

  /**
   * The midpoint of a placed row's crank span: first crank center to last,
   * read off the placed slots rather than from anything the source published.
   *
   * A one-slot row's first and last crank center are the same point, so this
   * degenerates to that one center with no special case and nothing divided by
   * the slot count.
   */
  function crankSpanCenterXMm(placed: PlacedEngine): number {
    const slots = throwSlots(placed);
    return (slots[0].offsetXMm + slots[slots.length - 1].offsetXMm) / 2;
  }

  it("puts both rows' crank-span midpoints on the stack's center line", () => {
    for (const [idA, idB] of CENTERED_PAIRS) {
      for (const [, geometry] of GEOMETRIES) {
        const configB = configFor(geometry, 10.5);
        const layout = deriveLayout(LS7, configB, false, idA, idB);

        expect(layout.arrangement).toBe("stacked");
        expect(crankSpanCenterXMm(layout.primary)).toBeCloseTo(0, 9);
        expect(crankSpanCenterXMm(layout.secondary!)).toBeCloseTo(0, 9);
      }
    }
  });

  it("centers the two GT-R engines against each other", () => {
    // The comparison the change was made for: a 2.6 inline-6 stacked with a
    // 3.8 60° V6, whose rows are six narrow slots and three wide ones.
    const layout = deriveLayout(
      RB26DETT.config,
      VR38DETT.config,
      false,
      "inline-6",
      "v6-60",
    );
    const inline = throwSlots(layout.primary);
    const vee = throwSlots(layout.secondary!);

    expect(layout.arrangement).toBe("stacked");
    expect(inline).toHaveLength(6);
    expect(vee).toHaveLength(3);
    expect(crankSpanCenterXMm(layout.primary)).toBeCloseTo(0, 9);
    expect(crankSpanCenterXMm(layout.secondary!)).toBeCloseTo(0, 9);

    // The shorter row is the inline-6 here — six narrow cylinders span less
    // than three wide V throws — and it now sits symmetrically inside the V's
    // row rather than trailing off its left end.
    const a = worldBounds(layout.primary);
    const b = worldBounds(layout.secondary!);
    expect(a.maxX - a.minX).toBeLessThan(b.maxX - b.minX);
    expect(a.minX).toBeGreaterThan(b.minX);
    expect(a.maxX).toBeLessThan(b.maxX);
    expect(b.minX - a.minX).toBeCloseTo(a.maxX - b.maxX, 9);
  });

  it("centers a single-cylinder row on its own crank center", () => {
    // A degenerate crank span: one slot, so first and last crank center are
    // the same point and the row simply sits on the center line. Covered both
    // as a one-cylinder architecture and as a single-cylinder view of a V8.
    for (const [id, view] of [
      ["single", false],
      ["v8-cross", true],
    ] as const) {
      for (const [primaryFirst, layoutFor] of [
        [true, () => deriveLayout(LS7, B6_1_6, false, id, "inline-6", view)],
        [
          false,
          () => deriveLayout(LS7, B6_1_6, false, "inline-6", id, false, view),
        ],
      ] as const) {
        const layout = layoutFor();
        const lone = primaryFirst ? layout.primary : layout.secondary!;

        expect(layout.arrangement).toBe("stacked");
        expect(lone.cylinders).toHaveLength(1);
        expect(lone.cylinders[0].offsetXMm).toBeCloseTo(0, 9);
        expect(Number.isFinite(lone.cylinders[0].offsetXMm)).toBe(true);
      }
    }
  });

  /**
   * The superseded anchor, written out independently: both rows placed from
   * one shared slot-0 crank center, chosen so the union is centered on x = 0.
   * Kept only to measure what centering bought — it is never what the source
   * does now.
   */
  function crankSpanCenterAtSharedFirstThrow(
    configA: CrankMechanismConfig,
    idA: EngineLayoutId,
    configB: CrankMechanismConfig,
    idB: EngineLayoutId,
  ): [number, number] {
    const rows = [
      [configA, idA],
      [configB, idB],
    ].map(([config, id]) => {
      const placed = deriveLayout(
        config as CrankMechanismConfig,
        null,
        false,
        id as EngineLayoutId,
      ).primary;
      const slots = throwSlots(placed);
      const world = worldBounds(placed);
      // Relative to that row's own slot-0 crank center.
      return {
        leftReach: world.minX - slots[0].offsetXMm,
        rightReach: world.maxX - slots[0].offsetXMm,
        spanCenter:
          (slots[slots.length - 1].offsetXMm - slots[0].offsetXMm) / 2,
      };
    });
    const firstCenter =
      -(
        Math.min(...rows.map((r) => r.leftReach)) +
        Math.max(...rows.map((r) => r.rightReach))
      ) / 2;

    return [firstCenter + rows[0].spanCenter, firstCenter + rows[1].spanCenter];
  }

  it("pulls the shorter row back onto the center line the old anchor left it off", () => {
    for (const [configA, idA, configB, idB] of [
      [RB26DETT.config, "inline-6", VR38DETT.config, "v6-60"],
      [LS7, "inline-6", LS7, "v8-cross"],
    ] as const) {
      const before = crankSpanCenterAtSharedFirstThrow(
        configA,
        idA,
        configB,
        idB,
      );
      const layout = deriveLayout(configA, configB, false, idA, idB);
      const after = [
        crankSpanCenterXMm(layout.primary),
        crankSpanCenterXMm(layout.secondary!),
      ];

      // The premise: under the superseded anchor exactly one of the two rows
      // — the shorter — sat measurably off the frame's center line.
      const worstBefore = Math.max(...before.map(Math.abs));
      expect(worstBefore).toBeGreaterThan(20);
      // And now neither does.
      expect(Math.max(...after.map(Math.abs))).toBeLessThan(1e-9);
    }
  });

  it("keeps the shared zoom: centering moves rows, it never rescales one", () => {
    for (const [idA, idB] of CENTERED_PAIRS) {
      const layout = deriveLayout(LS7, B6_1_6, false, idA, idB);

      expect(layout.primary.proportions).toEqual(deriveProportions(LS7));
      expect(layout.secondary!.proportions).toEqual(deriveProportions(B6_1_6));
    }
  });

  it("frames the centered union exactly, and keeps both labels under their own row", () => {
    for (const [idA, idB] of CENTERED_PAIRS) {
      const layout = deriveLayout(
        RB26DETT.config,
        VR38DETT.config,
        true,
        idA,
        idB,
      );
      const a = worldBounds(layout.primary);
      const b = worldBounds(layout.secondary!);
      const labelA = layout.primary.label!;
      const labelB = layout.secondary!.label!;

      // Framing is recomputed from where the rows actually ended up.
      expect(layout.bounds.minX).toBeCloseTo(Math.min(a.minX, b.minX), 9);
      expect(layout.bounds.maxX).toBeCloseTo(Math.max(a.maxX, b.maxX), 9);
      expect(layout.bounds.maxY).toBeCloseTo(a.maxY, 9);
      expect(layout.bounds.minY).toBeLessThan(b.minY);
      expect((layout.bounds.minX + layout.bounds.maxX) / 2).toBeCloseTo(0, 9);

      // Each label is centered under its own engine, and inside the frame.
      expect(labelA.anchorXMm).toBeCloseTo((a.minX + a.maxX) / 2, 9);
      expect(labelB.anchorXMm).toBeCloseTo((b.minX + b.maxX) / 2, 9);
      for (const label of [labelA, labelB]) {
        expect(label.anchorXMm).toBeGreaterThanOrEqual(layout.bounds.minX);
        expect(label.anchorXMm).toBeLessThanOrEqual(layout.bounds.maxX);
        expect(label.anchorYMm).toBeGreaterThan(layout.bounds.minY);
        expect(label.anchorYMm).toBeLessThan(layout.bounds.maxY);
      }
      // A's label still sits in the gap between the engines, B's below.
      expect(labelA.anchorYMm).toBeLessThan(a.minY);
      expect(labelA.anchorYMm).toBeGreaterThan(b.maxY);
      expect(labelB.anchorYMm).toBeLessThan(b.minY);
    }
  });

  it("leaves the single-engine and side-by-side paths exactly where they were", () => {
    // Only `placeStacked` changed, so nothing that does not go through it may
    // move at all. Both other paths are checked against their arithmetic
    // written out independently here, not against anything the source
    // publishes: a lone row's left edge is `-width / 2`, and a side-by-side
    // pair's two left edges come from the unchanged comparison gap.
    for (const id of ENGINE_LAYOUT_IDS) {
      for (const singleCylinderView of [true, false]) {
        const lone = deriveLayout(
          LS7,
          null,
          false,
          id,
          "single",
          singleCylinderView,
        );
        expect(lone.arrangement).toBe("single");
        expect(lone.secondary).toBeNull();

        const slots = throwSlots(lone.primary);
        const spacing =
          slots.length > 1 ? slots[1].offsetXMm - slots[0].offsetXMm : 0;
        const leftReach = Math.min(
          ...slots.map((s, i) => i * spacing + s.bounds.minX),
        );
        const width =
          Math.max(...slots.map((s, i) => i * spacing + s.bounds.maxX)) -
          leftReach;
        // Left edge on `-width / 2`, so slot 0's crank center is exactly here.
        const firstCenterXMm = -width / 2 - leftReach;

        slots.forEach((slot, i) => {
          expect(slot.offsetXMm).toBeCloseTo(firstCenterXMm + i * spacing, 9);
          expect(slot.offsetYMm).toBe(0);
        });
        expect(lone.bounds).toEqual(lone.primary.bounds);
      }

      // Both engines showing one cylinder: still side by side, still the
      // pre-multi-cylinder arithmetic, untouched by the stacked rule.
      const pair = deriveLayout(LS7, B6_1_6, false, id, id, true, true);
      const boundsA = deriveProportions(LS7).bounds;
      const boundsB = deriveProportions(B6_1_6).bounds;
      const widthA = boundsA.maxX - boundsA.minX;
      const widthB = boundsB.maxX - boundsB.minX;
      const gap = (COMPARISON_GAP_FRACTION * (widthA + widthB)) / 2;
      const leftA = -(widthA + gap + widthB) / 2;
      const leftB = leftA + widthA + gap;

      expect(pair.arrangement).toBe("side-by-side");
      expect(pair.primary.cylinders[0].offsetXMm).toBeCloseTo(
        leftA - boundsA.minX,
        9,
      );
      expect(pair.secondary!.cylinders[0].offsetXMm).toBeCloseTo(
        leftB - boundsB.minX,
        9,
      );
      expect(pair.primary.cylinders[0].offsetYMm).toBe(0);
      expect(pair.secondary!.cylinders[0].offsetYMm).toBe(0);
    }
  });
});

describe("deriveLayout — the single-cylinder view (§24a)", () => {
  it("draws only cylinder 0, keeping the architecture's own phase and tilt", () => {
    for (const id of ["inline-6", "v8-cross", "flat-4"] as const) {
      const whole = deriveLayout(DEFAULT_CONFIG, null, false, id);
      const one = deriveLayout(DEFAULT_CONFIG, null, false, id, "single", true);

      expect(one.primary.cylinders).toHaveLength(1);
      expect(one.primary.cylinders[0].index).toBe(0);
      expect(one.primary.cylinders[0].crankPhaseRad).toBe(
        whole.primary.cylinders[0].crankPhaseRad,
      );
      expect(one.primary.cylinders[0].bankOffsetRad).toBe(
        whole.primary.cylinders[0].bankOffsetRad,
      );
      // Same mechanism, drawn at the same size: only the row got shorter.
      expect(one.primary.proportions).toEqual(whole.primary.proportions);
      expect(one.bounds.maxX - one.bounds.minX).toBeLessThan(
        whole.bounds.maxX - whole.bounds.minX,
      );
    }
  });

  it("frames one cylinder of an inline engine exactly as the old lone cylinder was", () => {
    // An inline architecture's cylinder 0 is upright and unphased, so viewing
    // one cylinder of an inline-6 must be indistinguishable from the layout
    // the app drew before architectures and views were separated.
    const legacy = deriveLayout(DEFAULT_CONFIG, null, true, "single");
    const viewed = deriveLayout(
      DEFAULT_CONFIG,
      null,
      true,
      "inline-6",
      "single",
      true,
    );

    expect(viewed.bounds).toEqual(legacy.bounds);
    expect(viewed.primary.cylinders).toEqual(legacy.primary.cylinders);
    expect(viewed.primary.label).toEqual(legacy.primary.label);
  });
});

describe("rotateBounds — a tilted cylinder's real footprint", () => {
  const BOX: SceneBounds = { minX: -2, maxX: 2, minY: -1, maxY: 3 };

  it("returns the same numbers for an upright cylinder", () => {
    expect(rotateBounds(BOX, 0)).toEqual(BOX);
  });

  it("swaps the axes for a quarter turn (a flat engine's bore)", () => {
    const rotated = rotateBounds(BOX, Math.PI / 2);
    expect(rotated.minX).toBeCloseTo(-3, 10);
    expect(rotated.maxX).toBeCloseTo(1, 10);
    expect(rotated.minY).toBeCloseTo(-2, 10);
    expect(rotated.maxY).toBeCloseTo(2, 10);
  });

  it("envelopes every rotated corner, for either sign of the angle", () => {
    for (const angle of [-Math.PI / 4, Math.PI / 4, -1.2, 2.7]) {
      const rotated = rotateBounds(BOX, angle);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      for (const x of [BOX.minX, BOX.maxX]) {
        for (const y of [BOX.minY, BOX.maxY]) {
          const rx = x * cos - y * sin;
          const ry = x * sin + y * cos;
          expect(rx).toBeGreaterThanOrEqual(rotated.minX - 1e-9);
          expect(rx).toBeLessThanOrEqual(rotated.maxX + 1e-9);
          expect(ry).toBeGreaterThanOrEqual(rotated.minY - 1e-9);
          expect(ry).toBeLessThanOrEqual(rotated.maxY + 1e-9);
        }
      }
    }
  });
});

describe("deriveLayout — V and flat layouts (§24a)", () => {
  const BANKED = ["v8-cross", "flat-4", "v12-60"] as const;

  it("tilts each cylinder onto its own bank", () => {
    for (const id of BANKED) {
      const layout = deriveLayout(DEFAULT_CONFIG, null, false, id);
      const definition = createEngineLayout(id);

      layout.primary.cylinders.forEach((cylinder, i) => {
        expect(cylinder.bankOffsetRad).toBe(
          definition.cylinders[i].bankOffsetRad,
        );
        // Alternating banks read as an alternating tilt, which is what makes
        // a V visibly a V on the stage.
        expect(Math.sign(cylinder.bankOffsetRad)).toBe(i % 2 === 0 ? -1 : 1);
      });
    }
  });

  it("measures a tilted cylinder by its rotated footprint, not its upright one", () => {
    const layout = deriveLayout(DEFAULT_CONFIG, null, false, "flat-4");
    const upright = layout.primary.proportions.bounds;

    for (const cylinder of layout.primary.cylinders) {
      expect(cylinder.bounds).toEqual(
        rotateBounds(upright, cylinder.bankOffsetRad),
      );
      // A flat engine's bores lie on their sides, so the footprint is wider
      // than it is tall — the opposite of the upright mechanism.
      const width = cylinder.bounds.maxX - cylinder.bounds.minX;
      const height = cylinder.bounds.maxY - cylinder.bounds.minY;
      expect(width).toBeCloseTo(upright.maxY - upright.minY, 10);
      expect(height).toBeCloseTo(upright.maxX - upright.minX, 10);
    }
  });

  it("leaves clear space between neighbouring throws at every geometry", () => {
    for (const id of BANKED) {
      for (const [, geometry] of GEOMETRIES) {
        const config = configFor(geometry, 10.5);
        const slots = throwSlots(deriveLayout(config, null, false, id).primary);

        // Nothing drawn in one throw's plane may reach into the next one's,
        // even though a V pair's two tilted mechanisms both count toward the
        // slot's footprint.
        for (let i = 1; i < slots.length; i += 1) {
          const gap =
            slots[i].offsetXMm +
            slots[i].bounds.minX -
            (slots[i - 1].offsetXMm + slots[i - 1].bounds.maxX);
          expect(gap).toBeGreaterThan(0);
        }
      }
    }
  });

  it("frames the whole tilted row exactly, centered on x = 0", () => {
    for (const id of BANKED) {
      const layout = deriveLayout(DEFAULT_CONFIG, null, false, id);
      const world = worldBounds(layout.primary);

      expect((world.minX + world.maxX) / 2).toBeCloseTo(0, 10);
      expect(layout.primary.bounds.minX).toBeCloseTo(world.minX, 10);
      expect(layout.primary.bounds.maxX).toBeCloseTo(world.maxX, 10);
      expect(layout.bounds.minX).toBeCloseTo(world.minX, 10);
      expect(layout.bounds.maxX).toBeCloseTo(world.maxX, 10);
      expect(layout.bounds.minY).toBeCloseTo(world.minY, 10);
      expect(layout.bounds.maxY).toBeCloseTo(world.maxY, 10);
    }
  });

  it("frames a flat engine wider and shorter than the same engine upright", () => {
    const inline = deriveLayout(DEFAULT_CONFIG, null, false, "inline-4");
    const flat = deriveLayout(DEFAULT_CONFIG, null, false, "flat-4");

    // The bores now point sideways, so the row needs more width and less
    // height. Framing that ignored the rotation would clip the outer bores.
    expect(flat.bounds.maxX - flat.bounds.minX).toBeGreaterThan(
      inline.bounds.maxX - inline.bounds.minX,
    );
    expect(flat.bounds.maxY - flat.bounds.minY).toBeLessThan(
      inline.bounds.maxY - inline.bounds.minY,
    );
  });

  it("contains every tilted cylinder's own footprint within the framed bounds", () => {
    for (const id of BANKED) {
      for (const [, geometry] of GEOMETRIES) {
        const config = configFor(geometry, 10.5);
        const layout = deriveLayout(config, null, false, id);

        for (const cylinder of layout.primary.cylinders) {
          expect(
            cylinder.offsetXMm + cylinder.bounds.minX,
          ).toBeGreaterThanOrEqual(layout.bounds.minX - 1e-9);
          expect(cylinder.offsetXMm + cylinder.bounds.maxX).toBeLessThanOrEqual(
            layout.bounds.maxX + 1e-9,
          );
          expect(cylinder.bounds.minY).toBeGreaterThanOrEqual(
            layout.bounds.minY - 1e-9,
          );
          expect(cylinder.bounds.maxY).toBeLessThanOrEqual(
            layout.bounds.maxY + 1e-9,
          );
        }
      }
    }
  });

  it("keeps two banked engines apart and framed in comparison mode", () => {
    for (const id of BANKED) {
      // Two multi-cylinder engines: the stacked arrangement (§24a).
      const layout = deriveLayout(LS7, B6_1_6, true, id, "flat-4");
      const a = worldBounds(layout.primary);
      const b = worldBounds(layout.secondary!);

      // No overlap, engine A above engine B, and the union framed exactly
      // (with a label band below each row).
      expect(layout.arrangement).toBe("stacked");
      expect(b.maxY).toBeLessThan(a.minY);
      expect(layout.bounds.minX).toBeCloseTo(Math.min(a.minX, b.minX), 10);
      expect(layout.bounds.maxX).toBeCloseTo(Math.max(a.maxX, b.maxX), 10);
      expect(layout.bounds.maxY).toBeCloseTo(a.maxY, 10);
      expect(layout.bounds.minY).toBeLessThan(b.minY);
      expect((layout.bounds.minX + layout.bounds.maxX) / 2).toBeCloseTo(0, 10);

      // Each label stays centered under its own tilted row.
      expect(layout.primary.label!.anchorXMm).toBeCloseTo(
        (a.minX + a.maxX) / 2,
        10,
      );
      expect(layout.secondary!.label!.anchorXMm).toBeCloseTo(
        (b.minX + b.maxX) / 2,
        10,
      );
    }
  });

  it("still places two banked engines side by side when both show one cylinder", () => {
    for (const id of BANKED) {
      const layout = deriveLayout(LS7, B6_1_6, true, id, "flat-4", true, true);
      const a = worldBounds(layout.primary);
      const b = worldBounds(layout.secondary!);

      expect(layout.arrangement).toBe("side-by-side");
      expect(a.maxX).toBeLessThan(b.minX);
      // Both crankshafts stay on y = 0, as they always have.
      expect(layout.primary.cylinders[0].offsetYMm).toBe(0);
      expect(layout.secondary!.cylinders[0].offsetYMm).toBe(0);
      expect(layout.primary.label!.anchorYMm).toBeCloseTo(
        layout.secondary!.label!.anchorYMm,
        10,
      );
    }
  });

  it("draws a V8 at the same scale as any other engine — only the layout differs", () => {
    const single = deriveLayout(LS7, null, false, "single");
    const v8 = deriveLayout(LS7, null, false, "v8-cross");

    expect(v8.primary.proportions).toEqual(single.primary.proportions);
    expect(v8.primary.cylinders).toHaveLength(8);
  });
});

/**
 * The pre-pairing row arithmetic: one slot per cylinder, which is what every
 * layout used before V and flat engines started sharing a plane per throw.
 *
 * Kept here, written out rather than imported, for two jobs: it is the
 * *expected* placement for inline and single layouts, which this change must
 * leave untouched, and it is the *baseline* a V8's new row is measured against.
 */
function perCylinderRow(config: CrankMechanismConfig, id: EngineLayoutId) {
  const proportions = deriveProportions(config);
  const cylinders = createEngineLayout(id).cylinders.map((c) =>
    rotateBounds(proportions.bounds, c.bankOffsetRad),
  );

  const spacingMm =
    (Math.max(...cylinders.map((b) => b.maxX)) +
      Math.max(...cylinders.map((b) => -b.minX))) *
    (1 + INLINE_GAP_FRACTION);
  const leftReachMm = Math.min(
    ...cylinders.map((b, i) => i * spacingMm + b.minX),
  );
  const widthMm =
    Math.max(...cylinders.map((b, i) => i * spacingMm + b.maxX)) - leftReachMm;

  // A lone row is centered on x = 0, so its left edge is at -width / 2.
  const firstCenterXMm = -widthMm / 2 - leftReachMm;

  return {
    spacingMm,
    widthMm,
    offsetsXMm: cylinders.map((_, i) => firstCenterXMm + i * spacingMm),
    bounds: {
      minX: -widthMm / 2,
      maxX: -widthMm / 2 + widthMm,
      minY: Math.min(...cylinders.map((b) => b.minY)),
      maxY: Math.max(...cylinders.map((b) => b.maxY)),
    } satisfies SceneBounds,
  };
}

describe("deriveLayout — one plane per throw for V and flat engines (§24a)", () => {
  /** Every layout that pairs its cylinders onto shared planes. */
  const PAIRED = [
    "v8-cross",
    "v8-flat",
    "v6-60",
    "v6-90-odd",
    "flat-4",
    "flat-6",
    "v10-72",
    "v12-60",
  ] as const;

  /** Layouts that must come out of this change bit for bit unchanged. */
  const UPRIGHT = [
    "single",
    "inline-3",
    "inline-4",
    "inline-5",
    "inline-6",
  ] as const;

  it("draws the two cylinders of each throw around one crank center", () => {
    for (const id of PAIRED) {
      const cylinders = deriveLayout(DEFAULT_CONFIG, null, false, id).primary
        .cylinders;
      const definition = createEngineLayout(id);

      // Half as many planes as cylinders, and the pair on throw k — indices
      // 2k and 2k+1, which is how the layout orders its banks — shares one.
      expect(
        throwSlots(deriveLayout(DEFAULT_CONFIG, null, false, id).primary),
      ).toHaveLength(definition.cylinders.length / 2);

      for (let k = 0; 2 * k + 1 < cylinders.length; k += 1) {
        const bank0 = cylinders[2 * k];
        const bank1 = cylinders[2 * k + 1];

        expect(bank0.bankIndex).toBe(0);
        expect(bank1.bankIndex).toBe(1);
        expect(bank0.throwIndex).toBe(k);
        expect(bank1.throwIndex).toBe(k);
        expect(bank1.offsetXMm).toBe(bank0.offsetXMm);
        expect(bank1.offsetYMm).toBe(bank0.offsetYMm);
        // Opposite tilts about that one center: the V of a V engine.
        expect(bank1.bankOffsetRad).toBeCloseTo(-bank0.bankOffsetRad, 12);
      }
    }
  });

  it("keeps every cylinder of an inline engine in a plane of its own", () => {
    for (const id of UPRIGHT) {
      const { cylinders } = deriveLayout(
        DEFAULT_CONFIG,
        null,
        false,
        id,
      ).primary;
      expect(
        throwSlots(deriveLayout(DEFAULT_CONFIG, null, false, id).primary),
      ).toHaveLength(cylinders.length);
      for (const cylinder of cylinders) {
        expect(cylinder.throwIndex).toBe(cylinder.index);
        expect(cylinder.offsetZMm).toBe(0);
        expect(cylinder.drawsCrank).toBe(true);
      }
    }
  });

  it("draws one crank per throw on a shared-pin V, two on a flying-arm V or a boxer", () => {
    // Not a fact about the layout *kind*: a 60° V6's separate, flying-arm-
    // joined crankpins and a boxer's antipodal throws are two real pins per
    // pair, and both must be drawn, while a plain-pin V pair's two crank
    // drawings would coincide exactly and one of them is dropped.
    const expected: Record<string, number> = {
      "v8-cross": 1,
      "v8-flat": 1,
      "v6-90-odd": 1,
      "v10-72": 1,
      "v12-60": 1,
      "v6-60": 2,
      "flat-4": 2,
      "flat-6": 2,
    };

    for (const id of PAIRED) {
      for (const slot of throwSlots(
        deriveLayout(DEFAULT_CONFIG, null, false, id).primary,
      )) {
        expect(slot.cylinders).toHaveLength(2);
        expect(slot.cylinders.filter((c) => c.drawsCrank)).toHaveLength(
          expected[id],
        );
        // Whichever way it falls, the plane's first cylinder always draws, so
        // a crank is never omitted from a plane that has none.
        expect(slot.cylinders[0].drawsCrank).toBe(true);
        // And a crank is dropped only where the pins genuinely coincide.
        expect(slot.cylinders[1].drawsCrank).toBe(
          !sharesCrankpin(slot.cylinders[0], slot.cylinders[1]),
        );
      }
    }
  });

  it("steps a throw's second cylinder behind its partner so nothing is coplanar", () => {
    for (const [, geometry] of GEOMETRIES) {
      const config = configFor(geometry, 10.5);
      const layout = deriveLayout(config, null, false, "flat-4");
      const p = layout.primary.proportions;
      const step = p.rodDepthMm / 2;

      for (const slot of throwSlots(layout.primary)) {
        expect(slot.cylinders[0].offsetZMm).toBe(0);
        expect(slot.cylinders[1].offsetZMm).toBe(-step);
      }

      // The step exists at all: a boxer pair's main journals sit on the same
      // axis and its bore centerlines are collinear, so a zero step would
      // z-fight.
      expect(step).toBeGreaterThan(0);
      // ...and stays small enough that the stepped cylinder's reference plane
      // is still in front of its partner's bore walls, so its centerline and
      // dead-center ticks are not swallowed by the other bank.
      expect(step).toBeLessThan(p.referenceZMm - p.cylinderDepthMm / 2);
      // ...and small enough that its rod's big end stays inside the drawn
      // crankpin's axial span, which is what makes two rods on one pin read as
      // two rods on one pin.
      const pinFrontZ = p.crankZMm + p.crankPinZMm + p.crankPinLengthMm / 2;
      const pinBackZ = p.crankZMm + p.crankPinZMm - p.crankPinLengthMm / 2;
      const bigEndHalfDepth = (p.rodDepthMm * 1.4) / 2;
      expect(-step - bigEndHalfDepth).toBeGreaterThan(pinBackZ);
      expect(-step + bigEndHalfDepth).toBeLessThan(pinFrontZ);
    }
  });

  it("draws the crank-direction ring exactly once, on the first throw", () => {
    // `MechanismStage` gates the ring on `index === 0`; pairing must not have
    // put two cylinders, or a cylinder of a later throw, in that position.
    for (const id of [...PAIRED, ...UPRIGHT]) {
      const { cylinders } = deriveLayout(
        DEFAULT_CONFIG,
        null,
        false,
        id,
      ).primary;
      const front = cylinders.filter((c) => c.index === 0);

      expect(front).toHaveLength(1);
      expect(front[0].throwIndex).toBe(0);
      expect(front[0]).toBe(cylinders[0]);
    }
  });

  it("halves a V8's row and frames it appreciably larger", () => {
    const before = perCylinderRow(LS7, "v8-cross");
    const after = deriveLayout(LS7, null, false, "v8-cross");
    const width = after.bounds.maxX - after.bounds.minX;
    const height = after.bounds.maxY - after.bounds.minY;

    // Four V-shaped slots instead of eight upright ones, at unchanged slot
    // spacing: the row loses four whole slots of width.
    const slots = throwSlots(after.primary);
    expect(slots).toHaveLength(4);
    expect(slots[1].offsetXMm - slots[0].offsetXMm).toBeCloseTo(
      before.spacingMm,
      9,
    );
    // Four slots' worth of row disappears (a little less than four spacings,
    // since a slot reaches wider than either of its cylinders alone at the two
    // ends of the row), and the whole row comes in at just over half.
    expect(before.widthMm - width).toBeGreaterThan(3 * before.spacingMm);
    expect(width).toBeLessThan(0.6 * before.widthMm);

    // Height is untouched — nothing is rescaled (§12.2), the row is just
    // shorter — so the shared zoom, which was width-constrained on a row this
    // wide, rises by the full width ratio.
    expect(height).toBeCloseTo(before.bounds.maxY - before.bounds.minY, 9);
    const zoomFor = (w: number) =>
      Math.min(1600 / (w * FRAME_PADDING), 900 / (height * FRAME_PADDING));
    expect(zoomFor(width) / zoomFor(before.widthMm)).toBeGreaterThan(1.7);
  });

  it("leaves inline and single layouts exactly where they were", () => {
    // The whole change is scoped to layouts that pair banks. An inline row is
    // still one cylinder per slot, at the same spacing, framed identically —
    // checked against the row arithmetic written out independently above.
    for (const id of UPRIGHT) {
      for (const [, geometry] of GEOMETRIES) {
        const config = configFor(geometry, 10.5);
        const expected = perCylinderRow(config, id);
        const layout = deriveLayout(config, null, false, id);

        expect(layout.primary.cylinders.map((c) => c.offsetXMm)).toEqual(
          expected.offsetsXMm,
        );
        expect(layout.primary.cylinders.map((c) => c.offsetYMm)).toEqual(
          expected.offsetsXMm.map(() => 0),
        );
        expect(layout.bounds).toEqual(expected.bounds);
        expect(layout.primary.bounds).toEqual(expected.bounds);
      }
    }
  });

  it("keeps the stacked comparison arranged in throw rows", () => {
    // A V8 over a flat-6: four slots against three, each row at its own
    // spacing and centered on its own crank span (§24a).
    const layout = deriveLayout(LS7, B6_1_6, false, "v8-cross", "flat-6");
    const a = throwSlots(layout.primary);
    const b = throwSlots(layout.secondary!);

    expect(layout.arrangement).toBe("stacked");
    expect(a).toHaveLength(4);
    expect(b).toHaveLength(3);
    for (const slots of [a, b]) {
      expect(
        (slots[0].offsetXMm + slots[slots.length - 1].offsetXMm) / 2,
      ).toBeCloseTo(0, 9);
    }

    // Both rows here are paired layouts of different bore, so their natural
    // spacings genuinely differ and neither is stretched to the other's.
    const spacingA = a[1].offsetXMm - a[0].offsetXMm;
    const spacingB = b[1].offsetXMm - b[0].offsetXMm;
    expect(spacingA).toBeCloseTo(slotSpacingAlone(LS7, "v8-cross"), 9);
    expect(spacingB).toBeCloseTo(slotSpacingAlone(B6_1_6, "flat-6"), 9);

    // Engine A still sits above engine B, with every cylinder of each row on
    // its own engine's crankshaft height.
    for (const cylinder of layout.primary.cylinders) {
      expect(cylinder.offsetYMm).toBe(0);
    }
    const centerYB = layout.secondary!.cylinders[0].offsetYMm;
    expect(centerYB).toBeLessThan(0);
    for (const cylinder of layout.secondary!.cylinders) {
      expect(cylinder.offsetYMm).toBe(centerYB);
    }
  });
});

describe("drawn orientation — presentation, not the layout's real geometry (§24a)", () => {
  /** Every architecture the picker offers, so nothing is silently skipped. */
  const ALL = [
    "inline-3",
    "inline-4",
    "inline-5",
    "inline-6",
    "v6-60",
    "v6-90-odd",
    "v8-cross",
    "v8-flat",
    "v10-72",
    "v12-60",
    "flat-4",
    "flat-6",
  ] as const;

  const FLAT = ["flat-4", "flat-6"] as const;
  const UNAFFECTED = ["v8-cross", "v12-60", "inline-6", "inline-4"] as const;

  /**
   * Which way a cylinder's bore points once its drawing has been rotated: the
   * mechanism's own bore axis is +Y, and a rotation of β about Z takes (0, 1)
   * to (−sin β, cos β).
   */
  function boreDirection(rotationRad: number): { x: number; y: number } {
    return { x: -Math.sin(rotationRad), y: Math.cos(rotationRad) };
  }

  it("draws one isolated cylinder upright, whatever engine it came from", () => {
    // The deliberate abstraction (§24a): the single-cylinder view is about a
    // cylinder's proportions, not its installed orientation, so a boxer's
    // cylinder is not left lying on its side next to an upright S2000's.
    for (const id of ALL) {
      for (const upright of [false, true]) {
        const layout = deriveLayout(
          DEFAULT_CONFIG,
          null,
          false,
          id,
          "single",
          true,
          false,
          upright,
        );
        const cylinder = layout.primary.cylinders[0];

        expect(layout.primary.cylinders).toHaveLength(1);
        expect(cylinder.drawnRotationRad).toBe(0);
        // Measured upright too, so framing and spacing follow the drawing.
        expect(cylinder.bounds).toEqual(layout.primary.proportions.bounds);
        // ...while the engine's own geometry is reported untouched.
        expect(cylinder.bankOffsetRad).toBe(
          createEngineLayout(id).cylinders[0].bankOffsetRad,
        );
      }
    }
  });

  it("frames one cylinder of any engine exactly as one cylinder of an inline-4", () => {
    // The point of drawing it upright: two engines' cylinders can be compared
    // by size because they are drawn in the same orientation.
    const reference = deriveLayout(
      DEFAULT_CONFIG,
      null,
      true,
      "inline-4",
      "single",
      true,
    );

    for (const id of ALL) {
      const one = deriveLayout(DEFAULT_CONFIG, null, true, id, "single", true);
      expect(one.bounds).toEqual(reference.bounds);
      expect(one.primary.cylinders[0].bounds).toEqual(
        reference.primary.cylinders[0].bounds,
      );
    }
  });

  it("draws both compared engines' lone cylinders upright, and still side by side", () => {
    const layout = deriveLayout(
      LS7,
      B6_1_6,
      false,
      "flat-6",
      "v8-cross",
      true,
      true,
    );

    // Part 1 is about rotation only: the arrangement rule keys off how many
    // cylinders are shown, which it does not touch.
    expect(layout.arrangement).toBe("side-by-side");
    expect(layout.primary.cylinders[0].drawnRotationRad).toBe(0);
    expect(layout.secondary!.cylinders[0].drawnRotationRad).toBe(0);
    expect(worldBounds(layout.primary).maxX).toBeLessThan(
      worldBounds(layout.secondary!).minX,
    );
  });

  it("keeps every real bank tilt in the full-engine view while the preference is off", () => {
    for (const id of ALL) {
      const layout = deriveLayout(DEFAULT_CONFIG, null, false, id);
      const definition = createEngineLayout(id);

      layout.primary.cylinders.forEach((cylinder, i) => {
        expect(cylinder.drawnRotationRad).toBe(
          definition.cylinders[i].bankOffsetRad,
        );
        expect(cylinder.bounds).toEqual(
          rotateBounds(
            layout.primary.proportions.bounds,
            cylinder.bankOffsetRad,
          ),
        );
      });
    }
  });

  it("turns only flat layouts by a quarter turn when the preference is on", () => {
    for (const id of ALL) {
      const off = deriveLayout(DEFAULT_CONFIG, null, false, id);
      const on = deriveLayout(
        DEFAULT_CONFIG,
        null,
        false,
        id,
        "single",
        false,
        false,
        true,
      );
      const flat = (FLAT as readonly string[]).includes(id);

      on.primary.cylinders.forEach((cylinder, i) => {
        expect(cylinder.drawnRotationRad).toBeCloseTo(
          off.primary.cylinders[i].drawnRotationRad +
            (flat ? UPRIGHT_FLAT_ROTATION_RAD : 0),
          12,
        );
        // The engine layer keeps describing the real engine either way.
        expect(cylinder.bankOffsetRad).toBe(
          off.primary.cylinders[i].bankOffsetRad,
        );
      });
    }

    // Spelled out for the layouts that must be untouched, so a rule that
    // accidentally caught V or inline engines could not pass the loop above.
    for (const id of UNAFFECTED) {
      const on = deriveLayout(
        DEFAULT_CONFIG,
        null,
        false,
        id,
        "single",
        false,
        false,
        true,
      );
      expect(on).toEqual(deriveLayout(DEFAULT_CONFIG, null, false, id));
    }
  });

  it("stands an opposed pair one piston above the crank and its partner below", () => {
    for (const id of FLAT) {
      const layout = deriveLayout(
        DEFAULT_CONFIG,
        null,
        false,
        id,
        "single",
        false,
        false,
        true,
      );

      for (const slot of throwSlots(layout.primary)) {
        expect(slot.cylinders).toHaveLength(2);
        const up = boreDirection(slot.cylinders[0].drawnRotationRad);
        const down = boreDirection(slot.cylinders[1].drawnRotationRad);

        // Bank 0's bore points straight up, bank 1's straight down: still one
        // crank, still 180° opposed, now vertical.
        expect(up.x).toBeCloseTo(0, 12);
        expect(up.y).toBeCloseTo(1, 12);
        expect(down.x).toBeCloseTo(0, 12);
        expect(down.y).toBeCloseTo(-1, 12);
      }
    }
  });

  it("leaves shared-pin and one-crank-per-throw decisions alone", () => {
    // Whether a pair shares a crankpin is a fact about the engine, and the
    // whole pair turns by the same angle, so neither the pin relationship nor
    // the crank-drawing decision may move with the preference.
    for (const id of ALL) {
      const off = deriveLayout(DEFAULT_CONFIG, null, false, id);
      const on = deriveLayout(
        DEFAULT_CONFIG,
        null,
        false,
        id,
        "single",
        false,
        false,
        true,
      );

      on.primary.cylinders.forEach((cylinder, i) => {
        expect(cylinder.drawsCrank).toBe(off.primary.cylinders[i].drawsCrank);
        expect(cylinder.throwIndex).toBe(off.primary.cylinders[i].throwIndex);
        expect(cylinder.crankPhaseRad).toBe(
          off.primary.cylinders[i].crankPhaseRad,
        );
      });

      for (const slot of throwSlots(on.primary)) {
        expect(slot.cylinders[0].drawsCrank).toBe(true);
        if (slot.cylinders.length === 2) {
          expect(slot.cylinders[1].drawsCrank).toBe(
            !sharesCrankpin(slot.cylinders[0], slot.cylinders[1]),
          );
        }
      }
      // ...and the crank-direction ring is still drawn exactly once, on the
      // cylinder `MechanismStage` gates it on.
      expect(on.primary.cylinders.filter((c) => c.index === 0)).toHaveLength(1);
      expect(on.primary.cylinders[0].index).toBe(0);
    }
  });

  it("makes an upright boxer's throw tall and narrow instead of wide and short", () => {
    const flat = deriveLayout(DEFAULT_CONFIG, null, false, "flat-4");
    const upright = deriveLayout(
      DEFAULT_CONFIG,
      null,
      false,
      "flat-4",
      "single",
      false,
      false,
      true,
    );

    const lying = throwSlots(flat.primary)[0].bounds;
    const standing = throwSlots(upright.primary)[0].bounds;

    // A quarter turn swaps the footprint's axes exactly.
    expect(standing.maxX - standing.minX).toBeCloseTo(
      lying.maxY - lying.minY,
      9,
    );
    expect(standing.maxY - standing.minY).toBeCloseTo(
      lying.maxX - lying.minX,
      9,
    );
    // ...so the whole row narrows and grows taller, and the framing follows.
    expect(upright.bounds.maxX - upright.bounds.minX).toBeLessThan(
      flat.bounds.maxX - flat.bounds.minX,
    );
    expect(upright.bounds.maxY - upright.bounds.minY).toBeGreaterThan(
      flat.bounds.maxY - flat.bounds.minY,
    );
  });

  it("frames an upright boxer exactly and never overlaps its throws", () => {
    for (const id of FLAT) {
      for (const [, geometry] of GEOMETRIES) {
        const config = configFor(geometry, 10.5);
        const layout = deriveLayout(
          config,
          null,
          false,
          id,
          "single",
          false,
          false,
          true,
        );
        const slots = throwSlots(layout.primary);

        // Adjacent throws stay clear of one another at the new footprint.
        for (let i = 1; i < slots.length; i += 1) {
          const gap =
            slots[i].offsetXMm +
            slots[i].bounds.minX -
            (slots[i - 1].offsetXMm + slots[i - 1].bounds.maxX);
          expect(gap).toBeGreaterThan(0);
        }

        // ...and the published bounds are exactly the union of what is drawn,
        // centered on x = 0, so the camera fit cannot clip a standing bore.
        const world = worldBounds(layout.primary);
        expect((world.minX + world.maxX) / 2).toBeCloseTo(0, 9);
        expect(layout.bounds.minX).toBeCloseTo(world.minX, 9);
        expect(layout.bounds.maxX).toBeCloseTo(world.maxX, 9);
        expect(layout.bounds.minY).toBeCloseTo(world.minY, 9);
        expect(layout.bounds.maxY).toBeCloseTo(world.maxY, 9);
      }
    }
  });

  it("leaves the comparison arrangement rule untouched in every mode", () => {
    // The rule keys off how many cylinders are shown, and neither part of this
    // change alters that — only how the cylinders that are shown are turned.
    const cases: Array<[boolean, boolean, string]> = [
      [true, true, "side-by-side"],
      [true, false, "stacked"],
      [false, true, "stacked"],
      [false, false, "stacked"],
    ];

    for (const [viewA, viewB, expected] of cases) {
      for (const upright of [false, true]) {
        const layout = deriveLayout(
          LS7,
          B6_1_6,
          false,
          "flat-6",
          "flat-4",
          viewA,
          viewB,
          upright,
        );
        expect(layout.arrangement).toBe(expected);

        // Whatever the axis, the two engines never overlap.
        const a = worldBounds(layout.primary);
        const b = worldBounds(layout.secondary!);
        if (expected === "stacked") {
          expect(b.maxY).toBeLessThan(a.minY);
        } else {
          expect(a.maxX).toBeLessThan(b.minX);
        }
      }
    }
  });

  it("applies the preference to both compared engines at once", () => {
    const layout = deriveLayout(
      LS7,
      B6_1_6,
      false,
      "flat-4",
      "flat-6",
      false,
      false,
      true,
    );

    for (const engine of [layout.primary, layout.secondary!]) {
      for (const cylinder of engine.cylinders) {
        expect(cylinder.drawnRotationRad).toBeCloseTo(
          cylinder.bankOffsetRad + UPRIGHT_FLAT_ROTATION_RAD,
          12,
        );
      }
    }
  });

  it("is the one rule every drawn rotation comes from", () => {
    // `drawnRotationRad` is exported so the decision has exactly one
    // implementation; `deriveLayout` must agree with it cylinder for cylinder.
    for (const id of ALL) {
      const definition = createEngineLayout(id);
      for (const single of [false, true]) {
        for (const upright of [false, true]) {
          const layout = deriveLayout(
            DEFAULT_CONFIG,
            null,
            false,
            id,
            "single",
            single,
            false,
            upright,
          );
          for (const cylinder of layout.primary.cylinders) {
            expect(cylinder.drawnRotationRad).toBe(
              drawnRotationRad(cylinder, definition.kind, single, upright),
            );
          }
        }
      }
    }
  });
});

describe("deriveLayout — the architecture rides out with the row (§24a)", () => {
  it("carries the shared frozen layout instance, not a rebuilt copy", () => {
    // The frame loop needs the architecture to ask the engine layer each
    // cylinder's four-stroke phase (`cylinderStrokePhaseAt`), which depends on
    // the layout's firing order. It must be the cached instance
    // `createEngineLayout` returns: the loop holds it across frames and must
    // never cause a layout to be rebuilt per frame (§18).
    const layout = deriveLayout(
      DEFAULT_CONFIG,
      B6_1_6,
      false,
      "v8-cross",
      "inline-6",
    );

    expect(layout.primary.layout).toBe(createEngineLayout("v8-cross"));
    expect(layout.secondary?.layout).toBe(createEngineLayout("inline-6"));
  });

  it("keeps the whole architecture even when only cylinder 0 is drawn", () => {
    // The single-cylinder view isolates one cylinder of a real engine; that
    // cylinder still fires on the engine's own schedule, and its firing angle
    // (cylinder 0's, always 0) comes from the full layout.
    const layout = deriveLayout(
      DEFAULT_CONFIG,
      null,
      false,
      "v6-90-odd",
      "single",
      true,
    );

    expect(layout.primary.cylinders).toHaveLength(1);
    expect(layout.primary.layout).toBe(createEngineLayout("v6-90-odd"));
    expect(layout.primary.layout.cylinders).toHaveLength(6);
  });
});
