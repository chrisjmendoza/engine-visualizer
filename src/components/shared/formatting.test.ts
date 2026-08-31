import { describe, expect, it } from "vitest";
import {
  classifyBoreStrokeRatio,
  formatRounded,
  formatRpm,
  formatTrimmed,
} from "./formatting";

describe("formatRounded", () => {
  it("rounds to the given number of decimals", () => {
    expect(formatRounded(1.2345, 2)).toBe("1.23");
    expect(formatRounded(1.236, 2)).toBe("1.24");
  });

  it("returns an em dash for non-finite values", () => {
    expect(formatRounded(Number.NaN, 2)).toBe("—");
    expect(formatRounded(Number.POSITIVE_INFINITY, 2)).toBe("—");
  });

  it("never renders a signed zero", () => {
    expect(formatRounded(-0.0001, 2)).toBe("0.00");
  });
});

describe("formatTrimmed", () => {
  it("trims trailing zeros", () => {
    expect(formatTrimmed(86, 3)).toBe("86");
    expect(formatTrimmed(3.5, 3)).toBe("3.5");
  });

  it("keeps significant trailing digits that are not the decimal padding", () => {
    expect(formatTrimmed(1000, 2)).toBe("1000");
  });
});

describe("formatRpm", () => {
  it("adds thousands separators and the rpm suffix", () => {
    expect(formatRpm(8900)).toBe("8,900 rpm");
    expect(formatRpm(600)).toBe("600 rpm");
  });

  it("rounds to the nearest whole rpm", () => {
    expect(formatRpm(7000.4)).toBe("7,000 rpm");
    expect(formatRpm(7000.6)).toBe("7,001 rpm");
  });

  it("returns an em dash for non-finite values", () => {
    expect(formatRpm(Number.NaN)).toBe("—");
  });
});

describe("classifyBoreStrokeRatio", () => {
  it("classifies a comfortably oversquare ratio", () => {
    expect(classifyBoreStrokeRatio(1.011)).toBe("oversquare");
  });

  it("classifies a comfortably undersquare ratio", () => {
    expect(classifyBoreStrokeRatio(0.989)).toBe("undersquare");
  });

  it("classifies exactly 1:1 as square", () => {
    expect(classifyBoreStrokeRatio(1.0)).toBe("square");
  });

  it("classifies ratios inside the tolerance band as square", () => {
    expect(classifyBoreStrokeRatio(0.995)).toBe("square");
    expect(classifyBoreStrokeRatio(1.005)).toBe("square");
  });

  it("treats the tolerance boundary itself as square (strict inequality)", () => {
    expect(classifyBoreStrokeRatio(1.01)).toBe("square");
    expect(classifyBoreStrokeRatio(0.99)).toBe("square");
  });
});
