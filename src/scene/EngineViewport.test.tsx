/**
 * Smoke test for the viewport's WebGL fallback (§20).
 *
 * jsdom has no WebGL, so this exercises exactly the path a user without a
 * working GPU context sees. The rendered scene itself cannot be tested here —
 * it needs a real WebGL context.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../engine/constants";
import { EngineViewport } from "./EngineViewport";

describe("EngineViewport", () => {
  it("renders a readable fallback instead of a blank viewport when WebGL is unavailable", () => {
    render(<EngineViewport />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/3D view unavailable/i)).toBeInTheDocument();
    // Bore and stroke are both 86 mm by default, so assert on the rod length,
    // which is unique.
    expect(
      screen.getByText(`${DEFAULT_CONFIG.rodLengthMm} mm`),
    ).toBeInTheDocument();
  });
});
