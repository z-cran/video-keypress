// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Episode } from "../recording/recorder.ts";
import {
  hitTest,
  laneAt,
  laneTop,
  layoutBars,
  makeScale,
  MIN_BAR_PX,
  niceTicks,
  timelineSpan,
  timeToX,
  xToTime
} from "./timelineScale.ts";

function ep(
  id: string,
  behaviorId: string,
  start: number,
  end: number
): Episode {
  return { id, behaviorId, start, end };
}

describe("makeScale", () => {
  it("fits the whole video into the container at zoom 1", () => {
    expect(makeScale(100, 1000, 1)).toEqual({
      span: 100,
      pxPerSec: 10,
      width: 1000
    });
  });

  it("widens the drawing when zoomed in", () => {
    expect(makeScale(100, 1000, 4)).toEqual({
      span: 100,
      pxPerSec: 40,
      width: 4000
    });
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    "spans one second when the duration is %s",
    (duration) => {
      expect(makeScale(duration, 500, 1).span).toBe(1);
    }
  );

  it("does not divide by zero before the container is measured", () => {
    expect(makeScale(60, 0, 1).pxPerSec).toBeCloseTo(1 / 60);
  });
});

describe("timeToX and xToTime", () => {
  const scale = makeScale(120, 1200, 2);

  it.each([0, 7.25, 60, 120])("round-trips %s seconds", (t) => {
    expect(xToTime(scale, timeToX(scale, t))).toBeCloseTo(t, 9);
  });

  it.each([
    [-50, 0],
    [999_999, 120]
  ])("clamps x=%s to %s seconds", (x, t) => {
    expect(xToTime(scale, x)).toBe(t);
  });
});

describe("niceTicks", () => {
  it("labels a 5 second clip in a 400 px timeline every second", () => {
    // 80 px per second: 1 s is the first step that is 80 px wide.
    expect(niceTicks(makeScale(5, 400, 1))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("labels the same clip every half second when there is room", () => {
    expect(niceTicks(makeScale(5, 1000, 1))[1]).toBe(0.5);
  });

  it("keeps a 2 hour video in 1000 px to readable 10 minute steps", () => {
    const ticks = niceTicks(makeScale(7200, 1000, 1));
    expect(ticks[1]).toBe(600);
    expect(ticks.at(-1)).toBe(7200);
  });

  it("puts ticks at least the minimum gap apart at every zoom", () => {
    for (const zoom of [1, 3, 17, 128]) {
      const scale = makeScale(600, 900, zoom);
      const [a, b] = niceTicks(scale);
      expect((b! - a!) * scale.pxPerSec).toBeGreaterThanOrEqual(80);
    }
  });

  it("does not accumulate floating point error on 0.1 s steps", () => {
    const ticks = niceTicks(makeScale(0.5, 4000, 1));
    expect(ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
  });
});

describe("laneAt", () => {
  it.each([
    [0, -1],
    [laneTop(0) + 1, 0],
    [laneTop(1) - 1, 0],
    [laneTop(2) + 5, 2],
    [laneTop(3) + 5, -1]
  ])("puts y=%s in lane %s of 3", (y, lane) => {
    expect(laneAt(y, 3)).toBe(lane);
  });
});

describe("layoutBars", () => {
  const scale = makeScale(100, 1000, 1);
  const lanes = new Map([
    ["a", 0],
    ["b", 1]
  ]);

  it("places bars by time and lane", () => {
    const [bar] = layoutBars([ep("1", "b", 10, 12)], lanes, scale);
    expect(bar).toMatchObject({ lane: 1, x: 100, width: 20 });
  });

  it("draws a point event at the minimum width without changing its times", () => {
    const point = ep("1", "a", 5, 5);
    const [bar] = layoutBars([point], lanes, scale);
    expect(bar?.width).toBe(MIN_BAR_PX);
    expect(point).toEqual(ep("1", "a", 5, 5));
  });

  it("skips episodes whose behavior has no lane", () => {
    expect(layoutBars([ep("1", "gone", 1, 2)], lanes, scale)).toEqual([]);
  });
});

describe("hitTest", () => {
  const scale = makeScale(100, 1000, 1);
  const lanes = new Map([["a", 0]]);
  const bars = layoutBars(
    [ep("1", "a", 10, 11), ep("2", "a", 11.5, 11.5)],
    lanes,
    scale
  );

  it("finds the bar under the pointer", () => {
    expect(hitTest(bars, 105, 0)?.episode.id).toBe("1");
  });

  it("finds a thin bar within the tolerance", () => {
    expect(hitTest(bars, 119, 0, 6)?.episode.id).toBe("2");
  });

  it("returns nothing in an empty stretch", () => {
    expect(hitTest(bars, 300, 0)).toBeNull();
  });

  it("returns nothing in another lane", () => {
    expect(hitTest(bars, 105, 1)).toBeNull();
  });

  it("prefers the selected bar when two are equally close", () => {
    const overlapping = layoutBars(
      [ep("x", "a", 10, 20), ep("y", "a", 10, 20)],
      lanes,
      scale
    );
    expect(hitTest(overlapping, 150, 0, 6, "y")?.episode.id).toBe("y");
  });
});

describe("timelineSpan", () => {
  it("uses the duration when known", () => {
    expect(timelineSpan(90, [ep("1", "a", 0, 200)], 10)).toBe(90);
  });

  it("covers recorded episodes and the playhead while the duration is unknown", () => {
    expect(
      timelineSpan(Number.POSITIVE_INFINITY, [ep("1", "a", 0, 42)], 30)
    ).toBe(42);
    expect(timelineSpan(Number.NaN, [], 75)).toBe(75);
  });
});
