import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalculationPanel } from "./CalculationPanel";
import { useEngineStore } from "../../state/engineStore";
import {
  DEFAULT_ANIMATION,
  DEFAULT_CONFIG,
  DEFAULT_PLAYBACK_SPEED,
} from "../../engine/constants";
import { calculateCylinderDisplacementCc } from "../../engine/calculations";
import { formatRounded } from "../shared/formatting";
import { METRIC_INFO_BY_ID } from "../shared/calculationFormatting";
import type { CrankMechanismConfig } from "../../engine/types";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    comparisonConfig: null,
    preferences: { displayUnit: "mm", showLabels: true },
    rpm: DEFAULT_ANIMATION.rpm,
    playbackSpeed: DEFAULT_PLAYBACK_SPEED,
    isPlaying: false,
    crankAngleRad: 0,
  });
}

beforeEach(() => {
  resetStore();
});

// This project's Vitest config does not enable `globals`, so
// @testing-library/react's automatic afterEach(cleanup) never registers;
// unmount explicitly so each test starts from an empty document.
afterEach(cleanup);

/**
 * Reads the <dd> value next to a row's label. The label is now a button
 * (it doubles as the metric-info trigger), so this looks it up by its
 * accessible name (the info icon beside it is aria-hidden, so the name is
 * exactly the label) rather than by text content, then walks from the
 * button up to its row and back down to the value cell.
 */
function getResultValue(label: string): string {
  const trigger = screen.getByRole("button", { name: label });
  const dt = trigger.closest("dt");
  const mainRow = dt?.parentElement;
  const dd = mainRow?.querySelector("dd");
  if (!dd) {
    throw new Error(`No value element found next to "${label}"`);
  }
  return dd.textContent ?? "";
}

