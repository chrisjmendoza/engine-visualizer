/**
 * Rotor placement and face tinting (§27).
 *
 * The placement half carries the load-bearing claim of this whole task: a
 * rotor cannot be driven from the wrapped shaft angle alone, because its
 * orientation is θ_total / 3 and wrapping loses exactly the revolutions that
 * distinguish 0° from 360° from 720°. The tests below fail loudly if anyone
 * ever "simplifies" the revolution index away.
 *
 * The tint half mirrors `chamberTint.test.ts`: what gets painted, and — just
 * as importantly — what does not, on a frame where nothing changed.
 */

import { describe, expect, it } from "vitest";
import { Group, Mesh, MeshStandardMaterial } from "three";
import { TWO_PI } from "../engine/constants";
import { ROTOR_FACE_COUNT } from "../engine/rotaryConstants";
import {
  ROTARY_CYCLE_SPAN_RAD,
  ROTARY_ROTOR_PHASES,
  ROTOR_FACE_ANCHOR_SHAFT_ANGLE_RAD,
  rotaryCycleAngleRad,
  rotorFacePhaseAt,
} from "../engine/rotaryCycle";
import type { RotorRevolutionIndex } from "../engine/rotaryCycle";
import { housingPointMm, rotorAngleRad } from "../engine/rotaryGeometry";
import type { RotaryConfig } from "../engine/rotaryTypes";
import {
  applyRotorFacePhases,
  applyRotorPlacement,
  computeRotorPlacement,
  createRotorFaceTintState,
  createRotorPlacement,
} from "./rotaryTransforms";
import type { RotorObjects } from "./rotaryTransforms";
import { SCENE_COLORS } from "./sceneGeometry";

const THIRTEEN_B: RotaryConfig = {
  generatingRadiusMm: 105,
  eccentricityMm: 15,
  rotorWidthMm: 80,
  compressionRatio: 9,
  redlineRpm: 8000,
};

/** The rotor angle at a wrapped shaft angle and a revolution index. */
function orientationAt(
  wrappedShaftAngleRad: number,
  index: RotorRevolutionIndex,
  rotorPhaseRad = 0,
): number {
  return computeRotorPlacement(
    THIRTEEN_B,
    rotaryCycleAngleRad(wrappedShaftAngleRad, index),
    rotorPhaseRad,
    createRotorPlacement(),
  ).rotorAngleRad;
}

describe("computeRotorPlacement - the revolution index is load-bearing", () => {
  it("puts the rotor 120 degrees apart on each of the three shaft revolutions", () => {
    // The whole reason the mod-6 counter exists. At one wrapped shaft angle
    // the rotor can be in any of three orientations, and only the revolution
    // index says which.
    const wrapped = 1.0;
    const first = orientationAt(wrapped, 0);
    const second = orientationAt(wrapped, 1);
    const third = orientationAt(wrapped, 2);

    expect(second - first).toBeCloseTo(TWO_PI / 3, 12);
    expect(third - second).toBeCloseTo(TWO_PI / 3, 12);
  });

  it("would collapse to one orientation if driven from the wrapped angle alone", () => {
    // The control: this is precisely what a "simplification" that dropped the
    // index would compute, and it cannot tell the three revolutions apart.
    const wrapped = 1.0;
    const naive = rotorAngleRad(wrapped);

    expect(orientationAt(wrapped, 0)).toBeCloseTo(naive, 12);
    expect(orientationAt(wrapped, 1)).not.toBeCloseTo(naive, 3);
    expect(orientationAt(wrapped, 2)).not.toBeCloseTo(naive, 3);
  });

  it("returns the rotor to its starting orientation after three shaft revolutions", () => {
    // Three revolutions is one rotor revolution, so the drawn rotor is
    // indistinguishable from where it started — which is why three indexes
    // suffice and a fourth would be the first one again.
    const wrapped = 2.4;
    const afterThree =
      computeRotorPlacement(
        THIRTEEN_B,
        rotaryCycleAngleRad(wrapped, 0) + ROTARY_CYCLE_SPAN_RAD,
        0,
        createRotorPlacement(),
      ).rotorAngleRad - TWO_PI;
    expect(afterThree).toBeCloseTo(orientationAt(wrapped, 0), 12);
  });

  it("leaves the rotor CENTER untouched by the revolution index", () => {
    // C(θ) is 2π-periodic, so only the orientation carries revolutions. A test
    // that only watched the center would have missed the bug entirely.
    const wrapped = 1.0;
    for (const index of [0, 1, 2] as const) {
      const placement = computeRotorPlacement(
        THIRTEEN_B,
        rotaryCycleAngleRad(wrapped, index),
        0,
        createRotorPlacement(),
      );
      expect(placement.centerMm.xMm).toBeCloseTo(
        THIRTEEN_B.eccentricityMm * Math.cos(wrapped),
        10,
      );
      expect(placement.centerMm.yMm).toBeCloseTo(
        THIRTEEN_B.eccentricityMm * Math.sin(wrapped),
        10,
      );
    }
  });
});

