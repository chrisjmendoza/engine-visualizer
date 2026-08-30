/**
 * The rendered scene: fixed front cutaway viewpoint, orthographic camera,
 * dark technical background (§12).
 *
 * Camera framing (§12.2): the mechanisms keep their true proportions and the
 * camera is fitted to them instead. Both axes share a single zoom, so bore,
 * stroke, and rod length are never distorted relative to one another — and
 * when two engines are compared that one zoom covers the union of both, so a
 * large engine visibly towers over a small one. The fit is recomputed only
 * when a configuration, the comparison state, or the canvas size changes.
 */

import { useStore, useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import type { OrthographicCamera } from "three";
import { MechanismStage } from "./MechanismStage";
import { SceneLighting } from "./SceneLighting";
import {
  CAMERA_DISTANCE_MM,
  FRAME_PADDING,
  SCENE_COLORS,
  useSceneLayout,
} from "./sceneGeometry";

export function EngineScene() {
  const layout = useSceneLayout();
  // The camera is read imperatively from the root store: it is a mutable
  // Three.js object the scene owns, not React state to subscribe to.
  const store = useStore();
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useLayoutEffect(() => {
    const ortho = store.getState().camera as OrthographicCamera;
    if (!ortho.isOrthographicCamera || width <= 0 || height <= 0) {
      return;
    }

    // React Three Fiber keeps the orthographic frustum in CSS pixels, so
    // `zoom` is simply pixels per scene millimeter. One zoom for the union of
    // everything on stage: the two engines are never scaled independently.
    const { bounds } = layout;
    const worldWidth = (bounds.maxX - bounds.minX) * FRAME_PADDING;
    const worldHeight = (bounds.maxY - bounds.minY) * FRAME_PADDING;
    const zoom = Math.min(width / worldWidth, height / worldHeight);

    ortho.zoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    // Looking straight down -Z from in front of the stage, centered on the
    // framed extents.
    ortho.position.set(
      (bounds.maxX + bounds.minX) / 2,
      (bounds.maxY + bounds.minY) / 2,
      CAMERA_DISTANCE_MM,
    );
    ortho.rotation.set(0, 0, 0);
    ortho.updateProjectionMatrix();
  }, [store, width, height, layout]);

  return (
    <>
      <color attach="background" args={[SCENE_COLORS.background]} />
      <SceneLighting />
      <MechanismStage layout={layout} />
    </>
  );
}
