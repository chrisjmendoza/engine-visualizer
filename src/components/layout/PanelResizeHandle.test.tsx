import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PanelResizeHandle } from "./PanelResizeHandle";

afterEach(cleanup);

const MIN_WIDTH_PX = 320;
const MAX_WIDTH_PX = 780;
const DEFAULT_WIDTH_PX = 380;

function renderHandle(widthPx = DEFAULT_WIDTH_PX) {
  const onLiveWidthChange = vi.fn();
  const onCommit = vi.fn();
  render(
    <PanelResizeHandle
      widthPx={widthPx}
      defaultWidthPx={DEFAULT_WIDTH_PX}
      minWidthPx={MIN_WIDTH_PX}
      getMaxWidthPx={() => MAX_WIDTH_PX}
      onLiveWidthChange={onLiveWidthChange}
      onCommit={onCommit}
    />,
  );
  return {
    handle: screen.getByRole("separator", { name: /resize panel/i }),
    onLiveWidthChange,
    onCommit,
  };
}

describe("PanelResizeHandle", () => {
  it("dragging left widens the panel live, without committing until release", () => {
    const { handle, onLiveWidthChange, onCommit } = renderHandle();

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 500, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 470 }); // 30px left
    expect(onLiveWidthChange).toHaveBeenLastCalledWith(410); // 380 + 30
    expect(onCommit).not.toHaveBeenCalled();
    expect(handle).toHaveAttribute("aria-valuenow", "410");

    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 460 }); // 40px left
    expect(onLiveWidthChange).toHaveBeenLastCalledWith(420);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 460 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(420);
  });

  it("dragging right narrows the panel", () => {
    const { handle, onLiveWidthChange } = renderHandle();

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 500, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 550 }); // 50px right
    expect(onLiveWidthChange).toHaveBeenLastCalledWith(330); // 380 - 50
  });

  it("clamps a drag at the configured min and max", () => {
    const { handle, onLiveWidthChange } = renderHandle();

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 500, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 5000 }); // way right
    expect(onLiveWidthChange).toHaveBeenLastCalledWith(MIN_WIDTH_PX);

    fireEvent.pointerMove(handle, { pointerId: 1, clientX: -5000 }); // way left
    expect(onLiveWidthChange).toHaveBeenLastCalledWith(MAX_WIDTH_PX);
  });

  it("ignores pointer move before any pointer down (no drag in progress)", () => {
    const { handle, onLiveWidthChange } = renderHandle();
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 100 });
    expect(onLiveWidthChange).not.toHaveBeenCalled();
  });

  it("a non-primary-button pointer down does not start a drag", () => {
    const { handle, onLiveWidthChange } = renderHandle();
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 500, button: 2 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 470 });
    expect(onLiveWidthChange).not.toHaveBeenCalled();
  });
});
