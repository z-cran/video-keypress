// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  fileReply,
  forgetMessage,
  isFileReply,
  isForgetMessage,
  isNeedFileMessage,
  isPutMessage,
  needFileMessage,
  planRange,
  putMessage,
  rangeHeaders,
  videoIdFromUrl,
  videoUrl
} from "./videoStream.ts";

const MB = 1024 * 1024;

describe("planRange", () => {
  it("sends the whole file when there is no Range header", () => {
    expect(planRange(null, 1000, 8 * MB)).toEqual({
      status: 200,
      start: 0,
      end: 999
    });
  });

  it("sends exactly a small closed range", () => {
    expect(planRange("bytes=0-1", 1000, 8 * MB)).toEqual({
      status: 206,
      start: 0,
      end: 1
    });
  });

  it("caps the open-ended range WebKit sends for a 4 GB file", () => {
    // The request that stalled on iPad: the whole file at once.
    expect(planRange("bytes=0-4066491438", 4066491439, 8 * MB)).toEqual({
      status: 206,
      start: 0,
      end: 8 * MB - 1
    });
  });

  it("caps an open range that starts past 4 GiB", () => {
    const size = 10_000_000_000;

    expect(planRange("bytes=9000000000-", size, 8 * MB)).toEqual({
      status: 206,
      start: 9_000_000_000,
      end: 9_000_000_000 + 8 * MB - 1
    });
  });

  it("stops an open range at the end of the file", () => {
    expect(planRange("bytes=900-", 1000, 8 * MB)).toEqual({
      status: 206,
      start: 900,
      end: 999
    });
  });

  it("clamps a range that runs past the end of the file", () => {
    expect(planRange("bytes=990-5000", 1000, 8 * MB)).toEqual({
      status: 206,
      start: 990,
      end: 999
    });
  });

  it.each([
    ["bytes=-100", 900],
    ["bytes=-5000", 0]
  ])("serves the suffix range %s from byte %s", (header, start) => {
    expect(planRange(header, 1000, 8 * MB)).toEqual({
      status: 206,
      start,
      end: 999
    });
  });

  it.each(["bytes=1000-", "bytes=1000-1001", "bytes=-0"])(
    "answers the unsatisfiable range %s with 416",
    (header) => {
      expect(planRange(header, 1000, 8 * MB).status).toBe(416);
    }
  );

  it("answers any range on an empty file with 416", () => {
    expect(planRange("bytes=0-", 0, 8 * MB).status).toBe(416);
  });

  it("sends an empty file whole when there is no Range header", () => {
    expect(planRange(null, 0, 8 * MB)).toEqual({
      status: 200,
      start: 0,
      end: -1
    });
  });

  it.each([
    "bytes=abc",
    "items=0-1",
    "bytes=5-2",
    "bytes=0-1,5-6",
    "bytes=-",
    ""
  ])("ignores the malformed or multi-range header %j", (header) => {
    expect(planRange(header, 1000, 8 * MB).status).toBe(200);
  });

  it("accepts the range unit in any case", () => {
    expect(planRange("Bytes=0-1", 1000, 8 * MB).status).toBe(206);
  });

  it.each([0, -1, Number.NaN, Infinity])(
    "does not cap with a limit of %s",
    (maxBytes) => {
      expect(planRange("bytes=0-", 1000, maxBytes).end).toBe(999);
    }
  );
});

describe("rangeHeaders", () => {
  it("describes a partial answer", () => {
    expect(
      rangeHeaders({ status: 206, start: 10, end: 19 }, 100, "video/mp4")
    ).toEqual({
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Length": "10",
      "Content-Range": "bytes 10-19/100",
      "Content-Type": "video/mp4"
    });
  });

  it("gives no Content-Range for a whole-file answer", () => {
    expect(
      rangeHeaders({ status: 200, start: 0, end: 99 }, 100, "video/mp4")
    ).not.toHaveProperty("Content-Range");
  });

  it("names the size for an unsatisfiable range and sends no length", () => {
    const headers = rangeHeaders({ status: 416, start: 0, end: -1 }, 100, "");

    expect(headers["Content-Range"]).toBe("bytes */100");
    expect(headers).not.toHaveProperty("Content-Length");
  });

  it("leaves out Content-Type when the file has none, so the browser sniffs", () => {
    expect(
      rangeHeaders({ status: 206, start: 0, end: 9 }, 100, "")
    ).not.toHaveProperty("Content-Type");
  });
});

describe("video URLs", () => {
  const scope = "https://z-cran.github.io/video-keypress/";

  it.each(["abc-123", "a b/c?d#e", "ü"])(
    "reads back the id %j from the URL it built",
    (id) => {
      const url = new URL(videoUrl("/video-keypress/", id), scope).href;

      expect(videoIdFromUrl(url, scope)).toBe(id);
    }
  );

  it("ignores a query string on the URL", () => {
    expect(videoIdFromUrl(`${scope}__video/abc?x=1`, scope)).toBe("abc");
  });

  it("accepts a scope without its trailing slash", () => {
    expect(videoIdFromUrl(`${scope}__video/abc`, scope.slice(0, -1))).toBe(
      "abc"
    );
  });

  it.each([
    ["an app asset", `${scope}assets/index.js`],
    ["the app page", scope],
    [
      "another project on the same origin",
      "https://z-cran.github.io/other/__video/abc"
    ],
    ["another origin", "https://example.com/video-keypress/__video/abc"],
    ["the bare video path", `${scope}__video/`],
    ["a nested path", `${scope}__video/abc/def`],
    ["a broken escape", `${scope}__video/%E0%A4%A`],
    ["not a URL", "not a url"]
  ])("does not claim %s", (_, url) => {
    expect(videoIdFromUrl(url, scope)).toBeNull();
  });
});

describe("messages", () => {
  const blob = new Blob(["x"]);

  it.each([
    ["put", putMessage("a", blob), isPutMessage],
    ["forget", forgetMessage("a"), isForgetMessage],
    ["need-file", needFileMessage("a"), isNeedFileMessage],
    ["file reply", fileReply("a", blob), isFileReply],
    ["file reply with no file", fileReply("a", null), isFileReply]
  ])("recognizes a %s message", (_, message, guard) => {
    expect(guard(message)).toBe(true);
  });

  it.each([
    ["null", null],
    ["a string", "video-keypress:put"],
    ["another type", forgetMessage("a")],
    ["a numeric id", { type: "video-keypress:put", id: 1, file: blob }],
    ["a missing file", { type: "video-keypress:put", id: "a" }],
    [
      "a file that is not a Blob",
      { type: "video-keypress:put", id: "a", file: "x" }
    ]
  ])("rejects %s as a put message", (_, message) => {
    expect(isPutMessage(message)).toBe(false);
  });

  it("rejects a file reply whose file is not a Blob", () => {
    expect(
      isFileReply({ type: "video-keypress:file", id: "a", file: {} })
    ).toBe(false);
  });
});