describe("CalculationPanel", () => {
  it("displays the cylinder displacement computed from the current config", () => {
    render(<CalculationPanel />);
    const expected = calculateCylinderDisplacementCc(
      DEFAULT_CONFIG.boreMm,
      DEFAULT_CONFIG.strokeMm,
    );
    expect(getResultValue("Cylinder displacement")).toBe(
      `${formatRounded(expected, 1)} cc`,
    );
  });

  it("displays the clearance volume and clearance height for the default configuration", () => {
    render(<CalculationPanel />);

    // Literal values for boreMm=86, strokeMm=86, compressionRatio=10.5,
    // computed independently from the formulas documented in
    // src/engine/calculations.ts (Vclearance = Vswept / (CR - 1),
    // heightMm = strokeMm / (CR - 1)) rather than by calling the functions
    // under test.
    expect(getResultValue("Clearance volume")).toBe("52.6 cc");
    expect(getResultValue("Clearance height (TDC)")).toBe("9.05 mm");
  });

  it("displays the clearance height in inches when the display unit is inches", () => {
    useEngineStore.setState({
      preferences: { displayUnit: "in", showLabels: true },
    });
    render(<CalculationPanel />);

    // 86 / 9.5 / 25.4 = 0.35640... in, rounded to 3 decimals.
    expect(getResultValue("Clearance height (TDC)")).toBe("0.356 in");
    // Clearance volume stays in cc regardless of the length display unit.
    expect(getResultValue("Clearance volume")).toBe("52.6 cc");
  });

  it("shows zero piston displacement and zero rod angle at top dead center", () => {
    render(<CalculationPanel />);

    expect(getResultValue("Piston displacement from TDC")).toBe("0.00 mm");
    expect(getResultValue("Connecting-rod angle")).toBe("0.0°");
    expect(getResultValue("Current crank angle")).toBe("0.0°");
  });

  it("shows piston displacement equal to the stroke at bottom dead center", () => {
    useEngineStore.setState({ crankAngleRad: Math.PI });
    render(<CalculationPanel />);

    expect(getResultValue("Piston displacement from TDC")).toBe(
      `${formatRounded(DEFAULT_CONFIG.strokeMm, 2)} mm`,
    );
    expect(getResultValue("Current crank angle")).toBe("180.0°");
  });

  it("renders a textual mechanism description that reflects the current crank angle", () => {
    useEngineStore.setState({ crankAngleRad: Math.PI / 2 });
    render(<CalculationPanel />);

    const description = screen.getByTestId("mechanism-description");
    expect(description.textContent).toMatch(/90\.0 degrees/);
    expect(description.textContent).toMatch(/top dead center/);
  });

  it("re-renders results when the store's crank angle changes", () => {
    render(<CalculationPanel />);
    expect(getResultValue("Current crank angle")).toBe("0.0°");

    act(() => {
      useEngineStore.setState({ crankAngleRad: Math.PI / 2 });
    });
    expect(getResultValue("Current crank angle")).toBe("90.0°");
  });

  it("displays the static piston-to-head distance range in millimeters", () => {
    render(<CalculationPanel />);
    // Literal values for strokeMm=86, compressionRatio=10.5, computed
    // independently: clearance height = 86 / 9.5 = 9.0526... mm (the TDC
    // minimum); clearance height + stroke = 95.0526... mm (the BDC
    // maximum) — rather than by calling the function under test.
    expect(getResultValue("Piston-to-head distance")).toBe("9.05 – 95.05 mm");
  });

  it("displays the static piston-to-head distance range in inches", () => {
    useEngineStore.setState({
      preferences: { displayUnit: "in", showLabels: true },
    });
    render(<CalculationPanel />);
    // 9.0526.../25.4 = 0.3564... in; 95.0526.../25.4 = 3.7423... in.
    expect(getResultValue("Piston-to-head distance")).toBe("0.356 – 3.742 in");
  });

  it("keeps the piston-to-head distance range unchanged as the crank angle changes", () => {
    render(<CalculationPanel />);
    expect(getResultValue("Piston-to-head distance")).toBe("9.05 – 95.05 mm");

    act(() => {
      useEngineStore.setState({ crankAngleRad: Math.PI / 2 });
    });
    expect(getResultValue("Piston-to-head distance")).toBe("9.05 – 95.05 mm");
  });

  it("shows the live piston-to-head distance at its minimum (TDC)", () => {
    render(<CalculationPanel />);
    // Equal to the clearance height, and to the static range's minimum.
    expect(getResultValue("Current piston-to-head distance")).toBe("9.05 mm");
  });

  it("shows the live piston-to-head distance at its maximum (BDC)", () => {
    useEngineStore.setState({ crankAngleRad: Math.PI });
    render(<CalculationPanel />);
    // Equal to the static range's maximum.
    expect(getResultValue("Current piston-to-head distance")).toBe("95.05 mm");
  });

  it("displays the redline and mean piston speed at redline for the default configuration", () => {
    render(<CalculationPanel />);
    // DEFAULT_CONFIG.redlineRpm = 7000.
    expect(getResultValue("Redline")).toBe("7,000 rpm");
    // 2 x 0.086 m x 7000 rpm / 60 = 20.0666... m/s, computed independently
    // rather than by calling calculateMeanPistonSpeedMps directly.
    expect(getResultValue("Mean piston speed at redline")).toBe("20.07 m/s");
  });

  it("appends the industry square/oversquare/undersquare classification to the bore-to-stroke ratio", () => {
    render(<CalculationPanel />);
    // DEFAULT_CONFIG is 86 x 86 mm: exactly 1:1, "square".
    expect(getResultValue("Bore-to-stroke ratio")).toBe("1.00:1 · square");
  });

  it("renders engine B's own values when given the comparison slot", () => {
    const comparisonConfig: CrankMechanismConfig = {
      boreMm: 100,
      strokeMm: 90,
      rodLengthMm: 160,
      compressionRatio: 9,
      redlineRpm: 7000,
    };
    act(() => {
      useEngineStore.getState().enableComparison(comparisonConfig);
    });

    render(<CalculationPanel slot="comparison" />);

    // Literal values computed independently for boreMm=100, strokeMm=90,
    // rather than by calling the function under test.
    expect(getResultValue("Cylinder displacement")).toBe("706.9 cc");
    expect(getResultValue("Bore-to-stroke ratio")).toBe("1.11:1 · oversquare");
    // Piston-to-head range reflects engine B's own stroke/CR (90 mm, 9:1:
    // clearance = 90/8 = 11.25 mm, so 11.25 - 101.25 mm), not engine A's.
    expect(getResultValue("Piston-to-head distance")).toBe("11.25 – 101.25 mm");

    // Engine A's own config (still DEFAULT_CONFIG) is untouched.
    expect(useEngineStore.getState().config).toEqual(DEFAULT_CONFIG);
  });

  describe("metric info popups", () => {
    it("opens the matching METRIC_INFO explainer when a row's label is clicked, and reflects it via aria-expanded", async () => {
      const user = userEvent.setup();
      render(<CalculationPanel />);

      const trigger = screen.getByRole("button", {
        name: "Cylinder displacement",
      });
      expect(trigger).toHaveAttribute("aria-expanded", "false");

      await user.click(trigger);

      expect(trigger).toHaveAttribute("aria-expanded", "true");
      const info = METRIC_INFO_BY_ID.get("cylinderDisplacement");
      expect(info).toBeDefined();
      expect(screen.getByText(info!.body)).toBeInTheDocument();
    });

    it("closes the explainer when its trigger is clicked again", async () => {
      const user = userEvent.setup();
      render(<CalculationPanel />);

      const trigger = screen.getByRole("button", {
        name: "Cylinder displacement",
      });
      await user.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      await user.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      const info = METRIC_INFO_BY_ID.get("cylinderDisplacement");
      expect(screen.queryByText(info!.body)).not.toBeInTheDocument();
    });

    it("keeps only one explainer open at a time", async () => {
      const user = userEvent.setup();
      render(<CalculationPanel />);

      const first = screen.getByRole("button", {
        name: "Cylinder displacement",
      });
      const second = screen.getByRole("button", {
        name: "Bore-to-stroke ratio",
      });

      await user.click(first);
      expect(first).toHaveAttribute("aria-expanded", "true");

      await user.click(second);
      expect(second).toHaveAttribute("aria-expanded", "true");
      expect(first).toHaveAttribute("aria-expanded", "false");

      const firstInfo = METRIC_INFO_BY_ID.get("cylinderDisplacement");
      expect(screen.queryByText(firstInfo!.body)).not.toBeInTheDocument();
    });

    it("closes the open explainer on Escape", async () => {
      const user = userEvent.setup();
      render(<CalculationPanel />);

      const trigger = screen.getByRole("button", {
        name: "Cylinder displacement",
      });
      await user.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      await user.keyboard("{Escape}");

      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("associates the trigger with its explainer via aria-controls", async () => {
      const user = userEvent.setup();
      render(<CalculationPanel />);

      const trigger = screen.getByRole("button", {
        name: "Cylinder displacement",
      });
      await user.click(trigger);

      const controlsId = trigger.getAttribute("aria-controls");
      expect(controlsId).toBeTruthy();
      expect(document.getElementById(controlsId!)).not.toBeNull();
    });
  });
});
