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
import {
  DEFAULT_ROTARY_CONFIG,
  DEFAULT_ROTARY_ROTOR_COUNT,
} from "../../engine/rotaryConstants";
import { ROTARY_ENGINE_PRESETS } from "../../engine/rotaryPresets";
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
    engineFamily: "piston",
    comparisonEngineFamily: "piston",
    rotaryConfig: { ...DEFAULT_ROTARY_CONFIG },
    comparisonRotaryConfig: { ...DEFAULT_ROTARY_CONFIG },
    rotaryRotorCount: DEFAULT_ROTARY_ROTOR_COUNT,
    comparisonRotaryRotorCount: DEFAULT_ROTARY_ROTOR_COUNT,
    preferences: {
      displayUnit: "mm",
      showLabels: true,
      showCycle: false,
      uprightFlatEngines: false,
    },
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

  it("hides the engine displacement row when both engines are single-cylinder", () => {
    // resetStore's default is a single cylinder on each side, so the row
    // would be pure duplication of "Cylinder displacement" above it.
    enableComparisonWith(STROKE_90_CONFIG);
    render(<ComparisonTable />);

    expect(
      screen.queryByRole("rowheader", { name: "Engine displacement" }),
    ).not.toBeInTheDocument();
  });

  describe("cylinder displacement vs. engine displacement (§24a)", () => {
    it("adds a separate engine displacement row, computed on each side's own total, once both layouts have more than one cylinder", () => {
      enableComparisonWith(STROKE_90_CONFIG);
      useEngineStore.setState({
        layoutId: "inline-4",
        comparisonLayoutId: "v6-60",
        singleCylinderView: false,
        comparisonSingleCylinderView: false,
      });
      render(<ComparisonTable />);

      // Cylinder displacement never carries a "total" any more: it is the
      // same per-cylinder cc regardless of layout, and its difference is
      // the plain per-cylinder percentage.
      expect(getRow("Cylinder displacement")).toEqual([
        "499.6 cc",
        "522.8 cc",
        "+4.7%",
      ]);
      // Engine displacement is a distinct row and a distinct percentage:
      // each side's per-cylinder cc times its own layout's cylinder count
      // (4 for A, 6 for B), with the difference computed on those totals —
      // not the same +4.7% as the row above, since the two sides scale by
      // different cylinder counts.
      expect(getRow("Engine displacement")).toEqual([
        "1998.2 cc",
        "3136.8 cc",
        "+57.0%",
      ]);
    });

    it("shows the engine displacement row even when only one side is multi-cylinder", () => {
      enableComparisonWith(STROKE_90_CONFIG);
      useEngineStore.setState({
        layoutId: "inline-4",
        comparisonLayoutId: "v6-60",
        // Engine A is being studied one cylinder at a time; engine B is not.
        singleCylinderView: true,
        comparisonSingleCylinderView: false,
      });
      render(<ComparisonTable />);

      // Still per-cylinder only, on both sides.
      expect(getRow("Cylinder displacement")).toEqual([
        "499.6 cc",
        "522.8 cc",
        "+4.7%",
      ]);
      // Engine A shows one cylinder, so its total equals its cylinder
      // figure; engine B's total is its per-cylinder cc times 6. The row
      // must appear here — hiding it would drop exactly the comparison an
      // owner reading a single-cylinder A against a six-cylinder B wants.
      expect(getRow("Engine displacement")).toEqual([
        "499.6 cc",
        "3136.8 cc",
        "+527.9%",
      ]);
    });

    it("matches the owner's reported case: a smaller-total 4-cylinder against a larger-total 6-cylinder shows a negative cylinder difference and a positive engine difference", () => {
      const golfGti = ENGINE_PRESETS.find(
        (preset) => preset.id === "golf-gti-mk7-ea888",
      );
      const rb26 = ENGINE_PRESETS.find(
        (preset) => preset.id === "skyline-gtr-rb26dett",
      );
      if (!golfGti || !rb26) {
        throw new Error("Fixture presets must exist");
      }
      useEngineStore.setState({ config: golfGti.config });
      enableComparisonWith(rb26.config);
      useEngineStore.setState({
        layoutId: golfGti.layoutId,
        comparisonLayoutId: rb26.layoutId,
        singleCylinderView: false,
        comparisonSingleCylinderView: false,
      });
      render(<ComparisonTable />);

      // Golf GTI: 496.1 cc/cyl, 1984.3 cc total (4 cylinders).
      // RB26DETT: 428.1 cc/cyl, 2568.7 cc total (6 cylinders) — the smaller
      // cylinder but the substantially larger engine.
      expect(getRow("Cylinder displacement")).toEqual([
        "496.1 cc",
        "428.1 cc",
        "−13.7%",
      ]);
      expect(getRow("Engine displacement")).toEqual([
        "1984.3 cc",
        "2568.7 cc",
        "+29.4%",
      ]);
    });
  });

  describe("compression ratio", () => {
    it("shows each engine's own compression ratio and a signed percentage difference", () => {
      const miataNd = ENGINE_PRESETS.find(
        (preset) => preset.id === "miata-nd-2-0",
      );
      const supra = ENGINE_PRESETS.find(
        (preset) => preset.id === "supra-2jzgte",
      );
      if (!miataNd || !supra) {
        throw new Error("Fixture presets must exist");
      }
      // A clearly higher-compression naturally aspirated engine (ND
      // Miata, 13.0:1) against a clearly lower-compression turbo engine
      // (2JZ-GTE, 8.5:1), so the sign of the difference is unambiguous.
      useEngineStore.setState({ config: miataNd.config });
      enableComparisonWith(supra.config);
      render(<ComparisonTable />);

      expect(getRow("Compression ratio")).toEqual([
        "13.0:1",
        "8.5:1",
        "−34.6%",
      ]);
    });

    it("places compression ratio immediately above clearance volume", () => {
      enableComparisonWith(STROKE_90_CONFIG);
      render(<ComparisonTable />);

      const rowHeaders = screen
        .getAllByRole("rowheader")
        .map((header) => header.textContent);
      const ratioIndex = rowHeaders.findIndex((label) =>
        label?.includes("Compression ratio"),
      );
      const clearanceIndex = rowHeaders.findIndex((label) =>
        label?.includes("Clearance volume"),
      );
      expect(ratioIndex).toBeGreaterThanOrEqual(0);
      expect(clearanceIndex).toBe(ratioIndex + 1);
    });
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

describe("ComparisonTable — cross-family (§27)", () => {
  const RX7_13B = ROTARY_ENGINE_PRESETS.find((p) => p.id === "13b-rew")!;
  const RENESIS = ROTARY_ENGINE_PRESETS.find(
    (p) => p.id === "13b-msp-renesis",
  )!;

  it("piston vs piston: rotary-only rows stay absent, exactly as before rotary existed", () => {
    useEngineStore.setState({ comparisonConfig: STROKE_90_CONFIG });
    render(<ComparisonTable />);

    expect(
      screen.queryByRole("rowheader", { name: "Chamber displacement" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("rowheader", { name: "K-factor" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: "Bore-to-stroke ratio" }),
    ).toBeInTheDocument();
  });

  it("rotary vs rotary: chamber displacement and K-factor show real values on both sides; piston-only rows are absent entirely", () => {
    useEngineStore.setState({
      comparisonConfig: STROKE_90_CONFIG,
      engineFamily: "rotary",
      rotaryConfig: RX7_13B.config,
      rotaryRotorCount: RX7_13B.rotorCount,
      comparisonEngineFamily: "rotary",
      comparisonRotaryConfig: RENESIS.config,
      comparisonRotaryRotorCount: RENESIS.rotorCount,
    });
    render(<ComparisonTable />);

    const [chamberA, chamberB] = getRow("Chamber displacement");
    expect(chamberA).toContain("cc");
    expect(chamberB).toContain("cc");
    expect(chamberA).not.toBe("—");
    expect(chamberB).not.toBe("—");

    const [kA, kB] = getRow("K-factor");
    expect(kA).not.toBe("—");
    expect(kB).not.toBe("—");

    for (const label of [
      "Cylinder displacement",
      "Bore-to-stroke ratio",
      "Rod-to-stroke ratio",
      "Mean piston speed",
      "Clearance volume",
      "Connecting-rod angle",
    ]) {
      expect(screen.queryByRole("rowheader", { name: label })).toBeNull();
    }
  });

  it("mixed piston-vs-rotary comparison shows both row sets, with — filling the inapplicable side", () => {
    useEngineStore.setState({
      comparisonConfig: STROKE_90_CONFIG,
      engineFamily: "piston",
      comparisonEngineFamily: "rotary",
      comparisonRotaryConfig: RX7_13B.config,
      comparisonRotaryRotorCount: RX7_13B.rotorCount,
    });
    render(<ComparisonTable />);

    const [cylA, cylB] = getRow("Cylinder displacement");
    expect(cylA).not.toBe("—");
    expect(cylB).toBe("—");

    const [chamberA, chamberB] = getRow("Chamber displacement");
    expect(chamberA).toBe("—");
    expect(chamberB).not.toBe("—");

    // Shared rows show real values on both sides even in a mixed comparison.
    const [crA, crB] = getRow("Compression ratio");
    expect(crA).not.toBe("—");
    expect(crB).not.toBe("—");

    const [redlineA, redlineB] = getRow("Redline");
    expect(redlineA).not.toBe("—");
    expect(redlineB).not.toBe("—");
  });

  it("the shared engine-displacement row compares a rotary's rated cc against a piston's whole-engine cc", () => {
    useEngineStore.setState({
      comparisonConfig: STROKE_90_CONFIG,
      layoutId: "inline-4",
      singleCylinderView: false,
      engineFamily: "piston",
      comparisonEngineFamily: "rotary",
      comparisonRotaryConfig: RX7_13B.config,
      comparisonRotaryRotorCount: RX7_13B.rotorCount,
    });
    render(<ComparisonTable />);

    const [a, b, difference] = getRow("Engine displacement");
    expect(a).toContain("cc");
    expect(b).toContain("cc");
    expect(difference).not.toBe("—");
  });

  it("peak power/torque resolve each side's output from its own family's preset roster", () => {
    useEngineStore.setState({
      comparisonConfig: STROKE_90_CONFIG,
      engineFamily: "piston",
      config: ENGINE_PRESETS.find((p) => p.id === "s2000-ap1")!.config,
      comparisonEngineFamily: "rotary",
      comparisonRotaryConfig: RX7_13B.config,
      comparisonRotaryRotorCount: RX7_13B.rotorCount,
    });
    render(<ComparisonTable />);

    const [powerA, powerB] = getRow("Peak power");
    expect(powerA).toContain("240 hp");
    expect(powerB).toContain("255 hp");
  });
});
