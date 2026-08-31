import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComparisonTable } from "./ComparisonTable";
import { useEngineStore } from "../../state/engineStore";
import {
  DEFAULT_ANIMATION,
  DEFAULT_CONFIG,
  DEFAULT_PLAYBACK_SPEED,
} from "../../engine/constants";
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

/** Reads a metric row's [Engine A, Engine B, Difference] cell text. */
function getRow(label: string): [string, string, string] {
  const rowHeader = screen.getByRole("rowheader", { name: label });
  const row = rowHeader.closest("tr");
  if (!row) {
    throw new Error(`expected a <tr> ancestor for row "${label}"`);
  }
  const cells = within(row).getAllByRole("cell");
  return [
    cells[0].textContent ?? "",
    cells[1].textContent ?? "",
    cells[2].textContent ?? "",
  ];
}

/** Engine B differs from the default only in stroke (86 -> 90 mm). */
const STROKE_90_CONFIG: CrankMechanismConfig = {
  ...DEFAULT_CONFIG,
  strokeMm: 90,
};

function enableComparisonWith(config: CrankMechanismConfig) {
  act(() => {
    useEngineStore.getState().enableComparison(config);
  });
}

describe("ComparisonTable", () => {
  it("renders an accessible table with a caption and column headers", () => {
    enableComparisonWith(STROKE_90_CONFIG);
    render(<ComparisonTable />);

    expect(
      screen.getByRole("table", { name: /calculated results/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Metric" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Engine A" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Engine B" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Difference" }),
    ).toBeInTheDocument();
  });

  it("shows both engines' own values and the correct signed percentage difference", () => {
    enableComparisonWith(STROKE_90_CONFIG);
    render(<ComparisonTable />);

    // Literal values for A (bore 86, stroke 86, CR 10.5) vs B (bore 86,
    // stroke 90, CR 10.5), computed independently from the documented
    // formulas rather than by calling the functions under test.
    expect(getRow("Cylinder displacement")).toEqual([
      "499.6 cc",
      "522.8 cc",
      "+4.7%",
    ]);
    expect(getRow("Bore-to-stroke ratio")).toEqual([
      "1.00:1 · square",
      "0.96:1 · undersquare",
      "−4.4%",
    ]);
    expect(getRow("Mean piston speed")).toEqual([
      "1.72 m/s",
      "1.80 m/s",
      "+4.7%",
    ]);
    expect(getRow("Clearance height (TDC)")).toEqual([
      "9.05 mm",
      "9.47 mm",
      "+4.7%",
    ]);
  });

  it('shows "—" instead of a bogus percentage when the baseline is zero (piston displacement at TDC)', () => {
    enableComparisonWith(STROKE_90_CONFIG);
    render(<ComparisonTable />);

    // At crankAngleRad=0 (TDC) piston displacement is exactly 0 for every
    // configuration, so a relative percentage is undefined, not "0.0%".
    expect(getRow("Piston displacement from TDC")).toEqual([
      "0.00 mm",
      "0.00 mm",
      "—",
    ]);
    expect(getRow("Connecting-rod angle")).toEqual(["0.0°", "0.0°", "—"]);
  });

  it('shows "—" for the shared crank angle rather than a real 0.0%', () => {
    enableComparisonWith(STROKE_90_CONFIG);
    render(<ComparisonTable />);

    // Both engines share one crank angle by definition; equal values here
    // reflect that they can never differ, not a coincidental match.
    expect(getRow("Current crank angle")).toEqual(["0.0°", "0.0°", "—"]);
  });

  it('shows "—" for the piston-to-head distance range (not a single scalar)', () => {
    enableComparisonWith(STROKE_90_CONFIG);
    render(<ComparisonTable />);

    expect(getRow("Piston-to-head distance")).toEqual([
      "9.05 – 95.05 mm",
      "9.47 – 99.47 mm",
      "—",
    ]);
  });

  it("does not declare a winner: the difference cells carry no sign-based styling hook", () => {
    enableComparisonWith(STROKE_90_CONFIG);
    render(<ComparisonTable />);

    const [, , difference] = getRow("Cylinder displacement");
    expect(difference).toBe("+4.7%");

    // No element anywhere claims a "winner" — this table only ever shows a
    // neutral delta, per the design intent (deliberately not gpuboss-style
    // highlighting).
    expect(screen.queryByText(/winner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/better/i)).not.toBeInTheDocument();
    expect(document.querySelector("[data-winner]")).toBeNull();
  });

  it("shows both engines' textual mechanism descriptions, labeled", () => {
    enableComparisonWith(STROKE_90_CONFIG);
    render(<ComparisonTable />);

    const descriptionA = screen.getByTestId("mechanism-description-a");
    const descriptionB = screen.getByTestId("mechanism-description-b");
    expect(descriptionA.textContent).toMatch(/^Engine A\./);
    expect(descriptionB.textContent).toMatch(/^Engine B\./);
    expect(descriptionA.textContent).toMatch(/top dead center/);
    expect(descriptionB.textContent).toMatch(/top dead center/);
  });

  it("updates live values when the store's crank angle changes, without new animation logic", () => {
    enableComparisonWith(STROKE_90_CONFIG);
    render(<ComparisonTable />);

    expect(getRow("Current crank angle")[0]).toBe("0.0°");

    act(() => {
      useEngineStore.setState({ crankAngleRad: Math.PI / 2 });
    });

    expect(getRow("Current crank angle")[0]).toBe("90.0°");
  });

  it("shows the redline and mean piston speed at redline for both engines, with a signed percentage", () => {
    // A keeps DEFAULT_CONFIG's redlineRpm (7000); B differs only in
    // redlineRpm (8900), so both rows share one hand-computed percentage.
    enableComparisonWith({ ...DEFAULT_CONFIG, redlineRpm: 8900 });
    render(<ComparisonTable />);

    expect(getRow("Redline")).toEqual(["7,000 rpm", "8,900 rpm", "+27.1%"]);
    // 2 x 0.086 m x {7000,8900} rpm / 60, computed independently rather
    // than by calling calculateMeanPistonSpeedMps directly.
    expect(getRow("Mean piston speed at redline")).toEqual([
      "20.07 m/s",
      "25.51 m/s",
      "+27.1%",
    ]);
  });

  describe("metric info popups", () => {
    it("opens the matching METRIC_INFO explainer in a full-width row when a label is clicked", async () => {
      enableComparisonWith(STROKE_90_CONFIG);
      const user = userEvent.setup();
      render(<ComparisonTable />);

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
      enableComparisonWith(STROKE_90_CONFIG);
      const user = userEvent.setup();
      render(<ComparisonTable />);

      const trigger = screen.getByRole("button", {
        name: "Cylinder displacement",
      });
      await user.click(trigger);
      await user.click(trigger);

      expect(trigger).toHaveAttribute("aria-expanded", "false");
      const info = METRIC_INFO_BY_ID.get("cylinderDisplacement");
      expect(screen.queryByText(info!.body)).not.toBeInTheDocument();
    });

    it("keeps only one explainer open at a time", async () => {
      enableComparisonWith(STROKE_90_CONFIG);
      const user = userEvent.setup();
      render(<ComparisonTable />);

      const first = screen.getByRole("button", {
        name: "Cylinder displacement",
      });
      const second = screen.getByRole("button", {
        name: "Bore-to-stroke ratio",
      });

      await user.click(first);
      await user.click(second);

      expect(second).toHaveAttribute("aria-expanded", "true");
      expect(first).toHaveAttribute("aria-expanded", "false");
      const firstInfo = METRIC_INFO_BY_ID.get("cylinderDisplacement");
      expect(screen.queryByText(firstInfo!.body)).not.toBeInTheDocument();
    });

    it("closes the open explainer on Escape", async () => {
      enableComparisonWith(STROKE_90_CONFIG);
      const user = userEvent.setup();
      render(<ComparisonTable />);

      const trigger = screen.getByRole("button", {
        name: "Cylinder displacement",
      });
      await user.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      await user.keyboard("{Escape}");

      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  });
});
