/**
 * The stage: owns the single animation loop and places one or two engines on
 * it, each a row of one or more cylinders (§11, §12.1, §24).
 *
 * React subscribes only to the configurations and layouts (through the layout
 * passed in), so geometry is rebuilt when a dimension changes, a layout
 * changes, or comparison is toggled. Per frame nothing touches
 * React: one loop computes each cylinder's mechanism state at that cylinder's
 * own crank angle — the engine's angle plus the cylinder's crank-throw phase —
 * and mutates its Three.js groups through a reusable carrier (§18).
 *
 * Both engines always share the playback state. They also share a speed and an
 * exact crank angle while `rpmLinked` is set, so differences between them are
 * purely geometric; unlinked, each runs at its own rpm and the angles diverge,
 * which is how two different redlines can be watched side by side.
 *
 * A cylinder whose layout gives it a non-zero bank offset is drawn rotated by
 * that angle about its own crankshaft center (§24a); only the drawing is
 * rotated, so the loop below keeps driving it at exactly its crank phase. On a
 * V or flat engine the two cylinders of a throw share that crank center — same
 * `offsetXMm`, opposite tilts — so the row is a row of throws, and one of the
 * pair may omit its crank throw entirely (`drawsCrank`) when the other already
 * draws the pin they share. None of that reaches the loop either: every
 * cylinder is still driven at its own crank phase, and a cylinder with no crank
 * group is skipped by the same null check that covers an unmounted one.
 *
 * Each cylinder is also placed at a crank-center height (`offsetYMm`), which
 * is zero everywhere except the lower engine of a stacked comparison (§24a) —
 * the arrangement the layout picks when either engine shows more than one
 * cylinder. Nothing about the animation changes with it.
 *
 * Because `useMechanismRefs` is a hook, a variable number of cylinders cannot
 * own their refs here. Each cylinder is therefore a child component that holds
 * its own refs and carrier and registers an apply function with the stage; the
 * loop looks that function up by cylinder index. A cylinder that has not
 * mounted yet, or has just unmounted, is simply absent from the registry and
 * skipped — the same tolerance the single-mechanism code relied on when a
 * comparison engine appeared or disappeared between a store change and the
 * rerender that follows it.
 */

