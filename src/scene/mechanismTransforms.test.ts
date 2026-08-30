/**
 * Verifies that the scene transforms keep the drawn mechanism assembled.
 *
 * This is pure Three.js object math (matrix composition only), so it runs in
 * jsdom without a WebGL context. It is the rendering-side counterpart to the
 * kinematics tests: those check the numbers, this checks that the numbers are
 * mapped onto object transforms with the right axes and signs.
 */

import { Object3D, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { TWO_PI } from "../engine/constants";
import { calculateMechanismState } from "../engine/kinematics";
import type { CrankMechanismConfig } from "../engine/types";
import { applyMechanismTransforms } from "./mechanismTransforms";

/**
 * Builds the same object hierarchy the scene components declare: the crankpin
 * sits at local (0, r, 0) on the crank, the rod's small end at local (0, l, 0)
 * on the rod, and the piston pin at the piston group's origin.
 */
function buildRig(config: CrankMechanismConfig) {
  const crank = new Object3D();
  const crankPin = new Object3D();
  crankPin.position.set(0, config.strokeMm / 2, 0);
  crank.add(crankPin);

  const rod = new Object3D();
  const rodBigEnd = new Object3D();
  const rodSmallEnd = new Object3D();
  rodSmallEnd.position.set(0, config.rodLengthMm, 0);
  rod.add(rodBigEnd, rodSmallEnd);

  const piston = new Object3D();
  const pistonPin = new Object3D();
  piston.add(pistonPin);

  const root = new Object3D();
  root.add(crank, rod, piston);

  return {
    root,
    crank,
    crankPin,
    rod,
    rodBigEnd,
    rodSmallEnd,
    piston,
    pistonPin,
  };
}

const CONFIGS: Array<[string, CrankMechanismConfig]> = [
  [
    "default square engine",
    { boreMm: 86, strokeMm: 86, rodLengthMm: 143, compressionRatio: 10.5 },
  ],
  [
    "short rod, long stroke",
    { boreMm: 60, strokeMm: 120, rodLengthMm: 90, compressionRatio: 10.5 },
  ],
  [
    "long rod, short stroke",
    { boreMm: 100, strokeMm: 30, rodLengthMm: 300, compressionRatio: 10.5 },
  ],
];

const ANGLES = Array.from({ length: 48 }, (_, i) => (i * TWO_PI) / 48);

describe("applyMechanismTransforms", () => {
  for (const [name, config] of CONFIGS) {
    describe(name, () => {
      it("keeps the crankpin on its calculated position", () => {
        const rig = buildRig(config);

        for (const theta of ANGLES) {
          const state = calculateMechanismState(config, theta);
          applyMechanismTransforms(rig, state);
          rig.root.updateMatrixWorld(true);

          const pin = rig.crankPin.getWorldPosition(new Vector3());
          expect(pin.x).toBeCloseTo(state.crankPinXmm, 9);
          expect(pin.y).toBeCloseTo(state.crankPinYmm, 9);
        }
      });

      it("keeps both rod ends attached at every crank angle", () => {
        const rig = buildRig(config);

        for (const theta of ANGLES) {
          const state = calculateMechanismState(config, theta);
          applyMechanismTransforms(rig, state);
          rig.root.updateMatrixWorld(true);

          const bigEnd = rig.rodBigEnd.getWorldPosition(new Vector3());
          const crankPin = rig.crankPin.getWorldPosition(new Vector3());
          const smallEnd = rig.rodSmallEnd.getWorldPosition(new Vector3());
          const pistonPin = rig.pistonPin.getWorldPosition(new Vector3());

          // Big end coincides with the crankpin.
          expect(bigEnd.x).toBeCloseTo(crankPin.x, 9);
          expect(bigEnd.y).toBeCloseTo(crankPin.y, 9);

          // Small end coincides with the piston pin, on the centerline.
          expect(smallEnd.x).toBeCloseTo(0, 9);
          expect(smallEnd.y).toBeCloseTo(state.pistonPinYmm, 9);
          expect(smallEnd.x).toBeCloseTo(pistonPin.x, 9);
          expect(smallEnd.y).toBeCloseTo(pistonPin.y, 9);

          // And the drawn rod is exactly its configured length.
          const dx = smallEnd.x - bigEnd.x;
          const dy = smallEnd.y - bigEnd.y;
          expect(Math.hypot(dx, dy)).toBeCloseTo(config.rodLengthMm, 9);
        }
      });

      it("moves the piston between the calculated TDC and BDC heights", () => {
        const rig = buildRig(config);
        const r = config.strokeMm / 2;

        for (const theta of ANGLES) {
          const state = calculateMechanismState(config, theta);
          applyMechanismTransforms(rig, state);
          rig.root.updateMatrixWorld(true);

          expect(rig.piston.position.x).toBe(0);
          expect(rig.piston.position.y).toBeGreaterThanOrEqual(
            config.rodLengthMm - r - 1e-9,
          );
          expect(rig.piston.position.y).toBeLessThanOrEqual(
            config.rodLengthMm + r + 1e-9,
          );
        }
      });
    });
  }

  it("tolerates missing objects before the scene has mounted", () => {
    const state = calculateMechanismState(CONFIGS[0][1], 1);
    expect(() =>
      applyMechanismTransforms({ crank: null, rod: null, piston: null }, state),
    ).not.toThrow();
  });
});
