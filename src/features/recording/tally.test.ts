// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Episode } from "./recorder.ts";
import { findOverlaps, liveElapsed, summarize } from "./tally.ts";

function ep(
  id: string,
  behaviorId: string,
  start: number,
  end: number
): Episode {
  return { id, behaviorId, start, end };
}

describe("summarize", () => {
  it("counts, totals and averages episodes per behavior", () => {
    const episodes = [
      ep("1", "a", 0, 2),
      ep("2", "a", 10, 11),
      ep("3", "b", 5, 5.5)
    ];
    const tally = summarize(episodes, ["a", "b"], 100);

    expect(tally.get("a")).toEqual({
      count: 2,
      total: 3,
      mean: 1.5,
      percentOfVideo: 3
    });
    expect(tally.get("b")).toEqual({
      count: 1,
      total: 0.5,
      mean: 0.5,
      percentOfVideo: 0.5
    });
  });

  it("lists a behavior with no episodes as zero, with no mean", () => {
    expect(summarize([], ["a"], 60).get("a")).toEqual({
      count: 0,
      total: 0,
      mean: null,
      percentOfVideo: 0
    });
  });

  it("counts point events with a zero duration", () => {
    const tally = summarize(
      [ep("1", "a", 4, 4), ep("2", "a", 9, 9)],
      ["a"],
      60
    );
    expect(tally.get("a")).toEqual({
      count: 2,
      total: 0,
      mean: 0,
      percentOfVideo: 0
    });
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY, -5])(
    "leaves the percentage unknown when the duration is %s",
    (duration) => {
      const tally = summarize([ep("1", "a", 0, 2)], ["a"], duration);
      expect(tally.get("a")?.percentOfVideo).toBeNull();
    }
  );

  it("skips episodes whose behavior is not listed", () => {
    const tally = summarize([ep("1", "gone", 0, 2)], ["a"], 60);
    expect([...tally.keys()]).toEqual(["a"]);
    expect(tally.get("a")?.count).toBe(0);
  });
});

describe("liveElapsed", () => {
  it.each([
    [2, 3.5, 1.5],
    [5, 3, 2],
    [2, Number.NaN, 0]
  ])("from %s at %s is %s seconds", (start, now, expected) => {
    expect(liveElapsed(start, now)).toBe(expected);
  });
});

describe("findOverlaps", () => {
  it("flags both episodes of one behavior that overlap", () => {
    const episodes = [
      ep("1", "a", 0, 5),
      ep("2", "a", 4, 6),
      ep("3", "a", 7, 8)
    ];
    expect([...findOverlaps(episodes)].sort()).toEqual(["1", "2"]);
  });

  it("does not flag overlaps between different behaviors", () => {
    expect(findOverlaps([ep("1", "a", 0, 5), ep("2", "b", 1, 2)]).size).toBe(0);
  });

  it("does not flag episodes that only touch", () => {
    expect(findOverlaps([ep("1", "a", 0, 5), ep("2", "a", 5, 6)]).size).toBe(0);
  });

  it("flags an episode nested inside a long one after a shorter one ends", () => {
    const episodes = [
      ep("1", "a", 0, 100),
      ep("2", "a", 10, 20),
      ep("3", "a", 50, 60)
    ];
    expect([...findOverlaps(episodes)].sort()).toEqual(["1", "2", "3"]);
  });
});
