import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EngineComparisonLayout } from "./EngineComparisonLayout";

afterEach(cleanup);

describe("EngineComparisonLayout", () => {
  it("renders its children and carries the comparison-layout marker attribute", () => {
    render(
      <EngineComparisonLayout>
        <div data-testid="a">Engine A</div>
        <div data-testid="b">Engine B</div>
      </EngineComparisonLayout>,
    );

    const a = screen.getByTestId("a");
    const b = screen.getByTestId("b");
    expect(a).toBeInTheDocument();
    expect(b).toBeInTheDocument();

    const wrapper = a.parentElement;
    expect(wrapper).toBe(b.parentElement);
    expect(wrapper).toHaveAttribute("data-comparison-layout");
  });
});
