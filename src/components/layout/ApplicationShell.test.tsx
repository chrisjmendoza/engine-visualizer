import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApplicationShell } from "./ApplicationShell";

// This project's Vitest config does not enable `globals`, so
// @testing-library/react's automatic afterEach(cleanup) never registers;
// unmount explicitly so each test starts from an empty document.
afterEach(cleanup);

// jsdom defaults window.innerWidth to 1024 (a two-column-layout width by
// ApplicationShell's own 900px cutoff); tests that care about the exact
// resize bounds set a specific width instead of relying on that default,
// and every test restores it afterward so order doesn't matter.
const DEFAULT_JSDOM_WIDTH = 1024;

function setWindowWidth(width: number) {
  window.innerWidth = width;
}

afterEach(() => {
  setWindowWidth(DEFAULT_JSDOM_WIDTH);
});

function getHandle() {
  return screen.getByRole("separator", { name: /resize panel/i });
}

describe("ApplicationShell", () => {
  it("renders an app header with the title", () => {
    render(<ApplicationShell viewport={<div />} panel={<div />} />);
    expect(
      screen.getByRole("heading", { name: /engine visualizer/i }),
    ).toBeInTheDocument();
  });

  it("renders the viewport before the panel in document order", () => {
    render(
      <ApplicationShell
        viewport={<div data-testid="viewport-content">viewport</div>}
        panel={<div data-testid="panel-content">panel</div>}
      />,
    );
    const viewportEl = screen.getByTestId("viewport-content");
    const panelEl = screen.getByTestId("panel-content");
    expect(
      viewportEl.compareDocumentPosition(panelEl) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("labels both regions for assistive technology", () => {
    render(<ApplicationShell viewport={<div />} panel={<div />} />);
    expect(screen.getByLabelText(/engine viewport/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/controls and results/i)).toBeInTheDocument();
  });
});

describe("ApplicationShell's panel resize handle", () => {
  it("renders as a focusable vertical separator with px-valued ARIA bounds", () => {
    setWindowWidth(1200);
    render(<ApplicationShell viewport={<div />} panel={<div />} />);

    const handle = getHandle();
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("tabIndex", "0");
    // Default width (380), min (320), and max (65% of the 1200px window
    // set above, i.e. 780) — see ApplicationShell.tsx's constants.
    expect(handle).toHaveAttribute("aria-valuenow", "380");
    expect(handle).toHaveAttribute("aria-valuemin", "320");
    expect(handle).toHaveAttribute("aria-valuemax", "780");
  });

  it("is absent from a stacked (narrow) layout", () => {
    setWindowWidth(500);
    render(<ApplicationShell viewport={<div />} panel={<div />} />);

    expect(
      screen.queryByRole("separator", { name: /resize panel/i }),
    ).not.toBeInTheDocument();
  });

  it("steps the width with the arrow keys, a bigger step with Shift", () => {
    setWindowWidth(1200);
    render(<ApplicationShell viewport={<div />} panel={<div />} />);
    const handle = getHandle();

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", "396"); // 380 + 16

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(handle).toHaveAttribute("aria-valuenow", "364"); // 396 - 16 - 16

    fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true });
    expect(handle).toHaveAttribute("aria-valuenow", "428"); // 364 + 64
  });

  it("clamps Home to the minimum and End to the maximum width", () => {
    setWindowWidth(1200);
    render(<ApplicationShell viewport={<div />} panel={<div />} />);
    const handle = getHandle();

    fireEvent.keyDown(handle, { key: "Home" });
    expect(handle).toHaveAttribute("aria-valuenow", "320");

    fireEvent.keyDown(handle, { key: "End" });
    expect(handle).toHaveAttribute("aria-valuenow", "780");

    // Stepping further past either bound stays clamped rather than
    // over/undershooting.
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", "780");
  });

  it("resets to the default width on Enter", () => {
    setWindowWidth(1200);
    render(<ApplicationShell viewport={<div />} panel={<div />} />);
    const handle = getHandle();

    fireEvent.keyDown(handle, { key: "End" });
    expect(handle).toHaveAttribute("aria-valuenow", "780");

    fireEvent.keyDown(handle, { key: "Enter" });
    expect(handle).toHaveAttribute("aria-valuenow", "380");
  });

  it("resets to the default width on double-click", () => {
    setWindowWidth(1200);
    render(<ApplicationShell viewport={<div />} panel={<div />} />);
    const handle = getHandle();

    fireEvent.keyDown(handle, { key: "Home" });
    expect(handle).toHaveAttribute("aria-valuenow", "320");

    fireEvent.doubleClick(handle);
    expect(handle).toHaveAttribute("aria-valuenow", "380");
  });
});
