/**
 * The rendered scene: fixed front cutaway viewpoint, orthographic camera,
 * dark technical background (§12).
 *
 * Camera framing (§12.2): the mechanism keeps its true proportions and the
 * camera is fitted to it instead. Both axes share a single zoom, so bore,
 * stroke, and rod length are never distorted relative to one another. The fit
 * is recomputed only when the configuration or the canvas size changes.
 */

import { useStore, useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import type { OrthographicCamera } from "three";
import { SceneLighting } from "./SceneLighting";
import { SingleCylinderMechanism } from "./SingleCylinderMechanism";
import {
  CAMERA_DISTANCE_MM,
  FRAME_PADDING,
  SCENE_COLORS,
  useMechanismProportions,
} from "./sceneGeometry";

export function EngineScene() {
  const p = useMechanismProportions();
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
    // `zoom` is simply pixels per scene millimeter.
    const worldWidth = (p.bounds.maxX - p.bounds.minX) * FRAME_PADDING;
    const worldHeight = (p.bounds.maxY - p.bounds.minY) * FRAME_PADDING;
    const zoom = Math.min(width / worldWidth, height / worldHeight);

    ortho.zoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    // Looking straight down -Z from in front of the mechanism, centered on
    // the mechanism's vertical extent.
    ortho.position.set(
      0,
      (p.bounds.maxY + p.bounds.minY) / 2,
      CAMERA_DISTANCE_MM,
    );
    ortho.rotation.set(0, 0, 0);
    ortho.updateProjectionMatrix();
  }, [store, width, height, p]);

  return (
    <>
      <color attach="background" args={[SCENE_COLORS.background]} />
      <SceneLighting />
      <SingleCylinderMechanism />
    </>
  );
}
