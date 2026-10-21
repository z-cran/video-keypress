import { describe, expect, it } from "vitest";
import type { Behavior } from "../behaviors/behaviors.ts";
import type { Session } from "../session/session.ts";
import { buildTimelineSvg } from "./timelineSvg.ts";

const tricky: Behavior = {
  id: "b1",
  name: `Scratch <ear> & "face"`,
  color: "#0072B2",
  hotkey: null,
  mode: "hold"
};
const grooming: Behavior = {
  id: "b2",
  name: "Grooming",
  color: "#E69F00",
  hotkey: null,
  mode: "hold"
};

function session(): Session {
  return {
    version: 2,
    fingerprint: null,
    video: { fileName: "a&b.mp4", size: 1, lastModified: 1, duration: 60 },
    createdAt: 0,
    updatedAt: 0,
    behaviors: [tricky, grooming],
    episodes: [
      { id: "1", behaviorId: "b1", start: 1, end: 2 },
      { id: "2", behaviorId: "b2", start: 3, end: 3 },
      { id: "3", behaviorId: "b1", start: 10, end: 20 }
    ]
  };
}

function parse(svg: string) {
  return new DOMParser().parseFromString(svg, "image/svg+xml");
}

describe("buildTimelineSvg", () => {
  it("produces a well-formed standalone SVG", () => {
    const doc = parse(buildTimelineSvg(session(), [tricky, grooming]));
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(doc.documentElement.getAttribute("xmlns")).toBe(
      "http://www.w3.org/2000/svg"
    );
  });

  it("draws one bar per episode, including point events", () => {
    const doc = parse(buildTimelineSvg(session(), [tricky, grooming]));
    const bars = [...doc.querySelectorAll("rect[rx]")];
    expect(bars).toHaveLength(3);
    expect(bars.map((r) => r.getAttribute("fill"))).toEqual([
      "#0072B2",
      "#E69F00",
      "#0072B2"
    ]);
  });

  it("escapes behavior and file names", () => {
    const doc = parse(buildTimelineSvg(session(), [tricky, grooming]));
    expect(doc.querySelector("title")?.textContent).toBe("Timeline of a&b.mp4");
    expect(
      [...doc.querySelectorAll("text")].map((t) => t.textContent)
    ).toContain(`Scratch <ear> & "face"`);
  });
});
