// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  appendEvent,
  bufferedAhead,
  describeMedia,
  formatBuffered,
  formatBytes,
  formatEventLine,
  formatReport,
  networkStateLabel,
  readyStateLabel,
  snapshotOf,
  urlFlags,
  type MediaEvent,
  type MediaLike,
  type MediaSnapshot
} from "./mediaReport.ts";

const playing: MediaSnapshot = {
  currentTime: 4.5,
  duration: 3600,
  paused: false,
  readyState: 4,
  networkState: 2,
  buffered: [[0, 69]],
  error: null
};

/** The parts of a <video> that snapshotOf reads. */
const element: MediaLike = {
  currentTime: 4.5,
  duration: 3600,
  paused: false,
  readyState: 4,
  networkState: 2,
  buffered: null,
  error: null
};

const event = (type: string, at = 1): Omit<MediaEvent, "count"> => ({
  at,
  type,
  currentTime: 4.5,
  readyState: 2,
  networkState: 2
});

describe("snapshotOf", () => {
  it("copies the buffered ranges out of a TimeRanges-like object", () => {
    const ranges = [
      [0, 10],
      [20, 25]
    ];
    const snapshot = snapshotOf({
      ...element,
      buffered: {
        length: ranges.length,
        start: (i) => ranges[i]![0]!,
        end: (i) => ranges[i]![1]!
      }
    });

    expect(snapshot.buffered).toEqual([
      [0, 10],
      [20, 25]
    ]);
  });

  it.each([undefined, null])(
    "reports nothing buffered when buffered is %s",
    (buffered) => {
      expect(snapshotOf({ ...element, buffered }).buffered).toEqual([]);
    }
  );

  it("keeps only the code and message of a media error", () => {
    const error = Object.assign(new Error("decode failed"), { code: 3 });

    expect(snapshotOf({ ...element, error }).error).toEqual({
      code: 3,
      message: "decode failed"
    });
  });
});

describe("appendEvent", () => {
  it("adds a new event type with a count of 1", () => {
    expect(appendEvent([], event("waiting"), 10)).toEqual([
      { ...event("waiting"), count: 1 }
    ]);
  });

  it("folds a repeat of the last type into it and keeps the newest time", () => {
    const log = appendEvent([], event("progress", 1), 10);

    expect(appendEvent(log, event("progress", 2), 10)).toEqual([
      { ...event("progress", 2), count: 2 }
    ]);
  });

  it("does not fold a type that is not the last one", () => {
    let log = appendEvent([], event("progress"), 10);
    log = appendEvent(log, event("waiting"), 10);

    expect(appendEvent(log, event("progress"), 10).map((e) => e.type)).toEqual([
      "progress",
      "waiting",
      "progress"
    ]);
  });

  it("drops the oldest events past the cap", () => {
    let log: MediaEvent[] = [];
    for (const type of ["a", "b", "c", "d"]) {
      log = appendEvent(log, event(type), 3);
    }

    expect(log.map((e) => e.type)).toEqual(["b", "c", "d"]);
  });

  it.each([0, -1, Number.NaN])("keeps nothing with a cap of %s", (max) => {
    expect(appendEvent([], event("waiting"), max)).toEqual([]);
  });

  it("keeps everything with an Infinity cap", () => {
    let log: MediaEvent[] = [];
    for (const type of ["a", "b", "c"]) {
      log = appendEvent(log, event(type), Infinity);
    }

    expect(log).toHaveLength(3);
  });

  it("does not change the log it was given", () => {
    const log = Object.freeze(appendEvent([], event("progress"), 10));

    appendEvent(log, event("progress"), 10);

    expect(log[0]!.count).toBe(1);
  });
});

describe("state labels", () => {
  it.each([
    [0, "0 · nothing"],
    [4, "4 · enough data"],
    [7, "7 · unknown"],
    [-1, "-1 · unknown"],
    [Number.NaN, "NaN · unknown"]
  ])("names ready state %s as %j", (state, label) => {
    expect(readyStateLabel(state)).toBe(label);
  });

  it.each([
    [2, "2 · loading"],
    [3, "3 · no source"],
    [9, "9 · unknown"]
  ])("names network state %s as %j", (state, label) => {
    expect(networkStateLabel(state)).toBe(label);
  });
});

describe("bufferedAhead", () => {
  it("measures from the playhead to the end of its buffered range", () => {
    expect(
      bufferedAhead({
        currentTime: 4,
        buffered: [
          [0, 6.5],
          [10, 20]
        ]
      })
    ).toBe(2.5);
  });

  it("is 0 when the playhead sits in a gap, as in a stall", () => {
    expect(
      bufferedAhead({
        currentTime: 8,
        buffered: [
          [0, 6.5],
          [10, 20]
        ]
      })
    ).toBe(0);
  });

  it.each([
    [[], 4],
    [[[0, 10]], Number.NaN],
    [[[0, 10]], Infinity]
  ] as const)(
    "is 0 with buffered %j and playhead %s",
    (buffered, currentTime) => {
      expect(bufferedAhead({ currentTime, buffered })).toBe(0);
    }
  );
});