import { useCallback, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { cylinderCrankAngleRad } from "../engine/engineLayout";
import { calculateMechanismState } from "../engine/kinematics";
import type { CrankMechanismConfig, MechanismState } from "../engine/types";
import { CrankMechanism } from "./CrankMechanism";
import { MechanismLabel } from "./MechanismLabel";
import type { MechanismObjects } from "./mechanismTransforms";
import { applyMechanismState, useMechanismRefs } from "./mechanismTransforms";
import type {
  MechanismProportions,
  PlacedCylinder,
  SceneLayout,
} from "./sceneGeometry";
import type { EngineStoreState, FrameAngles } from "./useMechanismAnimation";
import { useMechanismAnimation } from "./useMechanismAnimation";

/** Which engine a cylinder belongs to. Matches the label slots. */
type EngineSlot = "A" | "B";

/** Applies one calculated state to one cylinder's Three.js groups. */
type ApplyCylinderState = (state: MechanismState) => void;

/**
 * The mounted cylinders of both engines, keyed by cylinder index within each
 * engine.
 *
 * Two maps keyed by number rather than one keyed by `"A:0"` deliberately: the
 * frame loop looks every cylinder up on every frame, and building a template
 * string per cylinder per frame would allocate in the one place that must not
 * (§11, §18).
 */
type MechanismRegistry = Record<EngineSlot, Map<number, ApplyCylinderState>>;

interface MechanismStageProps {
  layout: SceneLayout;
}

export function MechanismStage({ layout }: MechanismStageProps) {
  const registry = useRef<MechanismRegistry>({
    A: new Map(),
    B: new Map(),
  });

  /**
   * Drives each cylinder from its engine's crank angle plus its own throw
   * phase. The two engines are identical while their speeds are linked and
   * diverge once they are not, so a faster-revving engine visibly outruns a
   * slower one.
   *
   * The configurations are read from the store snapshot rather than from
   * props, matching the previous single-mechanism behavior: a frame landing
   * between a store change and React's rerender still behaves, because the
   * cylinders it drives are the ones actually mounted. The cylinder
   * definitions come from the layout, never from `createEngineLayout` — the
   * loop must not build a layout per frame.
   */
  const applyFrame = useCallback(
    (angles: FrameAngles, store: EngineStoreState) => {
      applyEngineFrame(
        registry.current.A,
        store.config,
        layout.primary.cylinders,
        angles.crankAngleRad,
      );

      const comparison = store.comparisonConfig;
      if (comparison && layout.secondary) {
        applyEngineFrame(
          registry.current.B,
          comparison,
          layout.secondary.cylinders,
          angles.comparisonCrankAngleRad,
        );
      }
    },
    [layout],
  );

  const { applyCurrent } = useMechanismAnimation(applyFrame);

  // Place the parts before the first painted frame, and again whenever the
  // layout is rebuilt, so nothing is ever drawn at the untransformed origin.
  useLayoutEffect(() => {
    applyCurrent();
  }, [applyCurrent, layout]);

  return (
    <group>
      <EngineRow
        slot="A"
        registry={registry}
        proportions={layout.primary.proportions}
        cylinders={layout.primary.cylinders}
      />
      {layout.secondary && (
        <EngineRow
          slot="B"
          registry={registry}
          proportions={layout.secondary.proportions}
          cylinders={layout.secondary.cylinders}
        />
      )}

      {/* Labels are anchored in stage coordinates rather than parented to a
          mechanism, so they share one baseline and stay put while the parts
          move. The layout omits them entirely when labels are hidden. */}
      {layout.primary.label && (
        <MechanismLabel placement={layout.primary.label} />
      )}
      {layout.secondary?.label && (
        <MechanismLabel placement={layout.secondary.label} />
      )}
    </group>
  );
}

/**
 * Drives every mounted cylinder of one engine.
 *
 * Indexed loop and a numeric map lookup, so the only per-frame allocation is
 * the `MechanismState` each `calculateMechanismState` call returns — exactly
 * what the single-mechanism loop already did, once per cylinder (§18).
 */
function applyEngineFrame(
  mounted: Map<number, ApplyCylinderState>,
  config: CrankMechanismConfig,
  cylinders: readonly PlacedCylinder[],
  crankAngleRad: number,
): void {
  for (let i = 0; i < cylinders.length; i += 1) {
    const cylinder = cylinders[i];
    const apply = mounted.get(cylinder.index);
    if (!apply) {
      // Not mounted yet, or already unmounted: nothing to transform.
      continue;
    }
    apply(
      calculateMechanismState(
        config,
        cylinderCrankAngleRad(crankAngleRad, cylinder),
      ),
    );
  }
}

interface EngineRowProps {
  slot: EngineSlot;
  registry: RefObject<MechanismRegistry>;
  proportions: MechanismProportions;
  cylinders: readonly PlacedCylinder[];
}

/**
 * One engine's cylinders, drawn along the crankshaft — one per slot for an
 * inline engine, two sharing a slot for each throw of a V or flat one (§24a).
 * The placement is entirely the layout's; this only unpacks it.
 */
function EngineRow({ slot, registry, proportions, cylinders }: EngineRowProps) {
  return (
    <>
      {cylinders.map((cylinder) => (
        <PlacedCylinderMechanism
          key={cylinder.index}
          slot={slot}
          index={cylinder.index}
          registry={registry}
          proportions={proportions}
          offsetXMm={cylinder.offsetXMm}
          offsetYMm={cylinder.offsetYMm}
          offsetZMm={cylinder.offsetZMm}
          bankOffsetRad={cylinder.bankOffsetRad}
          drawsCrank={cylinder.drawsCrank}
        />
      ))}
    </>
  );
}

interface PlacedCylinderMechanismProps {
  slot: EngineSlot;
  index: number;
  registry: RefObject<MechanismRegistry>;
  proportions: MechanismProportions;
  offsetXMm: number;
  /** Crank-center height (§24a); non-zero only for a stacked comparison's engine B. */
  offsetYMm: number;
  /** Depth (§24a); non-zero only for the second cylinder of a throw pair. */
  offsetZMm: number;
  /** This cylinder's bank tilt (§24a); 0 for inline layouts. */
  bankOffsetRad: number;
  /** False for the bank-1 cylinder of a shared-pin V pair (§24a). */
  drawsCrank: boolean;
}

/**
 * One cylinder: its own group refs, its own reusable carrier, and its
 * registration with the stage's frame loop.
 *
 * The registration is a layout effect so it is in place before the first
 * painted frame, and its cleanup removes the entry — which is how a cylinder
 * that disappears (comparison switched off, cylinder count reduced) stops
 * being driven without the loop having to know it went away.
 */
function PlacedCylinderMechanism({
  slot,
  index,
  registry,
  proportions,
  offsetXMm,
  offsetYMm,
  offsetZMm,
  bankOffsetRad,
  drawsCrank,
}: PlacedCylinderMechanismProps) {
  const refs = useMechanismRefs();

  // One reusable carrier per cylinder, refilled in place each frame, so the
  // loop allocates nothing (§11).
  const objects = useRef<MechanismObjects>({
    crank: null,
    rod: null,
    piston: null,
  });

  useLayoutEffect(() => {
    const mounted = registry.current[slot];
    mounted.set(index, (state: MechanismState) => {
      applyMechanismState(objects.current, refs, state);
    });
    return () => {
      mounted.delete(index);
    };
  }, [registry, slot, index, refs]);

  return (
    <CrankMechanism
      p={proportions}
      positionX={offsetXMm}
      positionY={offsetYMm}
      positionZ={offsetZMm}
      bankOffsetRad={bankOffsetRad}
      crankRef={refs.crank}
      rodRef={refs.rod}
      pistonRef={refs.piston}
      // Cylinder 0 is the first cylinder of the first throw, so the
      // crank-direction ring is still drawn exactly once per engine even now
      // that two cylinders can share a plane.
      isFrontCylinder={index === 0}
      drawsCrank={drawsCrank}
    />
  );
}
