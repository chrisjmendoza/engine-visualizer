import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useEngineStore } from "../state/engineStore";
import { DEFAULT_ANIMATION, DEFAULT_CONFIG } from "../engine/constants";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    comparisonConfig: null,
    isPlaying: false,
    crankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
    comparisonCrankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
  });
}

let activeUnmounts: (() => void)[] = [];

function mountShortcuts() {
  const result = renderHook(() => useKeyboardShortcuts());
  activeUnmounts.push(result.unmount);
  return result;
}

/** Dispatches a keydown on `target` (defaulting to `window`) and returns it. */
function fireKeyDown(
  key: string,
  options: Partial<KeyboardEventInit> = {},
  target: EventTarget = window,
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  for (const unmount of activeUnmounts.splice(0)) {
    unmount();
  }
  cleanup();
  document.body.replaceChildren();
});

describe("useKeyboardShortcuts — play/pause", () => {
  it("toggles play/pause on Space", () => {
    mountShortcuts();
    expect(useEngineStore.getState().isPlaying).toBe(false);

    fireKeyDown(" ");
    expect(useEngineStore.getState().isPlaying).toBe(true);

    fireKeyDown(" ");
    expect(useEngineStore.getState().isPlaying).toBe(false);
  });

  it("prevents the default page scroll only when it actually toggles playback", () => {
    mountShortcuts();
    const event = fireKeyDown(" ");
    expect(event.defaultPrevented).toBe(true);
  });

  it("does nothing when Space is held on a focused input", () => {
    mountShortcuts();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const event = fireKeyDown(" ", {}, input);

    expect(useEngineStore.getState().isPlaying).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  it("does nothing when Space is held on a button", () => {
    mountShortcuts();
    const button = document.createElement("button");
    document.body.appendChild(button);

    fireKeyDown(" ", {}, button);

    expect(useEngineStore.getState().isPlaying).toBe(false);
  });

  it("does nothing when Space is held inside a contentEditable element", () => {
    mountShortcuts();
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.appendChild(editable);

    fireKeyDown(" ", {}, editable);

    expect(useEngineStore.getState().isPlaying).toBe(false);
  });

  it("does nothing when Space is held on a plain child of a contentEditable element", () => {
    mountShortcuts();
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const child = document.createElement("span");
    editable.appendChild(child);
    document.body.appendChild(editable);

    fireKeyDown(" ", {}, child);

    expect(useEngineStore.getState().isPlaying).toBe(false);
  });

  it("does nothing when the key targets an element inside a modal dialog", () => {
    mountShortcuts();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const link = document.createElement("a");
    link.href = "#";
    dialog.appendChild(link);
    document.body.appendChild(dialog);

    fireKeyDown(" ", {}, link);
    fireKeyDown("ArrowRight", {}, link);

    expect(useEngineStore.getState().isPlaying).toBe(false);
    expect(useEngineStore.getState().crankAngleRad).toBe(0);
  });

  it("ignores Space with a non-Shift modifier held (e.g. Ctrl+Space)", () => {
    mountShortcuts();
    fireKeyDown(" ", { ctrlKey: true });
    expect(useEngineStore.getState().isPlaying).toBe(false);
  });
});

describe("useKeyboardShortcuts — arrow scrub", () => {
  it("scrubs +1 degree on ArrowRight and -1 degree on ArrowLeft", () => {
    mountShortcuts();

    fireKeyDown("ArrowRight");
    expect(useEngineStore.getState().crankAngleRad).toBeCloseTo(
      (1 * Math.PI) / 180,
      10,
    );
    expect(useEngineStore.getState().isPlaying).toBe(false);

    fireKeyDown("ArrowLeft");
    fireKeyDown("ArrowLeft");
    expect(useEngineStore.getState().crankAngleRad).toBeCloseTo(
      normalizeToWrapped(-1),
      10,
    );
  });

  it("steps by 10 degrees when Shift is held", () => {
    mountShortcuts();

    fireKeyDown("ArrowRight", { shiftKey: true });
    expect(useEngineStore.getState().crankAngleRad).toBeCloseTo(
      (10 * Math.PI) / 180,
      10,
    );
  });

  it("pauses playback when scrubbing via arrow keys", () => {
    useEngineStore.setState({ isPlaying: true });
    mountShortcuts();

    fireKeyDown("ArrowRight");

    expect(useEngineStore.getState().isPlaying).toBe(false);
  });

  it("wraps forward past 360 degrees back to 0", () => {
    useEngineStore.setState({ crankAngleRad: (359 * Math.PI) / 180 });
    mountShortcuts();

    fireKeyDown("ArrowRight", { shiftKey: true });

    expect(useEngineStore.getState().crankAngleRad).toBeCloseTo(
      (9 * Math.PI) / 180,
      10,
    );
  });

  it("wraps backward past 0 degrees to just under 360", () => {
    useEngineStore.setState({ crankAngleRad: 0 });
    mountShortcuts();

    fireKeyDown("ArrowLeft");

    expect(useEngineStore.getState().crankAngleRad).toBeCloseTo(
      (359 * Math.PI) / 180,
      10,
    );
  });

  it("does nothing when an arrow key is held on a select element", () => {
    mountShortcuts();
    const select = document.createElement("select");
    document.body.appendChild(select);

    fireKeyDown("ArrowRight", {}, select);

    expect(useEngineStore.getState().crankAngleRad).toBe(
      DEFAULT_ANIMATION.crankAngleRad,
    );
  });

  it("does nothing when an arrow key is held on a textarea", () => {
    mountShortcuts();
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    fireKeyDown("ArrowLeft", {}, textarea);

    expect(useEngineStore.getState().crankAngleRad).toBe(
      DEFAULT_ANIMATION.crankAngleRad,
    );
  });

  it("does nothing when an arrow key is held with a modifier other than Shift", () => {
    mountShortcuts();
    fireKeyDown("ArrowRight", { altKey: true });
    expect(useEngineStore.getState().crankAngleRad).toBe(
      DEFAULT_ANIMATION.crankAngleRad,
    );
  });
});

/** [0, 2π) wrap of a degree offset from 0, expressed back in radians. */
function normalizeToWrapped(deg: number): number {
  const wrappedDeg = ((deg % 360) + 360) % 360;
  return (wrappedDeg * Math.PI) / 180;
}
