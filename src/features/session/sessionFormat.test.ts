// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Behavior } from "../behaviors/behaviors.ts";
import type { Session } from "./session.ts";
import {
  BOM,
  csvCell,
  exportBaseName,
  parseSessionFile,
  toEpisodesCsv,
  toJsonV2,
  toSummaryCsv
} from "./sessionFormat.ts";

function counter(prefix = "n") {
  let n = 0;
  return () => `${prefix}${++n}`;
}

const scratching: Behavior = {
  id: "b1",
  name: "Scratching",
  color: "#0072B2",
  hotkey: { code: "Digit1", label: "1" },
  mode: "hold"
};
const grooming: Behavior = {
  id: "b2",
  name: "Grooming",
  color: "#E69F00",
  hotkey: null,
  mode: "toggle"
};

function session(overrides: Partial<Session> = {}): Session {
  return {
    version: 2,
    fingerprint: "mouse.mp4|10|1",
    video: { fileName: "mouse.mp4", size: 10, lastModified: 1, duration: 100 },
    createdAt: Date.UTC(2026, 9, 20, 12),
    updatedAt: Date.UTC(2026, 9, 20, 13),
    behaviors: [scratching, grooming],
    episodes: [
      { id: "x", behaviorId: "b2", start: 30, end: 31.5 },
      { id: "y", behaviorId: "b1", start: 2, end: 4.25 }
    ],
    ...overrides
  };
}

describe("toJsonV2", () => {
  const json = JSON.parse(
    toJsonV2(session(), [scratching, grooming], "2.0.0", 5)
  ) as {
    version: number;
    metadata: Record<string, unknown>;
    events: Record<string, unknown>[];
    behaviors: Record<string, unknown>[];
  };

  it("keeps the v1 event fields, sorted by start, with ids in that order", () => {
    expect(json.events).toEqual([
      {
        id: 0,
        behaviorId: "b1",
        behavior: "Scratching",
        key: "1",
        order: 1,
        start: 2,
        end: 4.25,
        duration: 2.25
      },
      {
        id: 1,
        behaviorId: "b2",
        behavior: "Grooming",
        key: "",
        order: 2,
        start: 30,
        end: 31.5,
        duration: 1.5
      }
    ]);
  });

  it("keeps the v1 metadata fields", () => {
    expect(json.metadata).toMatchObject({
      fileName: "mouse.mp4",
      duration: 100,
      scoringDate: Date.UTC(2026, 9, 20, 12),
      scoringDateText: "2026-10-20T12:00:00.000Z"
    });
  });

  it("writes an unknown duration as null, not NaN", () => {
    const text = toJsonV2(
      session({
        video: {
          fileName: "a.webm",
          size: 1,
          lastModified: 1,
          duration: Number.NaN
        }
      }),
      [],
      "2.0.0",
      5
    );
    expect(
      (JSON.parse(text) as { metadata: { duration: unknown } }).metadata
        .duration
    ).toBeNull();
  });
});

