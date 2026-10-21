// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  hotkeyLabel,
  hotkeyProblem,
  isAllowedHotkeyCode,
  legacyKeyToCode,
  resolveKey,
  type KeyLike
} from "./hotkeys.ts";

function key(code: string, overrides: Partial<KeyLike> = {}): KeyLike {
  return {
    code,
    key: "",
    repeat: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    fromIgnoredTarget: false,
    ...overrides
  };
}

const scratching = { id: "b1", hotkey: { code: "Digit1", label: "1" } };
const grooming = { id: "b2", hotkey: { code: "Numpad1", label: "Num 1" } };
const behaviors = [scratching, grooming];

describe("resolveKey on keydown", () => {
  it.each([
    ["Space", false, "togglePlay"],
    ["ArrowLeft", false, "seekBack"],
    ["ArrowRight", true, "fineSeekForward"],
    ["Comma", false, "frameBack"],
    ["Comma", true, "slower"],
    ["Period", true, "faster"]
  ])("maps %s (shift %s) to the player action %s", (code, shiftKey, action) => {
    expect(resolveKey(key(code, { shiftKey }), behaviors, "down")).toEqual({
      kind: "player",
      action
    });
  });

  it("starts the behavior bound to the pressed key", () => {
    expect(resolveKey(key("Digit1"), behaviors, "down")).toEqual({
      kind: "behavior",
      behaviorId: "b1"
    });
  });

  it("still matches Digit1 when Shift turns the character into !", () => {
    const ev = key("Digit1", { key: "!", shiftKey: true });
    expect(resolveKey(ev, behaviors, "down")).toEqual({
      kind: "behavior",
      behaviorId: "b1"
    });
  });

  it("keeps the number row and the numpad as different keys", () => {
    expect(resolveKey(key("Numpad1"), behaviors, "down")).toEqual({
      kind: "behavior",
      behaviorId: "b2"
    });
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["Meta", { metaKey: true }],
    ["Alt", { altKey: true }],
    ["a text field or dialog", { fromIgnoredTarget: true }],
    ["IME composition", { isComposing: true }],
    ["a Process key", { key: "Process" }],
    ["a dead key", { key: "Dead" }],
    ["auto-repeat", { repeat: true }]
  ])("ignores a behavior key pressed with %s", (_label, overrides) => {
    expect(resolveKey(key("Digit1", overrides), behaviors, "down")).toEqual({
      kind: "ignore"
    });
  });

  it("lets Ctrl+Space through to the browser", () => {
    expect(
      resolveKey(key("Space", { ctrlKey: true }), behaviors, "down")
    ).toEqual({ kind: "ignore" });
  });

  it("swallows a held Space without toggling playback again", () => {
    expect(
      resolveKey(key("Space", { repeat: true }), behaviors, "down")
    ).toEqual({ kind: "player", action: null });
  });

  it("repeats seeks while an arrow is held", () => {
    expect(
      resolveKey(key("ArrowRight", { repeat: true }), behaviors, "down")
    ).toEqual({ kind: "player", action: "seekForward" });
  });

  it("asks to release key holds when Cmd goes down", () => {
    expect(resolveKey(key("MetaLeft"), behaviors, "down")).toEqual({
      kind: "releaseKeyHolds"
    });
  });

  it("ignores keys bound to nothing", () => {
    expect(resolveKey(key("KeyZ"), behaviors, "down")).toEqual({
      kind: "ignore"
    });
  });
});

describe("resolveKey on keyup", () => {
  it("ends the behavior even when Ctrl went down during the hold", () => {
    const ev = key("Digit1", { ctrlKey: true });
    expect(resolveKey(ev, behaviors, "up")).toEqual({
      kind: "behavior",
      behaviorId: "b1"
    });
  });

  it("swallows Space so a focused button does not also click", () => {
    expect(resolveKey(key("Space"), behaviors, "up")).toEqual({
      kind: "player",
      action: null
    });
  });

  it("lets Space through inside a dialog so its buttons still work", () => {
    const ev = key("Space", { fromIgnoredTarget: true });
    expect(resolveKey(ev, behaviors, "up")).toEqual({ kind: "ignore" });
  });
});

describe("hotkeyProblem", () => {
  const owners = [
    { id: "b1", name: "Scratching", hotkey: { code: "Digit1", label: "1" } }
  ];

  it("accepts a free letter key", () => {
    expect(hotkeyProblem("KeyS", owners, null)).toBeNull();
  });

  it("explains that Space belongs to the player", () => {
    expect(hotkeyProblem("Space", owners, null)).toBe(
      "Space plays and pauses the video. Choose a letter or number key."
    );
  });

  it.each(["F5", "Tab", "Enter", "Escape", "Minus", ""])(
    "rejects %j as a hotkey",
    (code) => {
      expect(hotkeyProblem(code, owners, null)).toBe(
        "Choose a letter or number key."
      );
    }
  );

  it("names the behavior that already uses the key", () => {
    expect(hotkeyProblem("Digit1", owners, "b2")).toBe(
      "1 is already used by Scratching. Choose another key."
    );
  });

  it("lets a behavior keep its own key", () => {
    expect(hotkeyProblem("Digit1", owners, "b1")).toBeNull();
  });
});

describe("isAllowedHotkeyCode", () => {
  it.each([
    ["KeyA", true],
    ["Digit0", true],
    ["Numpad9", true],
    ["KeyAA", false],
    ["NumpadAdd", false],
    ["F1", false]
  ])("%s allowed: %s", (code, allowed) => {
    expect(isAllowedHotkeyCode(code)).toBe(allowed);
  });
});

describe("hotkeyLabel", () => {
  it.each([
    ["KeyQ", "a", "A"],
    ["Digit1", "1", "1"],
    ["Digit1", "!", "1"],
    ["Numpad4", "ArrowLeft", "Num 4"],
    ["KeyS", undefined, "S"]
  ])("labels %s typed as %s as %s", (code, typed, label) => {
    expect(hotkeyLabel(code, typed)).toBe(label);
  });
});

describe("legacyKeyToCode", () => {
  it.each([
    ["1", "Digit1"],
    ["a", "KeyA"],
    ["A", "KeyA"],
    ["!", null],
    ["", null],
    ["ab", null],
    [null, null],
    [7, null]
  ])("maps v1 key %j to %j", (legacy, code) => {
    expect(legacyKeyToCode(legacy)).toBe(code);
  });
});
