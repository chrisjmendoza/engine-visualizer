/**
 * Scene lighting (§12): subtle, neutral, and fixed, so metallic parts read as
 * machined surfaces without pulling attention from the mechanism.
 *
 * Light positions are in scene millimeters, but only their direction matters
 * for directional lights (each targets the origin).
 */

export function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.55} />
      {/* Key light, front-upper-right. */}
      <directionalLight position={[240, 360, 520]} intensity={1.5} />
      {/* Cool fill from the left keeps shaded faces legible. */}
      <directionalLight
        position={[-340, 140, 280]}
        intensity={0.5}
        color="#9fb4d0"
      />
      {/* Warm bounce from below separates parts from the dark background. */}
      <directionalLight
        position={[0, -280, 200]}
        intensity={0.28}
        color="#ffd9a8"
      />
    </>
  );
}
