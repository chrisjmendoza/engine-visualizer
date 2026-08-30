import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ApplicationShell } from "./ApplicationShell";

// This project's Vitest config does not enable `globals`, so
// @testing-library/react's automatic afterEach(cleanup) never registers;
// unmount explicitly so each test starts from an empty document.
afterEach(cleanup);

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
