import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnimationControls } from "./AnimationControls";
import { useEngineStore } from "../../state/engineStore";
import {
  DEFAULT_ANIMATION,
  DEFAULT_CONFIG,
  DEFAULT_PLAYBACK_SPEED,
  PLAYBACK_SPEED_LABELS,
  PLAYBACK_SPEEDS,
} from "../../engine/constants";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    comparisonConfig: null,
    preferences: { displayUnit: "mm", showLabels: true, showCycle: false },
    rpm: DEFAULT_ANIMATION.rpm,
    comparisonRpm: DEFAULT_ANIMATION.rpm,
    rpmLinked: true,
    playbackSpeed: DEFAULT_PLAYBACK_SPEED,
    isPlaying: false,
    crankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
    comparisonCrankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
  });
}

function enableComparisonWith(
  config = { ...DEFAULT_CONFIG, redlineRpm: 8900 },
) {
  useEngineStore.getState().enableComparison(config);
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

  it("commits the selected playback-speed multiplier", async () => {
    const user = userEvent.setup();
    render(<AnimationControls />);

    expect(useEngineStore.getState().playbackSpeed).toBe(
      DEFAULT_PLAYBACK_SPEED,
    );

    await user.click(screen.getByLabelText("1/2×"));
    expect(useEngineStore.getState().playbackSpeed).toBe(0.5);

    await user.click(screen.getByLabelText("1×"));
    expect(useEngineStore.getState().playbackSpeed).toBe(1);

    await user.click(screen.getByLabelText("1/50×"));
    expect(useEngineStore.getState().playbackSpeed).toBe(0.02);
  });

  it("labels the playback-speed control with a hint that it only affects rendering", () => {
    render(<AnimationControls />);

    expect(
      screen.getByText(/slows rendering only/i, { exact: false }),
    ).toBeInTheDocument();
  });

  it("renders exactly one radio per PLAYBACK_SPEEDS entry, labeled from PLAYBACK_SPEED_LABELS", () => {
    render(<AnimationControls />);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(PLAYBACK_SPEEDS.length);

    for (const speed of PLAYBACK_SPEEDS) {
      expect(
        screen.getByLabelText(PLAYBACK_SPEED_LABELS[speed]),
      ).toBeInTheDocument();
    }
  });

  it("commits the slowest playback speed (added for high-revving engines)", async () => {
    const user = userEvent.setup();
    render(<AnimationControls />);

    const slowest = PLAYBACK_SPEEDS[PLAYBACK_SPEEDS.length - 1];
    await user.click(screen.getByLabelText(PLAYBACK_SPEED_LABELS[slowest]));

    expect(useEngineStore.getState().playbackSpeed).toBe(slowest);
  });

  it('shows one "At redline" button next to the single rpm field when not comparing', () => {
    render(<AnimationControls />);

    expect(
      screen.queryByLabelText(/link engine speeds/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: `At redline (${DEFAULT_CONFIG.redlineRpm.toLocaleString("en-US")})`,
      }),
    ).toBeInTheDocument();
  });

  it("sets rpm to the engine's own redline when not comparing", async () => {
    const user = userEvent.setup();
    render(<AnimationControls />);

    await user.click(
      screen.getByRole("button", {
        name: `At redline (${DEFAULT_CONFIG.redlineRpm.toLocaleString("en-US")})`,
      }),
    );

    expect(useEngineStore.getState().rpm).toBe(DEFAULT_CONFIG.redlineRpm);
  });

  describe("comparison mode: per-engine speed", () => {
    it("shows the link checkbox (checked by default) and a single shared rpm field", () => {
      enableComparisonWith();
      render(<AnimationControls />);

      const linkCheckbox = screen.getByLabelText(/link engine speeds/i);
      expect(linkCheckbox).toBeChecked();
      expect(
        screen.getByLabelText(/engine speed \(rpm\).*both engines/i),
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText(/engine a speed/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(/engine b speed/i),
      ).not.toBeInTheDocument();
    });

    it("unlinking reveals two independent rpm inputs, each committing to its own store field", async () => {
      const comparisonConfig = { ...DEFAULT_CONFIG, redlineRpm: 8900 };
      enableComparisonWith(comparisonConfig);
      const user = userEvent.setup();
      render(<AnimationControls />);

      await user.click(screen.getByLabelText(/link engine speeds/i));

      const rpmA = screen.getByLabelText(/engine a speed \(rpm\)/i);
      const rpmB = screen.getByLabelText(/engine b speed \(rpm\)/i);

      await user.clear(rpmA);
      await user.type(rpmA, "3000");
      expect(useEngineStore.getState().rpm).toBe(3000);
      // Engine B's own field is untouched by editing A's.
      expect(useEngineStore.getState().comparisonRpm).toBe(
        DEFAULT_ANIMATION.rpm,
      );

      await user.clear(rpmB);
      await user.type(rpmB, "5000");
      expect(useEngineStore.getState().comparisonRpm).toBe(5000);
      // And editing B's doesn't touch A's, which stays at what was just set.
      expect(useEngineStore.getState().rpm).toBe(3000);
    });

    it("re-linking hides the two inputs and re-syncs engine B's angle onto engine A's", async () => {
      enableComparisonWith();
      useEngineStore.setState({
        rpmLinked: false,
        crankAngleRad: 1.0,
        comparisonCrankAngleRad: 2.5,
      });
      const user = userEvent.setup();
      render(<AnimationControls />);

      expect(useEngineStore.getState().comparisonCrankAngleRad).not.toBeCloseTo(
        useEngineStore.getState().crankAngleRad,
        9,
      );

      await user.click(screen.getByLabelText(/link engine speeds/i));

      // setRpmLinked(true)'s documented effect: engine B's angle snaps back
      // onto engine A's immediately, and the per-engine fields disappear.
      expect(useEngineStore.getState().rpmLinked).toBe(true);
      expect(useEngineStore.getState().comparisonCrankAngleRad).toBe(
        useEngineStore.getState().crankAngleRad,
      );
      expect(
        screen.queryByLabelText(/engine a speed/i),
      ).not.toBeInTheDocument();
      expect(
        screen.getByLabelText(/engine speed \(rpm\).*both engines/i),
      ).toBeInTheDocument();
    });

    it("rejects an invalid rpm for one engine without touching the other engine's rpm", async () => {
      enableComparisonWith();
      useEngineStore.setState({ rpmLinked: false });
      render(<AnimationControls />);

      const rpmA = screen.getByLabelText(/engine a speed \(rpm\)/i);
      const rpmBBefore = useEngineStore.getState().comparisonRpm;
      fireEvent.change(rpmA, { target: { value: "99999" } });

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(useEngineStore.getState().rpm).toBe(DEFAULT_ANIMATION.rpm);
      expect(useEngineStore.getState().comparisonRpm).toBe(rpmBBefore);
    });

    it("sets each engine's rpm to its own redline while unlinked", async () => {
      const comparisonConfig = { ...DEFAULT_CONFIG, redlineRpm: 8900 };
      enableComparisonWith(comparisonConfig);
      useEngineStore.setState({ rpmLinked: false });
      const user = userEvent.setup();
      render(<AnimationControls />);

      await user.click(
        screen.getByRole("button", {
          name: `At redline (${DEFAULT_CONFIG.redlineRpm.toLocaleString("en-US")})`,
        }),
      );
      expect(useEngineStore.getState().rpm).toBe(DEFAULT_CONFIG.redlineRpm);
      expect(useEngineStore.getState().comparisonRpm).toBe(
        DEFAULT_ANIMATION.rpm,
      );

      await user.click(
        screen.getByRole("button", { name: "At redline (8,900)" }),
      );
      expect(useEngineStore.getState().comparisonRpm).toBe(8900);
      // Engine A's rpm, just set above, is untouched by engine B's button.
      expect(useEngineStore.getState().rpm).toBe(DEFAULT_CONFIG.redlineRpm);
    });

    it("while linked, engine B's redline button sets the one shared rpm", async () => {
      const comparisonConfig = { ...DEFAULT_CONFIG, redlineRpm: 8900 };
      enableComparisonWith(comparisonConfig);
      const user = userEvent.setup();
      render(<AnimationControls />);

      await user.click(
        screen.getByRole("button", { name: "Engine B at redline (8,900)" }),
      );

      expect(useEngineStore.getState().rpm).toBe(8900);
      expect(useEngineStore.getState().rpmLinked).toBe(true);
    });
  });
});
