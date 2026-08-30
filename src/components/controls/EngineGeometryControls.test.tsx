import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EngineGeometryControls } from "./EngineGeometryControls";
import { useEngineStore } from "../../state/engineStore";
import { DEFAULT_ANIMATION, DEFAULT_CONFIG } from "../../engine/constants";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    preferences: { displayUnit: "mm", showLabels: true },
    rpm: DEFAULT_ANIMATION.rpm,
    isPlaying: false,
    crankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
  });
}

beforeEach(() => {
  resetStore();
});

// This project's Vitest config does not enable `globals`, so
// @testing-library/react's automatic afterEach(cleanup) never registers;
// unmount explicitly so each test starts from an empty document.
afterEach(cleanup);

describe("EngineGeometryControls", () => {
  it("updates the store config (in millimeters) when a geometry input changes", async () => {
    const user = userEvent.setup();
    render(<EngineGeometryControls />);

    const boreInput = screen.getByLabelText(/bore \(mm\)/i);
    await user.clear(boreInput);
    await user.type(boreInput, "90");

    expect(useEngineStore.getState().config.boreMm).toBe(90);
  });

  it("converts the displayed value when switching to inches without changing stored millimeters", () => {
    render(<EngineGeometryControls />);

    const boreMmBefore = useEngineStore.getState().config.boreMm;
    expect(boreMmBefore).toBe(86);

    act(() => {
      useEngineStore.getState().setDisplayUnit("in");
    });

    // 86 mm / 25.4 = 3.3858... in, trimmed for display.
    const boreInput = screen.getByLabelText(/bore \(in\)/i) as HTMLInputElement;
    expect(Number(boreInput.value)).toBeCloseTo(86 / 25.4, 3);
    expect(useEngineStore.getState().config.boreMm).toBe(boreMmBefore);
  });

  it("shows a validation message and does not update the store for a rod length at or below the crank radius", async () => {
    const user = userEvent.setup();
    render(<EngineGeometryControls />);

    const rodInput = screen.getByLabelText(/connecting-rod length \(mm\)/i);
    const rodMmBefore = useEngineStore.getState().config.rodLengthMm;

    // Default stroke is 86 mm, so the crank radius is 43 mm; 40 mm is invalid.
    await user.clear(rodInput);
    await user.type(rodInput, "40");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/crank radius/i);
    expect(useEngineStore.getState().config.rodLengthMm).toBe(rodMmBefore);
  });

  it("associates the error message with the offending input via aria-describedby", async () => {
    const user = userEvent.setup();
    render(<EngineGeometryControls />);

    const rodInput = screen.getByLabelText(/connecting-rod length \(mm\)/i);
    await user.clear(rodInput);
    await user.type(rodInput, "10");

    const alert = await screen.findByRole("alert");
    expect(rodInput).toHaveAttribute("aria-describedby", alert.id);
    expect(rodInput).toHaveAttribute("aria-invalid", "true");
  });

  it("commits a valid compression ratio to the store unchanged, in millimeter display mode", async () => {
    const user = userEvent.setup();
    render(<EngineGeometryControls />);

    const ratioInput = screen.getByLabelText(/compression ratio/i);
    await user.clear(ratioInput);
    await user.type(ratioInput, "12");

    expect(useEngineStore.getState().config.compressionRatio).toBe(12);
  });

  it("commits a valid compression ratio to the store unchanged, in inch display mode", async () => {
    act(() => {
      useEngineStore.getState().setDisplayUnit("in");
    });
    const user = userEvent.setup();
    render(<EngineGeometryControls />);

    const ratioInput = screen.getByLabelText(/compression ratio/i);
    await user.clear(ratioInput);
    await user.type(ratioInput, "8");

    // Compression ratio is dimensionless: no mm<->in conversion applies.
    expect(useEngineStore.getState().config.compressionRatio).toBe(8);
  });

  it("shows a validation message and does not update the store for a compression ratio above 20:1", async () => {
    const user = userEvent.setup();
    render(<EngineGeometryControls />);

    const ratioInput = screen.getByLabelText(/compression ratio/i);
    const ratioBefore = useEngineStore.getState().config.compressionRatio;

    await user.clear(ratioInput);
    await user.type(ratioInput, "25");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Compression ratio must be at most 20:1.");
    expect(useEngineStore.getState().config.compressionRatio).toBe(ratioBefore);
  });

  it("shows a validation message and does not update the store for a compression ratio below 5:1", async () => {
    const user = userEvent.setup();
    render(<EngineGeometryControls />);

    const ratioInput = screen.getByLabelText(/compression ratio/i);
    const ratioBefore = useEngineStore.getState().config.compressionRatio;

    await user.clear(ratioInput);
    await user.type(ratioInput, "0.5");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Compression ratio must be at least 5:1.");
    expect(useEngineStore.getState().config.compressionRatio).toBe(ratioBefore);
  });

  it("leaves the compression-ratio input's displayed value unchanged when toggling display units", () => {
    render(<EngineGeometryControls />);

    const ratioInputBefore = screen.getByLabelText(
      /compression ratio/i,
    ) as HTMLInputElement;
    const draftBefore = ratioInputBefore.value;
    expect(draftBefore).toBe("10.5");

    act(() => {
      useEngineStore.getState().setDisplayUnit("in");
    });

    const ratioInputAfterIn = screen.getByLabelText(
      /compression ratio/i,
    ) as HTMLInputElement;
    expect(ratioInputAfterIn.value).toBe(draftBefore);

    act(() => {
      useEngineStore.getState().setDisplayUnit("mm");
    });

    const ratioInputAfterMm = screen.getByLabelText(
      /compression ratio/i,
    ) as HTMLInputElement;
    expect(ratioInputAfterMm.value).toBe(draftBefore);
  });
});