describe("parseSessionFile", () => {
  it("reads back its own v2 export", () => {
    const text = toJsonV2(session(), [scratching, grooming], "2.0.0", 5);
    const result = parseSessionFile(text, counter(), 0);

    expect(result.ok && result.format).toBe("v2");
    if (!result.ok) return;
    expect(result.session.fingerprint).toBeNull();
    expect(
      result.session.behaviors.map((b) => [
        b.id,
        b.name,
        b.hotkey?.code ?? null,
        b.mode
      ])
    ).toEqual([
      ["b1", "Scratching", "Digit1", "hold"],
      ["b2", "Grooming", null, "toggle"]
    ]);
    expect(
      result.session.episodes.map((e) => [e.behaviorId, e.start, e.end])
    ).toEqual([
      ["b1", 2, 4.25],
      ["b2", 30, 31.5]
    ]);
    expect(result.session.video.duration).toBe(100);
  });

  it("reads a v1 export, building behaviors from event names and keys", () => {
    // Shape written by v1.0.11, including its 0.01 s display nudges.
    const v1 = {
      metadata: {
        fileName: "cage.mp4",
        scoringDate: 1645400000000,
        scoringDateText: "2022-02-20T23:33:20.000Z",
        duration: 123.45
      },
      events: [
        {
          key: "2",
          behavior: "Behavior2",
          order: 2,
          start: 5.01,
          id: 1,
          end: 6
        },
        {
          key: "1",
          behavior: "Behavior1",
          order: 1,
          start: 1.234,
          id: 0,
          end: 4.037
        },
        {
          key: "1",
          behavior: "Behavior1",
          order: 1,
          start: 4.037,
          id: 2,
          end: 4.047
        }
      ]
    };
    const result = parseSessionFile(JSON.stringify(v1), counter(), 0);

    expect(result.ok && result.format).toBe("v1");
    if (!result.ok) return;
    expect(
      result.session.behaviors.map((b) => [b.name, b.hotkey?.code])
    ).toEqual([
      ["Behavior1", "Digit1"],
      ["Behavior2", "Digit2"]
    ]);
    expect(result.session.episodes.map((e) => [e.start, e.end])).toEqual([
      [1.234, 4.037],
      [4.037, 4.047],
      [5.01, 6]
    ]);
    expect(result.session.createdAt).toBe(1645400000000);
  });

  it("puts swapped start and end in order", () => {
    const text = JSON.stringify({
      events: [{ behavior: "A", start: 9, end: 3 }]
    });
    const result = parseSessionFile(text, counter(), 0);
    expect(
      result.ok && result.session.episodes.map((e) => [e.start, e.end])
    ).toEqual([[3, 9]]);
  });

  it("skips events with unreadable times and counts them", () => {
    const text = JSON.stringify({
      events: [
        { behavior: "A", start: 1, end: 2 },
        { behavior: "A", start: "1", end: 2 },
        { behavior: "A", start: -1, end: 2 },
        { behavior: "A", start: 1, end: null },
        { behavior: 7, start: 1, end: 2 },
        null
      ]
    });
    const result = parseSessionFile(text, counter(), 0);
    expect(
      result.ok && [result.session.episodes.length, result.skipped]
    ).toEqual([1, 5]);
  });

  it("accepts a file with no events", () => {
    const result = parseSessionFile(
      JSON.stringify({ metadata: {}, events: [] }),
      counter(),
      0
    );
    expect(result.ok && result.session.episodes).toEqual([]);
  });

  it.each([
    [
      "text that is not JSON",
      "{oops",
      "This file could not be read as JSON. Choose a .json file exported from the app."
    ],
    [
      "a JSON array",
      "[]",
      "This file does not look like scores from Video Keypress. Choose a .json file exported from the app."
    ],
    [
      "JSON without events",
      '{"metadata":{}}',
      "This file does not look like scores from Video Keypress. Choose a .json file exported from the app."
    ],
    [
      "null",
      "null",
      "This file does not look like scores from Video Keypress. Choose a .json file exported from the app."
    ]
  ])("explains why %s cannot be imported", (_label, text, message) => {
    expect(parseSessionFile(text, counter(), 0)).toEqual({
      ok: false,
      message
    });
  });

  it("turns away a file over 10 MB without parsing it", () => {
    const result = parseSessionFile(
      " ".repeat(10 * 1024 * 1024 + 1),
      counter(),
      0
    );
    expect(result).toEqual({
      ok: false,
      message:
        "This file is larger than 10 MB, which is more than a scores file should be."
    });
  });
});

describe("CSV export", () => {
  it.each([
    ["plain", "plain"],
    ["a,b", '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ["two\nlines", '"two\nlines"'],
    ["=HYPERLINK(1)", "'=HYPERLINK(1)"],
    ["+1", "'+1"],
    ["-x", "'-x"],
    ["@SUM", "'@SUM"]
  ])("writes %j as %j", (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it("does not guard negative numbers, which are data", () => {
    expect(csvCell(-1)).toBe("-1");
  });

  it("writes episodes with a BOM, a header and CRLF line endings", () => {
    expect(toEpisodesCsv(session(), [scratching, grooming])).toBe(
      BOM +
        "episode,behavior,key,start_s,end_s,duration_s\r\n" +
        "1,Scratching,1,2.000,4.250,2.250\r\n" +
        "2,Grooming,,30.000,31.500,1.500\r\n"
    );
  });

  it("summarizes every behavior, including ones with no episodes", () => {
    const rearing: Behavior = { ...grooming, id: "b3", name: "Rearing" };
    expect(toSummaryCsv(session(), [scratching, grooming, rearing])).toBe(
      BOM +
        "behavior,key,count,total_s,mean_s,percent_of_video\r\n" +
        "Scratching,1,1,2.250,2.250,2.25\r\n" +
        "Grooming,,1,1.500,1.500,1.50\r\n" +
        "Rearing,,0,0.000,,0.00\r\n"
    );
  });
});

describe("exportBaseName", () => {
  it.each([
    ["mouse 3.mp4", "mouse 3"],
    ["a/b:c?.webm", "a_b_c_"],
    ["noext", "noext"],
    [".mp4", "scores"],
    ["", "scores"]
  ])("turns %j into %j", (fileName, expected) => {
    expect(exportBaseName(fileName)).toBe(expected);
  });
});
