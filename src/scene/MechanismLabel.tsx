/**
 * The name label drawn under one mechanism.
 *
 * Rendered as real DOM text through drei's `<Html>`, anchored to a 3D point,
 * rather than as 3D type: drei's `<Text>` fetches a font over the network,
 * which this application must not depend on. DOM text is also crisp at any
 * zoom, styled from the app's palette, and readable by assistive technology —
 * so the canvas is not the only place the engine is identified (§19).
 *
 * The label never intercepts pointer events, so it cannot block interaction
 * with the canvas beneath it.
 */

import { Html } from "@react-three/drei";
import type { CSSProperties } from "react";
import type { LabelPlacement } from "./sceneGeometry";

interface MechanismLabelProps {
  placement: LabelPlacement;
}

export function MechanismLabel({ placement }: MechanismLabelProps) {
  return (
    <Html
      position={[placement.anchorXMm, placement.anchorYMm, 0]}
      center
      pointerEvents="none"
      zIndexRange={[10, 0]}
      style={containerStyle}
    >
      {placement.slot && <span style={slotStyle}>{placement.slot}</span>}
      <span style={nameStyle}>{placement.name}</span>
    </Html>
  );
}

const containerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4em",
  whiteSpace: "nowrap",
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: "12px",
  lineHeight: 1.2,
  pointerEvents: "none",
  userSelect: "none",
};

/**
 * The slot marker is a letter, not just a color, so which engine is which does
 * not depend on color alone (§19).
 */
const slotStyle: CSSProperties = {
  padding: "0 0.35em",
  border: "1px solid #333a45",
  borderRadius: "3px",
  color: "#9aa3af",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
};

const nameStyle: CSSProperties = {
  color: "#e6e9ee",
  fontWeight: 500,
};