describe("computeRotorPlacement - drawn apexes ride the housing", () => {
  it("lands every drawn apex exactly on the trochoid at every shaft angle", () => {
    // The scene draws the rotor once in its own frame and moves the group, so
    // this checks the transform the *renderer* applies reproduces
    // `rotaryGeometry.ts`'s apex-on-housing identity — the rotary's loop
    // closure. A sign error in `applyRotorPlacement`'s rotation would show up
    // here and nowhere else.
    const placement = createRotorPlacement();

    for (let step = 0; step < 240; step += 1) {
      const shaftAngleRad = (ROTARY_CYCLE_SPAN_RAD * step) / 240;
      computeRotorPlacement(THIRTEEN_B, shaftAngleRad, 0, placement);

      for (let apex = 0; apex < ROTOR_FACE_COUNT; apex += 1) {
        // The rotor-frame apex, rotated by the group's rotation and moved to
        // the group's position — exactly what Three.js does with the transform
        // `applyRotorPlacement` writes.
        const local = (TWO_PI * apex) / ROTOR_FACE_COUNT;
        const angle = placement.rotorAngleRad + local;
        const x =
          placement.centerMm.xMm +
          THIRTEEN_B.generatingRadiusMm * Math.cos(angle);
        const y =
          placement.centerMm.yMm +
          THIRTEEN_B.generatingRadiusMm * Math.sin(angle);

        const onHousing = housingPointMm(THIRTEEN_B, angle);
        expect(x).toBeCloseTo(onHousing.xMm, 9);
        expect(y).toBeCloseTo(onHousing.yMm, 9);
      }
    }
  });
});

describe("computeRotorPlacement - rotor phase", () => {
  it("divides a two-rotor engine's 180 degrees of shaft into 60 degrees of rotor", () => {
    const [, secondRotorPhase] = ROTARY_ROTOR_PHASES[2];
    expect(secondRotorPhase).toBeCloseTo(Math.PI, 12);
    expect(
      orientationAt(0, 0, secondRotorPhase) - orientationAt(0, 0),
    ).toBeCloseTo(Math.PI / 3, 12);
  });

  it("carries the phased shaft angle for the eccentric, unphased for nothing", () => {
    const placement = computeRotorPlacement(
      THIRTEEN_B,
      1.25,
      Math.PI,
      createRotorPlacement(),
    );
    expect(placement.shaftAngleRad).toBeCloseTo(1.25 + Math.PI, 12);
    // The lobe drawn at local (e, 0) and rotated by that angle *is* the rotor
    // center, so the two can never be placed inconsistently.
    expect(
      THIRTEEN_B.eccentricityMm * Math.cos(placement.shaftAngleRad),
    ).toBeCloseTo(placement.centerMm.xMm, 10);
  });

  it("refills the caller's carrier rather than allocating a new one", () => {
    const carrier = createRotorPlacement();
    const center = carrier.centerMm;

    for (let i = 0; i < 50; i += 1) {
      const returned = computeRotorPlacement(THIRTEEN_B, i * 0.1, 0, carrier);
      expect(returned).toBe(carrier);
      expect(returned.centerMm).toBe(center);
    }
  });
});

