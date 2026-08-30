import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnimationControls } from "./AnimationControls";
import { useEngineStore } from "../../state/engineStore";
import { DEFAULT_ANIMATION, DEFAULT_CONFIG } from "../../engine/constants";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    preferences: { displayUnit: "mm", showLabels: true },
    rpm: DEFAULT_ANIMATION.rpm,
    isPlaying: false,
    crankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
  });
}

beforeEach(() => {
  resetStore();
});

// This project's Vitest config does not enable `globals`, so
// @testing-library/react's automatic afterEach(cleanup) never registers;
// unmount explicitly so each test starts from an empty document.
afterEach(cleanup);

describe("AnimationControls", () => {
  it("toggles play/pause store state", async () => {
    const user = userEvent.setup();
    render(<AnimationControls />);

    expect(useEngineStore.getState().isPlaying).toBe(false);
    const button = screen.getByRole("button", { name: /play/i });
    await user.click(button);

    expect(useEngineStore.getState().isPlaying).toBe(true);
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /pause/i }));
    expect(useEngineStore.getState().isPlaying).toBe(false);
  });

  it("scrubbing the crank-angle slider sets the angle and pauses playback", () => {
    useEngineStore.setState({ isPlaying: true });
    render(<AnimationControls />);

    const slider = screen.getByLabelText(/crank angle/i);
    fireEvent.change(slider, { target: { value: "180" } });

    const state = useEngineStore.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.crankAngleRad).toBeCloseTo(Math.PI, 5);
  });

  it("updates the store RPM when a valid value is entered", async () => {
    const user = userEvent.setup();
    render(<AnimationControls />);

    const rpmInput = screen.getByLabelText(/engine speed/i);
    await user.clear(rpmInput);
    await user.type(rpmInput, "3000");

    expect(useEngineStore.getState().rpm).toBe(3000);
  });

  it("rejects RPM above the practical maximum without updating the store", async () => {
    render(<AnimationControls />);

    const rpmInput = screen.getByLabelText(/engine speed/i);
    const rpmBefore = useEngineStore.getState().rpm;
    // A single change event (rather than keystroke-by-keystroke typing) so
    // no valid intermediate value gets committed along the way.
    fireEvent.change(rpmInput, { target: { value: "15000" } });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(useEngineStore.getState().rpm).toBe(rpmBefore);
  });

  it("changing RPM does not reset the crank angle", async () => {
    useEngineStore.setState({ crankAngleRad: 1.2345 });
    const user = userEvent.setup();
    render(<AnimationControls />);

    const rpmInput = screen.getByLabelText(/engine speed/i);
    await user.clear(rpmInput);
    await user.type(rpmInput, "2000");

    expect(useEngineStore.getState().crankAngleRad).toBe(1.2345);
  });
});
