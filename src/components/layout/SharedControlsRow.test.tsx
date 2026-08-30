import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SharedControlsRow } from "./SharedControlsRow";

afterEach(cleanup);

describe("SharedControlsRow", () => {
  it("renders its children in order", () => {
    render(
      <SharedControlsRow>
        <div data-testid="first">Animation</div>
        <div data-testid="second">Units</div>
      </SharedControlsRow>,
    );

    const first = screen.getByTestId("first");
    const second = screen.getByTestId("second");
    expect(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
