// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createBehavior,
  defaultBehaviors,
  mergeBehaviors,
  migrateLegacyKeybinds,
  moveBehavior,
  nameProblem,
  nextColor,
  PALETTE,
  updateBehavior,
  type Behavior
} from "./behaviors.ts";

function counter(prefix = "id") {
  let n = 0;
  return () => `${prefix}${++n}`;
}

function behavior(id: string, name: string, overrides: Partial<Behavior> = {}) {
  return {
    id,
    name,
    color: "#0072B2",
    hotkey: null,
    mode: "hold",
    ...overrides
  } satisfies Behavior;
}

describe("defaultBehaviors", () => {
  it("binds the first three behaviors to keys 1, 2 and 3", () => {
    const list = defaultBehaviors(counter());
    expect(list.map((b) => [b.name, b.hotkey?.code])).toEqual([
      ["Scratching", "Digit1"],
      ["Grooming", "Digit2"],
      ["Rearing", "Digit3"]
    ]);
  });
});

describe("nameProblem", () => {
  const list = [behavior("b1", "Scratching")];

  it.each(["", "   ", "\t\n"])("asks for a name when given %j", (name) => {
    expect(nameProblem(name, list, null)).toBe("Give this behavior a name.");
  });

  it.each(["scratching", "  SCRATCHING ", "Scratching"])(
    "rejects %j because Scratching exists",
    (name) => {
      expect(nameProblem(name, list, null)).toBe(
        "Another behavior is already called Scratching."
      );
    }
  );

  it("lets a behavior keep its own name with different case", () => {
    expect(nameProblem("SCRATCHING", list, "b1")).toBeNull();
  });

  it("rejects names longer than 40 characters", () => {
    expect(nameProblem("x".repeat(41), list, null)).toBe(
      "Keep the name to 40 characters or fewer."
    );
  });

  it("accepts Unicode names", () => {
    expect(nameProblem("Kratzen · 搔く", list, null)).toBeNull();
  });
});

describe("createBehavior", () => {
  it("picks a unique name, an unused color and the next free digit", () => {
    const list = [
      behavior("b1", "New behavior", {
        color: PALETTE[0]!,
        hotkey: { code: "Digit1", label: "1" }
      })
    ];
    const created = createBehavior(list, counter("n"));
    expect(created).toEqual({
      id: "n1",
      name: "New behavior 2",
      color: PALETTE[1],
      hotkey: { code: "Digit2", label: "2" },
      mode: "hold"
    });
  });

  it("leaves the hotkey empty when every digit is taken", () => {
    const list = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) =>
      behavior(`b${d}`, `B${d}`, { hotkey: { code: `Digit${d}`, label: d } })
    );
    expect(createBehavior(list, counter()).hotkey).toBeNull();
  });
});

describe("nextColor", () => {
  it("cycles the palette once every color is used", () => {
    const list = PALETTE.map((color, i) =>
      behavior(`b${i}`, `B${i}`, { color })
    );
    expect(nextColor(list)).toBe(PALETTE[0]);
  });
});

describe("updateBehavior", () => {
  it("tidies the name and leaves other behaviors unchanged", () => {
    const list = [behavior("b1", "A"), behavior("b2", "B")];
    const next = updateBehavior(list, "b1", { name: "  Face   wash " });
    expect(next.map((b) => b.name)).toEqual(["Face wash", "B"]);
    expect(next[1]).toBe(list[1]);
  });
});

describe("moveBehavior", () => {
  const list = [behavior("a", "A"), behavior("b", "B"), behavior("c", "C")];

  it("moves a behavior down one place", () => {
    expect(moveBehavior(list, "a", 1).map((b) => b.id)).toEqual([
      "b",
      "a",
      "c"
    ]);
  });

  it.each([
    ["a", -1],
    ["c", 1],
    ["missing", 1]
  ] as const)("leaves the order alone when moving %s by %s", (id, delta) => {
    expect(moveBehavior(list, id, delta).map((b) => b.id)).toEqual([
      "a",
      "b",
      "c"
    ]);
  });
});

describe("mergeBehaviors", () => {
  it("matches incoming behaviors by id, then by name, and appends the rest", () => {
    const current = [
      behavior("b1", "Scratching", { hotkey: { code: "Digit1", label: "1" } }),
      behavior("b2", "Grooming")
    ];
    const incoming = [
      behavior("b1", "Renamed elsewhere"),
      behavior("x9", "grooming"),
      behavior("x7", "Freezing", { hotkey: { code: "Digit1", label: "1" } })
    ];

    const { behaviors, idMap, added } = mergeBehaviors(
      current,
      incoming,
      counter("n")
    );

    expect(Object.fromEntries(idMap)).toEqual({ b1: "b1", x9: "b2", x7: "x7" });
    expect(added.map((b) => [b.name, b.hotkey])).toEqual([["Freezing", null]]);
    expect(behaviors.map((b) => b.id)).toEqual(["b1", "b2", "x7"]);
  });

  it("gives an appended behavior a new id when its id is empty", () => {
    const { added } = mergeBehaviors(
      [],
      [behavior("", "Freezing")],
      counter("n")
    );
    expect(added[0]?.id).toBe("n1");
  });

  it("replaces a color that is not a hex value", () => {
    const { added } = mergeBehaviors(
      [],
      [behavior("x1", "Freezing", { color: "red; background:url(x)" })],
      counter()
    );
    expect(added[0]?.color).toBe(PALETTE[0]);
  });
});

describe("migrateLegacyKeybinds", () => {
  it("turns v1 keybinds into behaviors ordered by their v1 order", () => {
    const raw = [
      { id: 2, key: "b", order: 2, behavior: "Grooming", active: true },
      { id: 1, key: "1", order: 1, behavior: "Scratching", active: false }
    ];
    const migrated = migrateLegacyKeybinds(raw, counter("m"));
    expect(migrated?.map((b) => [b.name, b.hotkey?.code])).toEqual([
      ["Scratching", "Digit1"],
      ["Grooming", "KeyB"]
    ]);
  });

  it("keeps the first of two keybinds that share a key", () => {
    const raw = [
      { key: "1", order: 1, behavior: "Scratching" },
      { key: "1", order: 2, behavior: "Grooming" }
    ];
    const migrated = migrateLegacyKeybinds(raw, counter());
    expect(migrated?.map((b) => b.hotkey?.code ?? null)).toEqual([
      "Digit1",
      null
    ]);
  });

  it("drops duplicate and blank behavior names", () => {
    const raw = [
      { key: "1", behavior: "Scratching" },
      { key: "2", behavior: " scratching " },
      { key: "3", behavior: "   " }
    ];
    expect(migrateLegacyKeybinds(raw, counter())?.map((b) => b.name)).toEqual([
      "Scratching"
    ]);
  });

  it.each([
    ["null", null],
    ["a string", "keybinds"],
    ["an object", { key: "1" }],
    ["an empty array", []],
    ["entries without names", [{ key: "1" }, null, 3]]
  ])("returns null for %s", (_label, raw) => {
    expect(migrateLegacyKeybinds(raw, counter())).toBeNull();
  });
});
