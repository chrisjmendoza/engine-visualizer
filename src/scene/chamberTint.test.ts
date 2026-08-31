/**
 * The four-stroke tint's rendering half (§24a).
 *
 * `cycle.test.ts` proves *which* stroke each cylinder is in; this proves what
 * happens to its chamber as a result, and — just as importantly — what does
 * not happen: no material is touched while the "Four-stroke cycle" preference
 * is off, and none is touched on a frame where the phase did not change.
 */

import { describe, expect, it } from "vitest";
import { Color, Group, Mesh, MeshStandardMaterial } from "three";
import {
  applyChamberPhase,
  chamberTintColor,
  createChamberTintState,
} from "./chamberTint";
import { SCENE_COLORS } from "./sceneGeometry";

/** A stand-in for `CylinderGuide`'s chamber group: three colored meshes. */
function makeChamber(): Group {
  const group = new Group();
  for (let i = 0; i < 3; i += 1) {
    group.add(
      new Mesh(
        undefined,
        new MeshStandardMaterial({ color: SCENE_COLORS.clearance }),
      ),
    );
  }
  return group;
}

function colorsOf(group: Group): Color[] {
  return group.children.map(
    (child) => ((child as Mesh).material as MeshStandardMaterial).color,
  );
}

function expectAll(group: Group, hex: string): void {
  const expected = new Color(hex);
  for (const color of colorsOf(group)) {
    expect(color.getHexString()).toBe(expected.getHexString());
  }
}

describe("chamberTintColor", () => {
  it("paints power red, exhaust blue, and everything else the untinted clearance color", () => {
    expect(chamberTintColor("power").getHexString()).toBe(
      new Color(SCENE_COLORS.chamberFiring).getHexString(),
    );
    expect(chamberTintColor("exhaust").getHexString()).toBe(
      new Color(SCENE_COLORS.chamberExhaust).getHexString(),
    );
    for (const phase of ["intake", "compression"] as const) {
      expect(chamberTintColor(phase).getHexString()).toBe(
        new Color(SCENE_COLORS.clearance).getHexString(),
      );
    }
    expect(chamberTintColor(null).getHexString()).toBe(
      new Color(SCENE_COLORS.clearance).getHexString(),
    );
  });

  it("returns the shared instances rather than a fresh Color per call", () => {
    // The frame loop calls this on every phase change; it must not allocate.
    expect(chamberTintColor("power")).toBe(chamberTintColor("power"));
    expect(chamberTintColor("intake")).toBe(chamberTintColor(null));
  });
});

describe("applyChamberPhase - the preference-off path", () => {
  it("never touches a material while the phase is null", () => {
    const group = makeChamber();
    const state = createChamberTintState();

    // Exactly what the frame loop passes with "Four-stroke cycle" unchecked,
    // for as many frames as the user leaves it that way.
    for (let frame = 0; frame < 100; frame += 1) {
      expect(applyChamberPhase(group, state, null)).toBe(false);
    }
    expectAll(group, SCENE_COLORS.clearance);
  });

  it("restores the untinted chamber when the preference is switched back off", () => {
    const group = makeChamber();
    const state = createChamberTintState();

    expect(applyChamberPhase(group, state, "power")).toBe(true);
    expectAll(group, SCENE_COLORS.chamberFiring);

    expect(applyChamberPhase(group, state, null)).toBe(true);
    expectAll(group, SCENE_COLORS.clearance);
    expect(applyChamberPhase(group, state, null)).toBe(false);
  });
});

describe("applyChamberPhase - writes only on a change", () => {
  it("tints once per stroke boundary, not once per frame", () => {
    const group = makeChamber();
    const state = createChamberTintState();

    let writes = 0;
    // Sixty frames spread across two strokes: two boundaries crossed, so two
    // writes. Anything more would be the per-frame work §18 rules out.
    for (let frame = 0; frame < 30; frame += 1) {
      if (applyChamberPhase(group, state, "power")) writes += 1;
    }
    expectAll(group, SCENE_COLORS.chamberFiring);
    for (let frame = 0; frame < 30; frame += 1) {
      if (applyChamberPhase(group, state, "exhaust")) writes += 1;
    }
    expectAll(group, SCENE_COLORS.chamberExhaust);

    expect(writes).toBe(2);
  });

  it("walks a whole four-stroke cycle back to the untinted color", () => {
    const group = makeChamber();
    const state = createChamberTintState();

    applyChamberPhase(group, state, "intake");
    expectAll(group, SCENE_COLORS.clearance);
    applyChamberPhase(group, state, "compression");
    expectAll(group, SCENE_COLORS.clearance);
    applyChamberPhase(group, state, "power");
    expectAll(group, SCENE_COLORS.chamberFiring);
    applyChamberPhase(group, state, "exhaust");
    expectAll(group, SCENE_COLORS.chamberExhaust);
    applyChamberPhase(group, state, "intake");
    expectAll(group, SCENE_COLORS.clearance);
  });

  it("still writes when intake follows compression, since neither is tinted", () => {
    // The two untinted phases share a color but not a phase, so the state has
    // to track the phase, not the color — otherwise leaving "compression" for
    // "power" could be skipped after an intake/compression transition.
    const group = makeChamber();
    const state = createChamberTintState();

    expect(applyChamberPhase(group, state, "intake")).toBe(true);
    expect(applyChamberPhase(group, state, "compression")).toBe(true);
    expect(applyChamberPhase(group, state, "power")).toBe(true);
    expectAll(group, SCENE_COLORS.chamberFiring);
  });
});

describe("applyChamberPhase - a cylinder that has not mounted yet", () => {
  it("skips a null group without recording the phase, so the tint lands later", () => {
    const state = createChamberTintState();

    // Frames before the group exists: nothing to write to, and crucially the
    // phase must not be remembered as written.
    expect(applyChamberPhase(null, state, "power")).toBe(false);
    expect(state.phase).toBe(null);

    const group = makeChamber();
    expect(applyChamberPhase(group, state, "power")).toBe(true);
    expectAll(group, SCENE_COLORS.chamberFiring);
  });

  it("leaves a mesh with no colored material alone", () => {
    const group = new Group();
    const bare = new Mesh();
    bare.material = [];
    group.add(bare);
    const state = createChamberTintState();

    expect(() => applyChamberPhase(group, state, "power")).not.toThrow();
    expect(state.phase).toBe("power");
  });
});
