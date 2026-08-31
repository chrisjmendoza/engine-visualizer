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
import { DEFAULT_LAYOUT_ID } from "../../engine/engineLayout";
import { ENGINE_PRESETS } from "../../engine/presets";
import { METRIC_INFO_BY_ID } from "../shared/calculationFormatting";
import type { CrankMechanismConfig } from "../../engine/types";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    comparisonConfig: null,
    layoutId: DEFAULT_LAYOUT_ID,
    comparisonLayoutId: DEFAULT_LAYOUT_ID,
    singleCylinderView: true,
    comparisonSingleCylinderView: true,
    preferences: { displayUnit: "mm", showLabels: true, showCycle: false },
    rpm: DEFAULT_ANIMATION.rpm,
    comparisonRpm: DEFAULT_ANIMATION.rpm,
    rpmLinked: true,
    playbackSpeed: DEFAULT_PLAYBACK_SPEED,
    isPlaying: false,
    crankAngleRad: 0,
    comparisonCrankAngleRad: 0,
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
    // DEFAULT_ANIMATION.rpm is 60: 2 x 0.086 m x 60 / 60 = 0.172 m/s (A),
    // 2 x 0.090 m x 60 / 60 = 0.18 m/s (B).
    expect(getRow("Mean piston speed")).toEqual([
      "0.17 m/s",
      "0.18 m/s",
      "+4.7%",
    ]);
    expect(getRow("Clearance height (TDC)")).toEqual([
      "9.05 mm",
      "9.47 mm",
      "+4.7%",
    ]);
  });

  it("shows each side's own total displacement once its layout has more than one cylinder (§24a)", () => {
    enableComparisonWith(STROKE_90_CONFIG);
    useEngineStore.setState({
      layoutId: "inline-4",
      comparisonLayoutId: "v6-60",
      singleCylinderView: false,
      comparisonSingleCylinderView: false,
    });
    render(<ComparisonTable />);

    // Per-cylinder values are the same as the plain two-engine test above
    // (499.6 cc / 522.8 cc); each side additionally multiplies by its own
    // layout's cylinder count for "total", and the difference column stays
    // per-cylinder.
    expect(getRow("Cylinder displacement")).toEqual([
      "499.6 cc/cyl · 1998.2 cc total",
      "522.8 cc/cyl · 3136.8 cc total",
      "+4.7%",
    ]);
  });

  it("counts only what each side is showing when a cylinder view is on (§24a)", () => {
    enableComparisonWith(STROKE_90_CONFIG);
    useEngineStore.setState({
      layoutId: "inline-4",
      comparisonLayoutId: "v6-60",
      // Engine A is being studied one cylinder at a time; engine B is not.
      singleCylinderView: true,
      comparisonSingleCylinderView: false,
    });
    render(<ComparisonTable />);

    expect(getRow("Cylinder displacement")).toEqual([
      "499.6 cc",
      "522.8 cc/cyl · 3136.8 cc total",
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

  describe("unlinked per-engine speed (rpmLinked: false)", () => {
    function setUnlinkedScenario() {
      enableComparisonWith(STROKE_90_CONFIG);
      useEngineStore.setState({
        rpmLinked: false,
        rpm: 60,
        comparisonRpm: 3000,
        crankAngleRad: Math.PI / 4, // 45°
        comparisonCrankAngleRad: Math.PI / 2, // 90°
      });
    }

    it("uses engine A's shared rpm and engine B's own comparisonRpm for mean piston speed", () => {
      setUnlinkedScenario();
      render(<ComparisonTable />);

      // Literal values computed independently: 2 x 0.086 m x 60 / 60 = 0.172
      // m/s (A); 2 x 0.090 m x 3000 / 60 = 9.0 m/s (B, from comparisonRpm,
      // not the shared rpm).
      expect(getRow("Mean piston speed")).toEqual([
        "0.17 m/s",
        "9.00 m/s",
        "+5132.6%",
      ]);
    });

    it("uses the shared rpm for both engines' mean piston speed while linked", () => {
      // rpmLinked stays true (the default) and comparisonRpm is a
      // deliberately different value, to prove it's ignored while linked.
      enableComparisonWith(STROKE_90_CONFIG);
      useEngineStore.setState({ rpm: 60, comparisonRpm: 3000 });
      render(<ComparisonTable />);

      expect(getRow("Mean piston speed")).toEqual([
        "0.17 m/s",
        "0.18 m/s",
        "+4.7%",
      ]);
    });

    it("shows engine B's own comparisonCrankAngleRad and a real difference for current crank angle while unlinked", () => {
      setUnlinkedScenario();
      render(<ComparisonTable />);

      expect(getRow("Current crank angle")).toEqual([
        "45.0°",
        "90.0°",
        "+100.0%",
      ]);
    });

    it('keeps "—" for current crank angle while linked, even though the row now supports a real difference', () => {
      enableComparisonWith(STROKE_90_CONFIG);
      useEngineStore.setState({ crankAngleRad: Math.PI / 4 });
      render(<ComparisonTable />);

      expect(getRow("Current crank angle")).toEqual(["45.0°", "45.0°", "—"]);
    });

    it("derives piston displacement and rod angle from each engine's own live angle while unlinked", () => {
      setUnlinkedScenario();
      render(<ComparisonTable />);

      // Literal values computed independently from the slider-crank formula
      // at each engine's own angle (A: 86 mm stroke at 45°; B: 90 mm
      // stroke at 90°) — not both read from the shared crank angle.
      expect(getRow("Piston displacement from TDC")).toEqual([
        "15.86 mm",
        "52.26 mm",
        "+229.4%",
      ]);
    });
  });

  describe("peak power / peak torque (verified preset output only)", () => {
    function presetFixture(id: string) {
      const preset = ENGINE_PRESETS.find((candidate) => candidate.id === id);
      if (!preset?.output) {
        throw new Error(`Fixture preset '${id}' must have output`);
      }
      return preset;
    }

    it('shows "—" for peak power/torque and their difference when neither engine matches a preset', () => {
      enableComparisonWith(STROKE_90_CONFIG);
      render(<ComparisonTable />);

      expect(getRow("Peak power")).toEqual(["—", "—", "—"]);
      expect(getRow("Peak torque")).toEqual(["—", "—", "—"]);
    });

    it("shows each engine's own manufacturer-published peak figures and a signed percentage difference", () => {
      const s2000Ap1 = presetFixture("s2000-ap1");
      const ls3 = presetFixture("corvette-c6-ls3");
      useEngineStore.setState({ config: s2000Ap1.config });
      enableComparisonWith(ls3.config);
      render(<ComparisonTable />);

      expect(getRow("Peak power")).toEqual([
        "240 hp @ 8,300 rpm",
        "430 hp @ 5,900 rpm",
        "+79.2%",
      ]);
      expect(getRow("Peak torque")).toEqual([
        "153 lb-ft @ 7,500 rpm",
        "424 lb-ft @ 4,600 rpm",
        "+177.1%",
      ]);
    });

    it('shows "—" for the difference when only one engine matches a preset', () => {
      const s2000Ap1 = presetFixture("s2000-ap1");
      useEngineStore.setState({ config: s2000Ap1.config });
      enableComparisonWith(STROKE_90_CONFIG);
      render(<ComparisonTable />);

      expect(getRow("Peak power")).toEqual(["240 hp @ 8,300 rpm", "—", "—"]);
      expect(getRow("Peak torque")).toEqual([
        "153 lb-ft @ 7,500 rpm",
        "—",
        "—",
      ]);
    });
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
