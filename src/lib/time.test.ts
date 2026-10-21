// @vitest-environment node
import { describe, expect, it } from "vitest";
import { clamp, formatClock, formatDuration, roundMs } from "./time.ts";

describe("roundMs", () => {
  it.each([
    [1.23449, 1.234],
    [1.2345, 1.235],
    [0, 0],
    [3600.0004, 3600]
  ])("rounds %s seconds to %s", (input, expected) => {
    expect(roundMs(input)).toBe(expected);
  });
});

describe("clamp", () => {
  it.each([
    [-1, 0],
    [5, 5],
    [11, 10]
  ])("clamps %s into 0..10 as %s", (value, expected) => {
    expect(clamp(value, 0, 10)).toBe(expected);
  });
});

describe("formatClock", () => {
  it.each([
    [0, "0:00.000"],
    [5.5, "0:05.500"],
    [65.25, "1:05.250"],
    [3725.125, "1:02:05.125"]
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected);
  });

  it("carries rounding into the next minute instead of showing 60 seconds", () => {
    expect(formatClock(59.9996)).toBe("1:00.000");
  });

  it("shows unknown durations as --:-- instead of zero", () => {
    expect(formatClock(Number.NaN)).toBe("--:--");
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe("--:--");
  });

  it("treats negative positions as zero", () => {
    expect(formatClock(-3)).toBe("0:00.000");
  });

  it("drops the fraction when asked for whole seconds", () => {
    expect(formatClock(65.7, 0)).toBe("1:06");
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0.00 s"],
    [1.5, "1.50 s"],
    [59.994, "59.99 s"],
    [59.996, "1 m 00.0 s"],
    [125.34, "2 m 05.3 s"],
    [3720, "1 h 02 m"]
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it("shows -- for an unknown duration", () => {
    expect(formatDuration(Number.NaN)).toBe("--");
  });
});
