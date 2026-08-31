import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AboutDialog } from "./AboutDialog";

// This project's Vitest config does not enable `globals`, so
// @testing-library/react's automatic afterEach(cleanup) never registers;
// unmount explicitly so each test starts from an empty document.
afterEach(cleanup);

describe("AboutDialog", () => {
  it("does not render the dialog until the trigger is activated", () => {
    render(<AboutDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About" })).toBeInTheDocument();
  });

  it("opens the dialog when the About trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<AboutDialog />);
    await user.click(screen.getByRole("button", { name: "About" }));
    expect(
      screen.getByRole("dialog", { name: /about engine visualizer/i }),
    ).toBeInTheDocument();
  });

  it("links to the GitHub repository", async () => {
    const user = userEvent.setup();
    render(<AboutDialog />);
    await user.click(screen.getByRole("button", { name: "About" }));
    const link = screen.getByRole("link", {
      name: /view the source on github/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/chrisjmendoza/engine-visualizer",
    );
  });

  it("closes when the close button is clicked and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<AboutDialog />);
    const trigger = screen.getByRole("button", { name: "About" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<AboutDialog />);
    const trigger = screen.getByRole("button", { name: "About" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes when the overlay backdrop is clicked", async () => {
    const user = userEvent.setup();
    render(<AboutDialog />);
    await user.click(screen.getByRole("button", { name: "About" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByTestId("about-overlay"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not close when clicking inside the dialog panel", async () => {
    const user = userEvent.setup();
    render(<AboutDialog />);
    await user.click(screen.getByRole("button", { name: "About" }));
    const dialog = screen.getByRole("dialog");
    await user.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("moves focus into the dialog panel on open", async () => {
    const user = userEvent.setup();
    render(<AboutDialog />);
    await user.click(screen.getByRole("button", { name: "About" }));
    // The first focusable element inside the panel is the close button.
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });
});