describe("applyRotorPlacement", () => {
  function objects(): RotorObjects & { rotor: Group; eccentric: Group } {
    return { rotor: new Group(), eccentric: new Group() };
  }

  it("moves and rotates the rotor, and rotates the eccentric by the shaft angle", () => {
    const scene = objects();
    const placement = computeRotorPlacement(
      THIRTEEN_B,
      1.1,
      0,
      createRotorPlacement(),
    );
    applyRotorPlacement(scene, placement);

    expect(scene.rotor.position.x).toBeCloseTo(placement.centerMm.xMm, 12);
    expect(scene.rotor.position.y).toBeCloseTo(placement.centerMm.yMm, 12);
    expect(scene.rotor.rotation.z).toBeCloseTo(placement.rotorAngleRad, 12);
    expect(scene.eccentric.rotation.z).toBeCloseTo(placement.shaftAngleRad, 12);
  });

  it("skips groups that have not mounted yet", () => {
    expect(() =>
      applyRotorPlacement(
        { rotor: null, eccentric: null },
        computeRotorPlacement(THIRTEEN_B, 1, 0, createRotorPlacement()),
      ),
    ).not.toThrow();
  });
});

/** A stand-in for one rotor's three face-skin groups. */
function makeFaces(): Group[] {
  const groups: Group[] = [];
  for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
    const group = new Group();
    group.add(
      new Mesh(
        undefined,
        new MeshStandardMaterial({ color: SCENE_COLORS.clearance }),
      ),
    );
    groups.push(group);
  }
  return groups;
}

function faceColorHex(group: Group): string {
  return (
    (group.children[0] as Mesh).material as MeshStandardMaterial
  ).color.getHexString();
}

function hexOf(color: string): string {
  return new MeshStandardMaterial({ color }).color.getHexString();
}

describe("applyRotorFacePhases - the preference-off path", () => {
  it("never touches a material while the cycle preference is off", () => {
    const faces = makeFaces();
    const state = createRotorFaceTintState();

    for (let frame = 0; frame < 100; frame += 1) {
      expect(applyRotorFacePhases(faces, state, null, 0)).toBe(0);
    }
    for (const face of faces) {
      expect(faceColorHex(face)).toBe(hexOf(SCENE_COLORS.clearance));
    }
  });

  it("restores the untinted rotor when the preference is switched back off", () => {
    const faces = makeFaces();
    const state = createRotorFaceTintState();

    // Face 0's own firing moment: shaft angle 90 degrees, revolution index 0.
    applyRotorFacePhases(faces, state, ROTOR_FACE_ANCHOR_SHAFT_ANGLE_RAD, 0);
    expect(faceColorHex(faces[0])).toBe(hexOf(SCENE_COLORS.chamberFiring));

    expect(applyRotorFacePhases(faces, state, null, 0)).toBe(ROTOR_FACE_COUNT);
    for (const face of faces) {
      expect(faceColorHex(face)).toBe(hexOf(SCENE_COLORS.clearance));
    }
  });
});

