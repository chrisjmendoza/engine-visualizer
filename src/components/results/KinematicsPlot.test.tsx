import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { KinematicsPlot } from "./KinematicsPlot";
import { useEngineStore } from "../../state/engineStore";
import {
  DEFAULT_ANIMATION,
  DEFAULT_CONFIG,
  DEFAULT_PLAYBACK_SPEED,
  TWO_PI,
} from "../../engine/constants";
import type { CrankMechanismConfig } from "../../engine/types";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    comparisonConfig: null,
    cylinderCount: 1,
    comparisonCylinderCount: 1,
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

const COMPARISON_CONFIG: CrankMechanismConfig = {
  boreMm: 100,
  strokeMm: 90,
  // A markedly shorter rod than engine A's 143 mm: rod ratio 1.78 vs 1.66,
  // which is the difference these curves exist to show.
  rodLengthMm: 130,
  compressionRatio: 9,
  redlineRpm: 7000,
};

/** Every curve path for one engine, in strip order (position, velocity, acceleration). */
function curvePathsFor(engine: "a" | "b"): SVGPathElement[] {
  return Array.from(
    document.querySelectorAll<SVGPathElement>(`path[data-engine="${engine}"]`),
  );
}

function cursorFor(engine: "a" | "b"): SVGLineElement {
  const cursor = document.querySelector<SVGLineElement>(
    `line[data-engine="${engine}"]`,
  );
  if (!cursor) {
    throw new Error(`No cursor line rendered for engine ${engine}`);
  }
  return cursor;
}

/** The peak readout beside a strip's heading. */
function peakTextFor(stripLabel: string): string {
  const heading = screen.getByRole("heading", { name: stripLabel });
  const header = heading.parentElement;
  const peak = header?.querySelector("p");
  if (!peak) {
    throw new Error(`No peak readout found beside "${stripLabel}"`);
  }
  return peak.textContent ?? "";
}

