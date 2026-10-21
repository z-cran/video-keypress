// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  closeEpisode,
  commitAll,
  insertEpisode,
  press,
  release,
  releaseWhere,
  type Active,
  type Episode
} from "./recorder.ts";

function counter() {
  let n = 0;
  return () => `e${++n}`;
}

const playing = { ready: true, paused: false };
const paused = { ready: true, paused: true };
const hold = { id: "b1", mode: "hold" } as const;
const toggle = { id: "b2", mode: "toggle" } as const;

describe("hold mode", () => {
  it("records one episode from keydown to keyup", () => {
    const ids = counter();
    const down = press({}, hold, "key", 2, playing, ids);
    const up = release(down.active, "b1", "key", 3.5, ids);

    expect(up.committed).toEqual({
      id: "e1",
      behaviorId: "b1",
      start: 2,
      end: 3.5
    });
    expect(up.active).toEqual({});
  });

  it("does not start while the video is paused", () => {
    const step = press({}, hold, "key", 2, paused, counter());
    expect(step.blocked).toBe("paused-hold");
    expect(step.active).toEqual({});
  });

  it.each([
    ["no metadata yet", { ready: false, paused: false }, 2],
    ["a NaN time", playing, Number.NaN]
  ])("does not start with %s", (_label, media, t) => {
    const step = press({}, hold, "key", t, media, counter());
    expect(step.blocked).toBe("no-video");
    expect(step.active).toEqual({});
  });

  it("commits once, when the last of the key and the pointer lets go", () => {
    const ids = counter();
    let active: Active = press({}, hold, "key", 1, playing, ids).active;
    active = press(active, hold, "pointer:7", 1.5, playing, ids).active;

    const keyUp = release(active, "b1", "key", 2, ids);
    expect(keyUp.committed).toBeNull();

    const pointerUp = release(keyUp.active, "b1", "pointer:7", 4, ids);
    expect(pointerUp.committed).toEqual({
      id: "e1",
      behaviorId: "b1",
      start: 1,
      end: 4
    });
  });

  it("ignores a second press by the same holder", () => {
    const first = press({}, hold, "key", 1, playing, counter());
    const again = press(first.active, hold, "key", 2, playing, counter());
    expect(again.active).toBe(first.active);
  });

  it("ignores a release from a holder that never pressed", () => {
    const down = press({}, hold, "key", 1, playing, counter());
    const up = release(down.active, "b1", "pointer:3", 2, counter());
    expect(up.committed).toBeNull();
    expect(up.active).toBe(down.active);
  });

  it("keeps a hold going after the video is paused mid-episode", () => {
    const ids = counter();
    const down = press({}, hold, "key", 1, playing, ids);
    const up = release(down.active, "b1", "key", 2.25, ids);
    expect(up.committed?.end).toBe(2.25);
  });

  it("keeps a tap as a zero-length point event", () => {
    const ids = counter();
    const down = press({}, hold, "key", 5, playing, ids);
    const up = release(down.active, "b1", "key", 5, ids);
    expect(up.committed).toEqual({
      id: "e1",
      behaviorId: "b1",
      start: 5,
      end: 5
    });
  });
});

describe("toggle mode", () => {
  it("starts while paused and ends on the next press", () => {
    const ids = counter();
    const on = press({}, toggle, "key", 10, paused, ids);
    const off = press(on.active, toggle, "key", 10.1, paused, ids);

    expect(on.blocked).toBeNull();
    expect(off.committed).toEqual({
      id: "e1",
      behaviorId: "b2",
      start: 10,
      end: 10.1
    });
    expect(off.active).toEqual({});
  });

  it("ignores key releases so the episode keeps running", () => {
    const on = press({}, toggle, "key", 10, paused, counter());
    const up = release(on.active, "b2", "key", 11, counter());
    expect(up.committed).toBeNull();
    expect(up.active).toBe(on.active);
  });

  it("can end even when the video is not ready any more", () => {
    const ids = counter();
    const on = press({}, toggle, "key", 10, paused, ids);
    const off = press(
      on.active,
      toggle,
      "key",
      12,
      { ready: false, paused: true },
      ids
    );
    expect(off.committed?.end).toBe(12);
  });
});

describe("closeEpisode", () => {
  it("orders start and end when the video was sought back mid-episode", () => {
    const episode = closeEpisode(
      { behaviorId: "b1", start: 30, holders: [] },
      12,
      "e1"
    );
    expect(episode).toEqual({ id: "e1", behaviorId: "b1", start: 12, end: 30 });
  });

  it("rounds to milliseconds", () => {
    const episode = closeEpisode(
      { behaviorId: "b1", start: 1, holders: [] },
      2.00049,
      "e1"
    );
    expect(episode.end).toBe(2);
  });

  it("closes at the start when the end time is not a number", () => {
    const episode = closeEpisode(
      { behaviorId: "b1", start: 4, holders: [] },
      Number.NaN,
      "e1"
    );
    expect(episode).toEqual({ id: "e1", behaviorId: "b1", start: 4, end: 4 });
  });
});

describe("releaseWhere", () => {
  it("ends key holds and leaves pointer holds and toggles running", () => {
    const ids = counter();
    let active: Active = {};
    active = press(active, hold, "key", 1, playing, ids).active;
    active = press(
      active,
      { id: "b3", mode: "hold" },
      "pointer:1",
      1,
      playing,
      ids
    ).active;
    active = press(active, toggle, "key", 1, playing, ids).active;

    const result = releaseWhere(active, (h) => h === "key", 3, ids);

    expect(result.committed.map((e) => e.behaviorId)).toEqual(["b1"]);
    expect(Object.keys(result.active).sort()).toEqual(["b2", "b3"]);
  });

  it("keeps a hold open when a pointer still holds it", () => {
    const ids = counter();
    let active: Active = press({}, hold, "key", 1, playing, ids).active;
    active = press(active, hold, "pointer:2", 1, playing, ids).active;

    const result = releaseWhere(active, (h) => h === "key", 3, ids);

    expect(result.committed).toEqual([]);
    expect(result.active.b1?.holders).toEqual(["pointer:2"]);
  });
});

describe("commitAll", () => {
  it("ends hold and toggle episodes at the given time", () => {
    const ids = counter();
    let active: Active = press({}, hold, "key", 1, playing, ids).active;
    active = press(active, toggle, "key", 2, playing, ids).active;

    expect(commitAll(active, 5, ids)).toEqual([
      { id: "e1", behaviorId: "b1", start: 1, end: 5 },
      { id: "e2", behaviorId: "b2", start: 2, end: 5 }
    ]);
  });
});

describe("insertEpisode", () => {
  const at = (id: string, start: number): Episode => ({
    id,
    behaviorId: "b",
    start,
    end: start
  });

  it("keeps the list sorted by start", () => {
    const list = [at("a", 1), at("c", 5)];
    expect(insertEpisode(list, at("b", 3)).map((e) => e.id)).toEqual([
      "a",
      "b",
      "c"
    ]);
  });

  it("puts an episode after others with the same start", () => {
    const list = [at("a", 1), at("b", 1)];
    expect(insertEpisode(list, at("c", 1)).map((e) => e.id)).toEqual([
      "a",
      "b",
      "c"
    ]);
  });
});