describe("applyRotorFacePhases - writes only on a change", () => {
  it("writes twelve times per rotor per 1080-degree cycle, not sixty times a second", () => {
    // Three faces, four phase boundaries each. Anything more would be the
    // per-frame material write §18 rules out; anything less would mean a face
    // missed a phase.
    const faces = makeFaces();
    const state = createRotorFaceTintState();
    const frames = 1080;

    // One warm-up cycle, so the count below excludes the initial write each
    // face makes when it leaves its "nothing painted yet" state.
    for (let i = 0; i < frames; i += 1) {
      applyRotorFacePhases(
        faces,
        state,
        (ROTARY_CYCLE_SPAN_RAD * i) / frames,
        0,
      );
    }

    let writes = 0;
    for (let i = 0; i < frames; i += 1) {
      writes += applyRotorFacePhases(
        faces,
        state,
        (ROTARY_CYCLE_SPAN_RAD * i) / frames,
        0,
      );
    }

    expect(writes).toBe(4 * ROTOR_FACE_COUNT);
  });

  it("paints each face the color of the phase the engine layer puts it in", () => {
    const faces = makeFaces();
    const state = createRotorFaceTintState();
    const expected = {
      power: hexOf(SCENE_COLORS.chamberFiring),
      exhaust: hexOf(SCENE_COLORS.chamberExhaust),
      intake: hexOf(SCENE_COLORS.clearance),
      compression: hexOf(SCENE_COLORS.clearance),
    };

    for (let i = 0; i < 60; i += 1) {
      const shaftCycleAngleRad = (ROTARY_CYCLE_SPAN_RAD * i) / 60;
      applyRotorFacePhases(faces, state, shaftCycleAngleRad, 0);

      for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
        expect(faceColorHex(faces[k])).toBe(
          expected[rotorFacePhaseAt(k, shaftCycleAngleRad)],
        );
      }
    }
  });

  it("fires face 0 at shaft angle 90 degrees, the geometric anchor", () => {
    const faces = makeFaces();
    const state = createRotorFaceTintState();

    applyRotorFacePhases(faces, state, ROTOR_FACE_ANCHOR_SHAFT_ANGLE_RAD, 0);

    expect(faceColorHex(faces[0])).toBe(hexOf(SCENE_COLORS.chamberFiring));
    // Its neighbours are 360 degrees of shaft away in the cycle, so neither is
    // firing at the same instant — one rotor fires once per shaft revolution.
    expect(faceColorHex(faces[1])).not.toBe(hexOf(SCENE_COLORS.chamberFiring));
    expect(faceColorHex(faces[2])).not.toBe(hexOf(SCENE_COLORS.chamberFiring));
  });

  it("shifts a phased rotor's whole cycle by its phase, and nothing else", () => {
    // "A phased rotor is an unphased rotor evaluated at θ + phase" — the
    // identity `rotaryCycle.ts` is built on — as the renderer sees it: rotor
    // B's three faces at any shaft angle are painted exactly as rotor A's are
    // 180 degrees later.
    const [, phaseB] = ROTARY_ROTOR_PHASES[2];
    const rotorA = makeFaces();
    const rotorB = makeFaces();
    const stateA = createRotorFaceTintState();
    const stateB = createRotorFaceTintState();

    for (let i = 0; i < 72; i += 1) {
      const shaftCycleAngleRad = (ROTARY_CYCLE_SPAN_RAD * i) / 72;
      applyRotorFacePhases(rotorA, stateA, shaftCycleAngleRad + phaseB, 0);
      applyRotorFacePhases(rotorB, stateB, shaftCycleAngleRad, phaseB);

      for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
        expect(faceColorHex(rotorB[k])).toBe(faceColorHex(rotorA[k]));
      }
    }
  });

  it("makes a two-rotor engine light a face red every 180 degrees of shaft", () => {
    // The 13B's signature firing interval, read off the tint rather than off
    // the engine layer's own firing table: six power phases begin in a
    // 1080-degree cycle across the two rotors, evenly spaced.
    const phases = ROTARY_ROTOR_PHASES[2];
    const rotors = phases.map(() => makeFaces());
    const states = phases.map(() => createRotorFaceTintState());
    const firing = hexOf(SCENE_COLORS.chamberFiring);
    const steps = 4320; // quarter-degree resolution
    const ignitionsDeg: number[] = [];

    let wasFiring = phases.map(() => [false, false, false]);
    for (let i = 0; i < steps; i += 1) {
      const shaftCycleAngleRad = (ROTARY_CYCLE_SPAN_RAD * i) / steps;
      const nowFiring = phases.map((rotorPhaseRad, rotor) => {
        applyRotorFacePhases(
          rotors[rotor],
          states[rotor],
          shaftCycleAngleRad,
          rotorPhaseRad,
        );
        return rotors[rotor].map((face) => faceColorHex(face) === firing);
      });

      for (let rotor = 0; rotor < phases.length; rotor += 1) {
        for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
          if (nowFiring[rotor][k] && !wasFiring[rotor][k] && i > 0) {
            ignitionsDeg.push((1080 * i) / steps);
          }
        }
      }
      wasFiring = nowFiring;
    }

    // Six ignitions in the 1080-degree cycle — three faces on each of two
    // rotors — starting at the geometric anchor and evenly spaced from there.
    expect(ignitionsDeg).toHaveLength(6);
    ignitionsDeg.forEach((deg, i) => {
      expect(deg).toBeCloseTo(90 + 180 * i, 0);
    });
  });
});

describe("applyRotorFacePhases - a rotor that has not mounted yet", () => {
  it("skips null face groups without recording the phase, so the tint lands later", () => {
    const state = createRotorFaceTintState();
    const absent = [null, null, null];

    expect(
      applyRotorFacePhases(absent, state, ROTOR_FACE_ANCHOR_SHAFT_ANGLE_RAD, 0),
    ).toBe(0);
    for (const face of state.faces) {
      expect(face.phase).toBe(null);
    }

    const faces = makeFaces();
    expect(
      applyRotorFacePhases(faces, state, ROTOR_FACE_ANCHOR_SHAFT_ANGLE_RAD, 0),
    ).toBe(ROTOR_FACE_COUNT);
    expect(faceColorHex(faces[0])).toBe(hexOf(SCENE_COLORS.chamberFiring));
  });
});