describe("KinematicsPlot", () => {
  it("renders one strip per quantity, each with a drawn curve", () => {
    render(<KinematicsPlot />);

    for (const label of ["Position", "Velocity", "Acceleration"]) {
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }

    const paths = curvePathsFor("a");
    expect(paths).toHaveLength(3);
    for (const path of paths) {
      const d = path.getAttribute("d") ?? "";
      // 181 samples: one moveto plus 180 linetos.
      expect(d.startsWith("M")).toBe(true);
      expect(d.split("L")).toHaveLength(181);
    }
  });

  it("labels each strip's peak in real units at the current engine speed", () => {
    // DEFAULT_CONFIG is 86 mm stroke, 143 mm rod, at DEFAULT_ANIMATION.rpm
    // (60 rpm, so omega = 2*PI rad/s).
    render(<KinematicsPlot />);

    // Peak displacement from TDC is the stroke itself, by definition.
    expect(peakTextFor("Position")).toBe("peak 86.00 mm");

    // Peak acceleration is r(1 + r/l) * omega^2 / 1000 with r = 43, l = 143:
    // 55.930069930... * 4*PI^2 / 1000 = 2.2085... m/s^2, computed
    // independently of the functions under test.
    expect(peakTextFor("Acceleration")).toBe("peak 2.21 m/s²");
  });

  it("renders position peaks in inches when the display unit is inches", () => {
    useEngineStore.setState({
      preferences: { displayUnit: "in", showLabels: true, showCycle: false },
    });
    render(<KinematicsPlot />);

    // 86 / 25.4 = 3.3858... in. Velocity and acceleration stay in SI, as
    // "mean piston speed" does elsewhere in the panel.
    expect(peakTextFor("Position")).toBe("peak 3.386 in");
    expect(peakTextFor("Velocity")).toContain("m/s");
  });

  it("recomputes the curves when the configuration changes", () => {
    render(<KinematicsPlot />);
    const before = curvePathsFor("a").map((path) => path.getAttribute("d"));

    act(() => {
      useEngineStore.getState().setConfig({ rodLengthMm: 100 });
    });

    const after = curvePathsFor("a").map((path) => path.getAttribute("d"));
    // A shorter rod changes the curve shape, not just its labels.
    expect(after).not.toEqual(before);
  });

  it("draws no engine B curves and no legend outside comparison mode", () => {
    render(<KinematicsPlot />);

    expect(curvePathsFor("b")).toHaveLength(0);
    expect(screen.queryByText("Engine B")).not.toBeInTheDocument();
  });

  it("overlays engine B's curves, with a legend, in comparison mode", () => {
    act(() => {
      useEngineStore.getState().enableComparison(COMPARISON_CONFIG);
    });
    render(<KinematicsPlot />);

    expect(curvePathsFor("a")).toHaveLength(3);
    expect(curvePathsFor("b")).toHaveLength(3);
    expect(screen.getByText("Engine A")).toBeInTheDocument();
    expect(screen.getByText("Engine B")).toBeInTheDocument();

    // Different geometry must produce different paths — an overlay of two
    // identical lines would be a silently useless comparison.
    const [positionA] = curvePathsFor("a");
    const [positionB] = curvePathsFor("b");
    expect(positionB.getAttribute("d")).not.toBe(positionA.getAttribute("d"));
  });

  it("labels both engines' peaks separately in comparison mode", () => {
    act(() => {
      useEngineStore.getState().enableComparison(COMPARISON_CONFIG);
    });
    render(<KinematicsPlot />);

    // Each engine's peak position is its own stroke: 86 mm and 90 mm.
    expect(peakTextFor("Position")).toBe("peak A 86.00 mm · B 90.00 mm");
  });

  it("puts the cursor at the left edge at TDC and at mid-plot at 180 degrees", () => {
    render(<KinematicsPlot />);
    expect(cursorFor("a").getAttribute("x1")).toBe("0");

    act(() => {
      useEngineStore.setState({ crankAngleRad: Math.PI });
    });
    // The plot's user space is one unit per crank degree, so 180 degrees is
    // x = 180 of 360.
    expect(cursorFor("a").getAttribute("x1")).toBe("180");
  });

  it("moves the cursor as the store's throttled crank angle advances", () => {
    render(<KinematicsPlot />);
    const positions: (string | null)[] = [];

    for (const degrees of [45, 90, 270]) {
      act(() => {
        useEngineStore.setState({
          crankAngleRad: (degrees / 360) * TWO_PI,
        });
      });
      positions.push(cursorFor("a").getAttribute("x1"));
    }

    expect(positions).toEqual(["45", "90", "270"]);
  });

  it("wraps a crank angle past a full revolution back onto the plot", () => {
    act(() => {
      // The animation loop mirrors an unwrapped, ever-growing angle; the
      // cursor must fold it into the plotted revolution rather than run off
      // the right edge.
      useEngineStore.setState({ crankAngleRad: 4 * TWO_PI + Math.PI / 2 });
    });
    render(<KinematicsPlot />);

    expect(cursorFor("a").getAttribute("x1")).toBe("90");
  });

  it("draws a second cursor only when the engines' speeds are unlinked", () => {
    act(() => {
      useEngineStore.getState().enableComparison(COMPARISON_CONFIG);
    });
    const { rerender } = render(<KinematicsPlot />);

    // Linked: both engines share one crank angle, so one cursor says it all.
    expect(document.querySelectorAll('line[data-engine="b"]')).toHaveLength(0);

    act(() => {
      useEngineStore.setState({
        rpmLinked: false,
        comparisonCrankAngleRad: Math.PI / 2,
      });
    });
    rerender(<KinematicsPlot />);

    expect(cursorFor("b").getAttribute("x1")).toBe("90");
  });

  it("exposes each strip as a labelled image for assistive technology", () => {
    render(<KinematicsPlot />);

    // The canvas is never the only source of information (§19): each strip
    // names its quantity and states its peak in its accessible label, so the
    // curve's headline number is available without seeing the line.
    const charts = screen.getAllByRole("img");
    expect(charts).toHaveLength(3);
    expect(charts[0].getAttribute("aria-label")).toBe(
      "Position against crank angle over one revolution. Peak 86.00 mm.",
    );
  });
});
