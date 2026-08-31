import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareLinkButton } from "./ShareLinkButton";
import { useEngineStore } from "../../state/engineStore";
import {
  DEFAULT_ANIMATION,
  DEFAULT_CONFIG,
  DEFAULT_PLAYBACK_SPEED,
} from "../../engine/constants";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    comparisonConfig: null,
    preferences: {
      displayUnit: "mm",
      showLabels: true,
      showCycle: false,
      uprightFlatEngines: false,
    },
    rpm: DEFAULT_ANIMATION.rpm,
    playbackSpeed: DEFAULT_PLAYBACK_SPEED,
    isPlaying: true,
    crankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
  });
}

/** The link `buildShareUrl()` should produce for the freshly reset store. */
function expectedDefaultUrl(): string {
  return `${window.location.origin}${window.location.pathname}?a=86-86-143-10.5-7000`;
}

/**
 * `userEvent.setup()` installs its own virtual `navigator.clipboard` stub
 * (to back `user.copy()`/`user.paste()`), unconditionally replacing
 * whatever was there before — so a test's own clipboard mock must be
 * installed *after* `userEvent.setup()`, not before it, or setup() just
 * overwrites it.
 */
function mockClipboard(
  writeText: ((text: string) => Promise<void>) | undefined,
) {
  Object.defineProperty(navigator, "clipboard", {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

beforeEach(() => {
  resetStore();
  window.history.pushState({}, "", "/");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ShareLinkButton", () => {
  it("copies the current share URL via the Clipboard API and confirms it", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);

    render(<ShareLinkButton />);
    await user.click(screen.getByRole("button", { name: /copy link/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(expectedDefaultUrl());
    expect(await screen.findByText(/link copied/i)).toBeInTheDocument();
  });

  it("builds the link from live store state, not the address bar", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    // The address bar hasn't caught up yet (no debounced sync has run in
    // this test), but the copied link must still reflect the live rpm.
    useEngineStore.setState({ rpm: 4200 });

    render(<ShareLinkButton />);
    await user.click(screen.getByRole("button", { name: /copy link/i }));

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}${window.location.pathname}?a=86-86-143-10.5-7000&rpm=4200`,
    );
  });

  it("reverts the confirmation after a couple of seconds", async () => {
    // fireEvent (not user.click) here: userEvent's internal event-simulation
    // waits on real-time-flavored promises that don't resolve under fake
    // timers, even with `advanceTimers` configured, and the test hangs.
    // fireEvent just dispatches the click synchronously; flushing the
    // microtask queue afterward (the empty async act()) is enough to let
    // the awaited `writeText()` and its `setStatus("copied")` land, since
    // fake timers only affect macrotasks (setTimeout), not microtasks.
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    vi.useFakeTimers();

    render(<ShareLinkButton />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    });

    expect(screen.getByText(/link copied/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(screen.queryByText(/link copied/i)).not.toBeInTheDocument();
  });

  it("falls back to a selectable read-only input when the Clipboard API is unavailable", async () => {
    const user = userEvent.setup();
    mockClipboard(undefined);

    render(<ShareLinkButton />);
    await user.click(screen.getByRole("button", { name: /copy link/i }));

    const fallbackInput = await screen.findByDisplayValue(expectedDefaultUrl());
    expect(fallbackInput).toHaveAttribute("readonly");
    // No misleading "copied" confirmation when nothing was actually copied.
    expect(screen.queryByText(/link copied/i)).not.toBeInTheDocument();
  });

  it("falls back when navigator.clipboard.writeText rejects (e.g. permission denied)", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    mockClipboard(writeText);

    render(<ShareLinkButton />);
    await user.click(screen.getByRole("button", { name: /copy link/i }));

    expect(
      await screen.findByLabelText(/copy this link manually/i),
    ).toHaveValue(expectedDefaultUrl());
  });
});
