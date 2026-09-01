/**
 * The rotary parts' extruded outlines (§27).
 *
 * `Shape` and `ExtrudeGeometry` are pure JavaScript — no WebGL context needed —
 * so the one thing that cannot be checked by reading the numbers *can* be
 * checked here: that these outlines actually triangulate. A self-intersecting
 * contour or a hole wound the wrong way does not throw; it silently produces
 * torn geometry, which is exactly the kind of failure a headless test suite
 * would otherwise never see.
 *
 * The other claim worth pinning is that the extruded housing occupies exactly
 * the extents `deriveRotaryProportions` reports, since those extents are what
 * the camera frames and what the row spacing is derived from. If the two ever
 * disagreed, a rotary would be drawn clipped or overlapping its neighbour.
 */

import { describe, expect, it } from "vitest";
import { Box3, ExtrudeGeometry, Mesh, Vector2 } from "three";
import { TWO_PI } from "../engine/constants";
import { ROTOR_FACE_COUNT } from "../engine/rotaryConstants";
import type { RotaryConfig } from "../engine/rotaryTypes";
import {
  housingShape,
  rotorCoreShape,
  rotorFaceSkinShape,
} from "./rotaryShapes";
import { deriveRotaryProportions } from "./rotarySceneGeometry";

const THIRTEEN_B: RotaryConfig = {
  generatingRadiusMm: 105,
  eccentricityMm: 15,
  rotorWidthMm: 80,
  compressionRatio: 9,
  redlineRpm: 8000,
};

/** A low-K housing, where the trochoid is at its lumpiest and least forgiving. */
const LOW_K: RotaryConfig = {
  ...THIRTEEN_B,
  generatingRadiusMm: 76,
  eccentricityMm: 25,
};

function shoelaceArea(points: readonly Vector2[]): number {
  let twice = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    twice += points[j].x * points[i].y - points[i].x * points[j].y;
  }
  return Math.abs(twice) / 2;
}

function extrudedBox(geometry: ExtrudeGeometry): Box3 {
  const mesh = new Mesh(geometry);
  return new Box3().setFromObject(mesh);
}

function allFinite(geometry: ExtrudeGeometry): boolean {
  const positions = geometry.getAttribute("position").array;
  for (let i = 0; i < positions.length; i += 1) {
    if (!Number.isFinite(positions[i])) return false;
  }
  return true;
}

describe("housingShape", () => {
  it("is a band: the wall as a contour with the working surface as a hole", () => {
    const p = deriveRotaryProportions(THIRTEEN_B);
    const shape = housingShape(p);

    expect(shape.holes).toHaveLength(1);
    expect(shape.extractPoints(1).shape).toHaveLength(p.housingOuterMm.length);
    // The hole is genuinely smaller: a band, not a solid disc with a token
    // hole punched somewhere inside it.
    const outerArea = shoelaceArea(shape.extractPoints(1).shape);
    const innerArea = shoelaceArea(shape.extractPoints(1).holes[0]);
    expect(innerArea).toBeLessThan(outerArea);
    expect(innerArea).toBeGreaterThan(0.8 * outerArea);
  });

  it("extrudes to geometry occupying exactly the bounds the camera frames", () => {
    for (const config of [THIRTEEN_B, LOW_K]) {
      const p = deriveRotaryProportions(config);
      const geometry = new ExtrudeGeometry(housingShape(p), {
        depth: p.housingDepthMm,
        bevelEnabled: false,
      });

      expect(geometry.getAttribute("position").count).toBeGreaterThan(0);
      expect(allFinite(geometry)).toBe(true);

      // Three decimals, not more: vertex positions live in a Float32 buffer,
      // so a 130 mm coordinate carries about five significant decimals.
      const box = extrudedBox(geometry);
      expect(box.min.x).toBeCloseTo(p.bounds.minX, 3);
      expect(box.max.x).toBeCloseTo(p.bounds.maxX, 3);
      expect(box.min.y).toBeCloseTo(p.bounds.minY, 3);
      expect(box.max.y).toBeCloseTo(p.bounds.maxY, 3);
      expect(box.max.z - box.min.z).toBeCloseTo(p.housingDepthMm, 3);

      geometry.dispose();
    }
  });
});

describe("rotorCoreShape and rotorFaceSkinShape", () => {
  /** The full drawn rotor outline: the three flank arcs, unscaled. */
  function rotorOutline(config: RotaryConfig): Vector2[] {
    const p = deriveRotaryProportions(config);
    const points: Vector2[] = [];
    for (let face = 0; face < ROTOR_FACE_COUNT; face += 1) {
      const angle = (TWO_PI * face) / ROTOR_FACE_COUNT;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      for (let i = 0; i < p.rotorFlankMm.length - 1; i += 1) {
        const point = p.rotorFlankMm[i];
        points.push(
          new Vector2(
            point.xMm * cos - point.yMm * sin,
            point.xMm * sin + point.yMm * cos,
          ),
        );
      }
    }
    return points;
  }

  it("tiles the rotor: the core plus three skins is the whole outline", () => {
    // The two shapes are built independently, so this is a real check that
    // the skin band and the core meet exactly rather than overlapping (which
    // would z-fight) or leaving a gap (which would show the background
    // through the rotor).
    for (const config of [THIRTEEN_B, LOW_K]) {
      const p = deriveRotaryProportions(config);
      const coreArea = shoelaceArea(rotorCoreShape(p).extractPoints(1).shape);
      const skinArea = shoelaceArea(
        rotorFaceSkinShape(p).extractPoints(1).shape,
      );
      const wholeArea = shoelaceArea(rotorOutline(config));

      expect(coreArea + ROTOR_FACE_COUNT * skinArea).toBeCloseTo(wholeArea, 6);
    }
  });

  it("scales the core by exactly the skin fraction", () => {
    const p = deriveRotaryProportions(THIRTEEN_B);
    const coreArea = shoelaceArea(rotorCoreShape(p).extractPoints(1).shape);
    const wholeArea = shoelaceArea(rotorOutline(THIRTEEN_B));

    // Area scales as the square of a linear scaling about the same center.
    expect(coreArea / wholeArea).toBeCloseTo(p.rotorCoreScale ** 2, 9);
  });

  it("extrudes both to finite, non-degenerate geometry", () => {
    for (const config of [THIRTEEN_B, LOW_K]) {
      const p = deriveRotaryProportions(config);
      const options = { depth: p.rotorDepthMm, bevelEnabled: false };

      for (const shape of [rotorCoreShape(p), rotorFaceSkinShape(p)]) {
        const geometry = new ExtrudeGeometry(shape, options);
        expect(geometry.getAttribute("position").count).toBeGreaterThan(0);
        expect(allFinite(geometry)).toBe(true);
        const box = extrudedBox(geometry);
        expect(box.max.z - box.min.z).toBeCloseTo(p.rotorDepthMm, 3);
        geometry.dispose();
      }
    }
  });

  it("keeps the drawn rotor inside its own generating radius", () => {
    // A bulging flank must never push the rotor's outline past its apexes;
    // the apexes are the rotor's greatest reach by definition.
    const p = deriveRotaryProportions(THIRTEEN_B);
    for (const point of rotorOutline(THIRTEEN_B)) {
      expect(point.length()).toBeLessThanOrEqual(
        THIRTEEN_B.generatingRadiusMm + 1e-9,
      );
    }
    for (const point of rotorCoreShape(p).extractPoints(1).shape) {
      expect(point.length()).toBeLessThanOrEqual(
        THIRTEEN_B.generatingRadiusMm * p.rotorCoreScale + 1e-9,
      );
    }
  });
});
