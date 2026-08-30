import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CalculationPanel } from "./CalculationPanel";
import { useEngineStore } from "../../state/engineStore";
import {
  DEFAULT_ANIMATION,
  DEFAULT_CONFIG,
  DEFAULT_PLAYBACK_SPEED,
} from "../../engine/constants";
import { calculateCylinderDisplacementCc } from "../../engine/calculations";
import { formatRounded } from "../shared/formatting";
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

/** Reads the <dd> text next to a <dt> whose text matches `label`. */
function getResultValue(label: string): string {
  const term = screen.getByText(label);
  const value = term.nextElementSibling;
  if (!value) {
    throw new Error(`No value element found next to "${label}"`);
  }
  return value.textContent ?? "";
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

  it("renders engine B's own values when given the comparison slot", () => {
    const comparisonConfig: CrankMechanismConfig = {
      boreMm: 100,
      strokeMm: 90,
      rodLengthMm: 160,
      compressionRatio: 9,
    };
    act(() => {
      useEngineStore.getState().enableComparison(comparisonConfig);
    });

    render(<CalculationPanel slot="comparison" />);

    // Literal values computed independently for boreMm=100, strokeMm=90,
    // rather than by calling the function under test.
    expect(getResultValue("Cylinder displacement")).toBe("706.9 cc");
    expect(getResultValue("Bore-to-stroke ratio")).toBe("1.11:1");

    // Engine A's own config (still DEFAULT_CONFIG) is untouched.
    expect(useEngineStore.getState().config).toEqual(DEFAULT_CONFIG);
  });
});