describe("formatBuffered", () => {
  it("lists each range as clock times", () => {
    expect(
      formatBuffered([
        [0, 69],
        [120, 125.5]
      ])
    ).toBe("0:00.0 to 1:09.0, 2:00.0 to 2:05.5");
  });

  it("says nothing is buffered for an empty list", () => {
    expect(formatBuffered([])).toBe("Nothing yet");
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [999, "999 B"],
    [1000, "1.0 kB"],
    [999_950, "1.0 MB"],
    [1_440_265_648, "1.4 GB"],
    [5e15, "5000.0 TB"]
  ])("formats %s bytes as %j", (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });

  it.each([-1, Number.NaN, Infinity])(
    "says the size is unknown for %s",
    (bytes) => {
      expect(formatBytes(bytes)).toBe("unknown size");
    }
  );
});

describe("describeMedia", () => {
  const value = (snapshot: MediaSnapshot, label: string) =>
    describeMedia(snapshot).find((row) => row.label === label)?.value;

  it("shows position against the duration", () => {
    expect(value(playing, "Position")).toBe("0:04.50 of 1:00:00.00");
  });

  it("shows unknown times as dashes instead of zero", () => {
    expect(
      value(
        { ...playing, currentTime: Number.NaN, duration: Infinity },
        "Position"
      )
    ).toBe("--:-- of --:--");
  });

  it("shows how much is buffered past the playhead", () => {
    expect(value(playing, "Buffered ahead")).toBe("64.5 s");
  });

  it("says the buffer runs to the end when its range never ends", () => {
    expect(
      value({ ...playing, buffered: [[0, Infinity]] }, "Buffered ahead")
    ).toBe("to the end");
  });

  it("shows a media error by code and message", () => {
    expect(
      value({ ...playing, error: { code: 2, message: "network" } }, "Error")
    ).toBe("2 · network");
  });

  it("notes a media error that came without a message", () => {
    expect(
      value({ ...playing, error: { code: 4, message: "" } }, "Error")
    ).toBe("4 · no message");
  });
});

describe("formatEventLine", () => {
  it("shows when, what and where for one event", () => {
    expect(formatEventLine({ ...event("waiting", 7.256), count: 1 })).toBe(
      "7.26 s · waiting · at 0:04.50 · ready 2 · network 2"
    );
  });

  it("shows how many times a folded event repeated", () => {
    expect(formatEventLine({ ...event("progress"), count: 12 })).toContain(
      "progress x12"
    );
  });
});

describe("formatReport", () => {
  const base = {
    page: "app",
    version: "2.0.0",
    userAgent: "Mozilla/5.0 (Macintosh)",
    touchPoints: 5,
    file: { name: "cage-04.MOV", type: "video/quicktime", size: 1_440_265_648 },
    source: "service worker",
    snapshot: playing,
    events: [{ ...event("waiting", 7.25), count: 1 }]
  };

  it("names the page, version, browser, file and how it is loaded", () => {
    const lines = formatReport(base).split("\n");

    expect(lines.slice(0, 5)).toEqual([
      "Video Keypress media report",
      "Page: app · version 2.0.0",
      "Browser: Mozilla/5.0 (Macintosh) · 5 touch points",
      "File: cage-04.MOV · video/quicktime · 1.4 GB",
      "Source: service worker"
    ]);
  });

  it("says no source before a video is loaded", () => {
    expect(formatReport({ ...base, source: null })).toContain("Source: none");
  });

  it("includes the media state and every logged event", () => {
    const report = formatReport(base);

    expect(report).toContain("Ready state: 4 · enough data");
    expect(report).toContain("7.25 s · waiting");
  });

  it.each([undefined, Number.NaN])(
    "says touch points are unknown when the browser reports %s",
    (touchPoints) => {
      expect(
        formatReport({ ...base, touchPoints: touchPoints as number })
      ).toContain("Browser: Mozilla/5.0 (Macintosh) · touch points unknown");
    }
  );

  it("notes a file the browser gave no type", () => {
    expect(
      formatReport({ ...base, file: { name: "a.mkv", type: "", size: 1 } })
    ).toContain("File: a.mkv · no type · 1 B");
  });

  it("still writes a report before a file, state or events exist", () => {
    const report = formatReport({
      ...base,
      file: null,
      snapshot: null,
      events: []
    });

    expect(report).toContain("File: none chosen");
    expect(report).toContain("Video: no state reported yet");
    expect(report).toMatch(/Events, oldest first:\nNone yet$/);
  });
});

describe("urlFlags", () => {
  it.each([
    ["", false, false],
    ["?debug=media", true, false],
    ["?x=1&debug=media", true, false],
    ["?debug=other&debug=media", true, false],
    ["?debug=Media", false, false],
    ["?debug", false, false],
    ["?mediacheck", false, true],
    ["?mediacheck=0", false, true],
    ["?mediacheck&debug=media", true, true]
  ])("reads %j as debugMedia %s, mediaCheck %s", (search, debug, check) => {
    expect(urlFlags(search)).toEqual({
      debugMedia: debug,
      mediaCheck: check
    });
  });
});
