/**
 * Turns the sampled curves in `rotarySceneGeometry.ts` into the Three.js
 * `Shape`s the rotary parts are extruded from (§27).
 *
 * Kept apart from `rotarySceneGeometry.ts` so that module stays pure
 * TypeScript and fully testable without a WebGL context: everything here is
 * bookkeeping — winding, hole nesting, closing a polygon — with no geometry
 * decisions of its own. Every point it reads was already decided there.
 *
 * All three builders are called from a `useMemo` keyed on the proportions, so
 * they run once per configuration and never per frame (§18).
 */

import { Path, Shape, Vector2 } from "three";
import { TWO_PI } from "../engine/constants";
import { ROTOR_FACE_COUNT } from "../engine/rotaryConstants";
import type { RotaryPointMm } from "../engine/rotaryTypes";
import type { RotaryProportions } from "./rotarySceneGeometry";

/** Angular pitch between adjacent faces in the rotor frame: 120°. */
const FACE_PITCH_RAD = TWO_PI / ROTOR_FACE_COUNT;

function toVectors(points: readonly RotaryPointMm[]): Vector2[] {
  return points.map((point) => new Vector2(point.xMm, point.yMm));
}

/** The same points scaled about their frame's origin. */
function scaled(points: readonly RotaryPointMm[], scale: number): Vector2[] {
  return points.map(
    (point) => new Vector2(point.xMm * scale, point.yMm * scale),
  );
}

/** The same points rotated about their frame's origin. */
function rotated(
  points: readonly RotaryPointMm[],
  angleRad: number,
): Vector2[] {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return points.map(
    (point) =>
      new Vector2(
        point.xMm * cos - point.yMm * sin,
        point.xMm * sin + point.yMm * cos,
      ),
  );
}

/**
 * The housing: the wall between the trochoid and its outward scaling, as a
 * closed band.
 *
 * Drawn as a ring — outer contour with the working surface as a hole — rather
 * than as a solid disc, so the rotor inside is never hidden behind it and the
 * view stays the cutaway the piston family draws (§12.1). Three normalizes the
 * contour and hole windings itself when it triangulates, so the sampling
 * direction of the trochoid does not matter here.
 */
export function housingShape(proportions: RotaryProportions): Shape {
  const shape = new Shape(toVectors(proportions.housingOuterMm));
  shape.holes.push(new Path(toVectors(proportions.housingInnerMm)));
  return shape;
}

/**
 * The rotor's core: the three flank arcs, each rotated onto its own face and
 * scaled in by `rotorCoreScale` to leave room for the tinted face skins.
 *
 * Face k's flank is face 0's rotated by 120°k — the same statement as "apex k
 * sits at rotor angle φ + 2πk/3" — so one sampled arc builds the whole rotor.
 * The arcs meet at the (scaled) apexes, so the three of them close a polygon
 * without any joining geometry.
 */
export function rotorCoreShape(proportions: RotaryProportions): Shape {
  const points: Vector2[] = [];
  for (let face = 0; face < ROTOR_FACE_COUNT; face += 1) {
    const arc = rotated(proportions.rotorFlankMm, FACE_PITCH_RAD * face);
    // Drop each arc's last point: it is the next arc's first (the shared
    // apex), and a duplicated vertex is a degenerate edge to triangulate.
    for (let i = 0; i < arc.length - 1; i += 1) {
      points.push(scaleVector(arc[i], proportions.rotorCoreScale));
    }
  }
  return new Shape(points);
}

function scaleVector(vector: Vector2, scale: number): Vector2 {
  return new Vector2(vector.x * scale, vector.y * scale);
}

/**
 * One face's tinted skin: the band between the drawn flank and the core, in
 * the **rotor frame, for face 0**.
 *
 * The renderer instances this once per face and rotates each copy by 120°k,
 * which is why it is built for face 0 only. The band is the flank arc closed
 * by the same arc scaled toward the rotor center, so it is thickest at the
 * apexes and thinnest at mid-flank — the emphasis a chamber deserves, since
 * the apex is where it is sealed off from its neighbours.
 *
 * This is the surface `chamberTint.ts` repaints, and it is declared in
 * `SCENE_COLORS.clearance` for the same reason a cylinder's clearance walls
 * are: restoring the untinted color has to be a genuine restore.
 */
export function rotorFaceSkinShape(proportions: RotaryProportions): Shape {
  const outer = toVectors(proportions.rotorFlankMm);
  const inner = scaled(proportions.rotorFlankMm, proportions.rotorCoreScale);
  inner.reverse();
  return new Shape([...outer, ...inner]);
}
