import { describe, expect, it } from "vitest";
import { LEGACY_KEYBINDS_KEY, useBehaviorsStore } from "./behaviorsStore.ts";

async function reload() {
  await useBehaviorsStore.persist.rehydrate();
  return useBehaviorsStore.getState().behaviors;
}

describe("behaviors store loading", () => {
  it("brings over v1 keybinds when nothing newer is saved", async () => {
    localStorage.setItem(
      LEGACY_KEYBINDS_KEY,
      JSON.stringify([
        { id: 1, key: "1", order: 1, behavior: "Scratching", active: false },
        { id: 2, key: "g", order: 2, behavior: "Grooming", active: true }
      ])
    );

    const behaviors = await reload();

    expect(behaviors.map((b) => [b.name, b.hotkey?.label])).toEqual([
      ["Scratching", "1"],
      ["Grooming", "G"]
    ]);
  });

  it("prefers saved v2 behaviors over v1 keybinds", async () => {
    localStorage.setItem(
      LEGACY_KEYBINDS_KEY,
      JSON.stringify([{ key: "1", behavior: "Old" }])
    );
    localStorage.setItem(
      "video-keypress:behaviors",
      JSON.stringify({
        state: {
          behaviors: [
            {
              id: "b1",
              name: "Freezing",
              color: "#009E73",
              hotkey: null,
              mode: "toggle"
            }
          ]
        },
        version: 1
      })
    );

    expect((await reload()).map((b) => b.name)).toEqual(["Freezing"]);
  });

  it("keeps an empty list the researcher chose", async () => {
    localStorage.setItem(
      "video-keypress:behaviors",
      JSON.stringify({ state: { behaviors: [] }, version: 1 })
    );

    expect(await reload()).toEqual([]);
  });

  it.each([
    ["corrupt v1 JSON", LEGACY_KEYBINDS_KEY, "{not json"],
    [
      "a v2 entry that is not a list",
      "video-keypress:behaviors",
      JSON.stringify({ state: { behaviors: "x" }, version: 1 })
    ]
  ])("falls back to the defaults for %s", async (_label, key, value) => {
    localStorage.setItem(key, value);

    expect((await reload()).map((b) => b.name)).toEqual([
      "Scratching",
      "Grooming",
      "Rearing"
    ]);
  });
});
