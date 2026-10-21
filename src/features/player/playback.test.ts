// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  mediaErrorMessage,
  RATES,
  seekTarget,
  snapRate,
  stepRate,
  videoFileProblem
} from "./playback.ts";

describe("RATES", () => {
  it("offers every 0.25 step from 0.25 to 2", () => {
    expect(RATES).toEqual([0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
  });
});

describe("stepRate", () => {
  it.each([
    [1, 1, 1.25],
    [1, -1, 0.75],
    [1.75, 1, 2],
    [0.5, -1, 0.25]
  ])("steps %s by %s to %s", (rate, direction, expected) => {
    expect(stepRate(rate, direction as 1 | -1)).toBe(expected);
  });

  it.each([
    [2, 1, 2],
    [0.25, -1, 0.25]
  ])(
    "stays at the limit %s when stepping %s past it",
    (rate, dir, expected) => {
      expect(stepRate(rate, dir as 1 | -1)).toBe(expected);
    }
  );

  it.each([
    [1.1, 1, 1.25],
    [1.1, -1, 1]
  ])(
    "moves an off-grid %s to the next grid value in direction %s",
    (rate, dir, expected) => {
      expect(stepRate(rate, dir as 1 | -1)).toBe(expected);
    }
  );

  it("starts from 1x when the current rate is not a number", () => {
    expect(stepRate(Number.NaN, 1)).toBe(1.25);
  });
});

describe("snapRate", () => {
  it.each([
    [1.3, 1.25],
    [0.1, 0.25],
    [16, 2],
    ["1.5", 1],
    [null, 1],
    [Number.NaN, 1]
  ])("snaps a stored %s to %s", (stored, expected) => {
    expect(snapRate(stored)).toBe(expected);
  });
});

describe("videoFileProblem", () => {
  it.each([
    ["video/mp4", "mouse.mp4"],
    ["video/webm", "mouse.webm"],
    ["", "mouse.mkv"],
    ["audio/wav", "cage.wav"]
  ])("accepts a %j file", (type, name) => {
    expect(videoFileProblem([{ name, type }])).toBeNull();
  });

  it("asks for one video when several files are dropped", () => {
    const files = [
      { name: "a.mp4", type: "video/mp4" },
      { name: "b.mp4", type: "video/mp4" }
    ];
    expect(videoFileProblem(files)).toBe("Open one video at a time.");
  });

  it.each([
    ["image/png", "frame.png"],
    ["application/json", "scores.json"]
  ])("turns away a %s file", (type, name) => {
    expect(videoFileProblem([{ name, type }])).toBe(
      "That file does not look like a video. Choose an MP4 or WebM file."
    );
  });

  it("says nothing was selected for an empty list", () => {
    expect(videoFileProblem([])).toBe("No file was selected.");
  });
});

describe("mediaErrorMessage", () => {
  it("suggests converting to MP4 when the browser cannot decode the file", () => {
    expect(mediaErrorMessage(3)).toBe(
      "This browser could not decode the video. Converting it to MP4 (H.264) usually helps."
    );
  });

  it.each([0, 99, -1])(
    "falls back to a general message for code %s",
    (code) => {
      expect(mediaErrorMessage(code)).toBe(
        "The video did not load. Try another file or another browser."
      );
    }
  );
});

describe("seekTarget", () => {
  it("moves by the delta inside the video", () => {
    expect(seekTarget(10, 5, 60)).toBe(15);
  });

  it.each([
    [2, -5, 60, 0],
    [58, 5, 60, 60]
  ])(
    "clamps %s + %s to the video bounds (duration %s)",
    (current, delta, duration, expected) => {
      expect(seekTarget(current, delta, duration)).toBe(expected);
    }
  );

  it("does not cap the seek when the duration is still unknown", () => {
    expect(seekTarget(10, 5, Number.POSITIVE_INFINITY)).toBe(15);
  });

  it("seeks from the start when the current time is not a number", () => {
    expect(seekTarget(Number.NaN, 5, 60)).toBe(5);
  });
});
