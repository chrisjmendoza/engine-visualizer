/**
 * Public entry point for the 3D viewport (§20).
 *
 * Self-contained: it creates the React Three Fiber canvas, refuses to create
 * one when WebGL is unavailable (showing a readable text description of the
 * mechanism instead of a blank viewport), and contains any unexpected
 * rendering error in a React error boundary. It reads everything it needs
 * from the engine store and takes no required props.
 */

import { Canvas } from "@react-three/fiber";
import { Component, useMemo } from "react";
import type { CSSProperties, ErrorInfo, ReactNode } from "react";
import { useEngineStore } from "../state/engineStore";
import { EngineScene } from "./EngineScene";
import { CAMERA_DISTANCE_MM, SCENE_COLORS } from "./sceneGeometry";

interface EngineViewportProps {
  /** Optional class for the wrapper element, so a layout can size it. */
  className?: string;
}

export function EngineViewport({ className }: EngineViewportProps) {
  // Probing once per mount is enough: WebGL support cannot change while the
  // page is open.
  const webglAvailable = useMemo(() => detectWebGL(), []);

  return (
    <div className={className} style={wrapperStyle}>
      {webglAvailable ? (
        <SceneErrorBoundary>
          <Canvas
            orthographic
            flat
            dpr={[1, 2]}
            gl={{ antialias: true }}
            camera={{
              position: [0, 0, CAMERA_DISTANCE_MM],
              zoom: 1,
              near: 1,
              far: CAMERA_DISTANCE_MM * 4,
            }}
            style={{ display: "block", width: "100%", height: "100%" }}
          >
            <EngineScene />
          </Canvas>
        </SceneErrorBoundary>
      ) : (
        <ViewportFallback
          title="3D view unavailable"
          detail="This browser could not provide a WebGL context, so the engine cannot be drawn. The calculated values below remain accurate."
        />
      )}
    </div>
  );
}

/**
 * Reports whether a WebGL context can actually be created. Checked without
 * throwing, because a failed probe must degrade to the text fallback rather
 * than break the application.
 */
function detectWebGL(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  // Environments without WebGL at all (including jsdom) are ruled out before
  // touching a canvas.
  if (
    typeof WebGL2RenderingContext === "undefined" &&
    typeof WebGLRenderingContext === "undefined"
  ) {
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    const context =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    return context !== null;
  } catch {
    return false;
  }
}

interface ViewportFallbackProps {
  title: string;
  detail: string;
}

/**
 * The non-graphical view of the mechanism. Values come from the store so the
 * user still learns the current configuration and crank angle (§19).
 */
function ViewportFallback({ title, detail }: ViewportFallbackProps) {
  const config = useEngineStore((s) => s.config);
  const crankAngleRad = useEngineStore((s) => s.crankAngleRad);
  const crankAngleDeg = ((crankAngleRad * 180) / Math.PI).toFixed(0);

  return (
    <div style={fallbackStyle} role="status">
      <p style={fallbackTitleStyle}>{title}</p>
      <p style={fallbackDetailStyle}>{detail}</p>
      <dl style={fallbackListStyle}>
        <div style={fallbackRowStyle}>
          <dt style={fallbackTermStyle}>Bore</dt>
          <dd style={fallbackValueStyle}>{config.boreMm} mm</dd>
        </div>
        <div style={fallbackRowStyle}>
          <dt style={fallbackTermStyle}>Stroke</dt>
          <dd style={fallbackValueStyle}>{config.strokeMm} mm</dd>
        </div>
        <div style={fallbackRowStyle}>
          <dt style={fallbackTermStyle}>Rod length</dt>
          <dd style={fallbackValueStyle}>{config.rodLengthMm} mm</dd>
        </div>
        <div style={fallbackRowStyle}>
          <dt style={fallbackTermStyle}>Crank angle</dt>
          <dd style={fallbackValueStyle}>{crankAngleDeg}&deg;</dd>
        </div>
      </dl>
    </div>
  );
}

interface SceneErrorBoundaryProps {
  children: ReactNode;
}

interface SceneErrorBoundaryState {
  error: Error | null;
}

/** Contains unexpected rendering errors so they cannot blank the page (§20). */
class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SceneErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Engine scene failed to render:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ViewportFallback
          title="The engine view stopped rendering"
          detail={`Something went wrong while drawing the mechanism (${this.state.error.message}). Reload the page to try again; the calculated values below are unaffected.`}
        />
      );
    }
    return this.props.children;
  }
}

const wrapperStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  minHeight: "320px",
  background: SCENE_COLORS.background,
  overflow: "hidden",
};

const fallbackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  justifyContent: "center",
  width: "100%",
  height: "100%",
  padding: "1.5rem",
  color: "#e6e9ee",
};

const fallbackTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  fontWeight: 600,
  color: SCENE_COLORS.accent,
};

const fallbackDetailStyle: CSSProperties = {
  margin: 0,
  maxWidth: "42ch",
  fontSize: "0.875rem",
  lineHeight: 1.5,
  color: "#9aa3af",
};

const fallbackListStyle: CSSProperties = {
  margin: "0.5rem 0 0",
  fontSize: "0.875rem",
};

const fallbackRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
};

const fallbackTermStyle: CSSProperties = {
  minWidth: "8rem",
  color: "#9aa3af",
};

const fallbackValueStyle: CSSProperties = {
  margin: 0,
  fontVariantNumeric: "tabular-nums",
};
