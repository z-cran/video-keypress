import { cleanup, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setTime } from "../../test/fakeMedia.ts";
import { renderAppWithVideo } from "../../test/renderApp.tsx";
import { resetStores } from "../../test/resetStores.ts";
import { useBehaviorsStore } from "../behaviors/behaviorsStore.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import { SESSION_PREFIX } from "./savedSessions.ts";

const FILE = { name: "cage-07.mp4", size: 3, lastModified: 1700, duration: 60 };
const KEY = `${SESSION_PREFIX}cage-07.mp4|3|1700`;

async function scoreTwoEpisodes() {
  const { user, video } = await renderAppWithVideo(FILE);
  await user.click(screen.getByRole("button", { name: "Play" }));
  for (const [start, end] of [
    [2, 3],
    [10, 12.5]
  ] as const) {
    setTime(video, start);
    await user.keyboard("[Digit1>]");
    setTime(video, end);
    await user.keyboard("[/Digit1]");
  }
  return { user, video };
}

/** Like a page reload: memory is gone, localStorage stays. */
async function reload() {
  cleanup();
  const saved = { ...localStorage };
  resetStores();
  for (const [k, v] of Object.entries(saved))
    localStorage.setItem(k, v as string);
  await useBehaviorsStore.persist.rehydrate();
}

function episodeTimes() {
  return useSessionStore
    .getState()
    .session?.episodes.map((e) => [e.start, e.end]);
}

describe("autosave", () => {
  it("saves each episode as it is recorded", async () => {
    await scoreTwoEpisodes();

    const saved = JSON.parse(localStorage.getItem(KEY)!) as {
      episodes: unknown[];
      behaviors: { name: string }[];
    };
    expect(saved.episodes).toHaveLength(2);
    expect(saved.behaviors.map((b) => b.name)).toEqual(["Scratching"]);
  });

  it("removes the saved session when its last episode is deleted", async () => {
    const { user } = await scoreTwoEpisodes();
    await user.click(screen.getByRole("button", { name: "Episodes (2)" }));

    await user.click(screen.getByRole("button", { name: "Delete episode 2" }));
    await user.click(screen.getByRole("button", { name: "Delete episode 1" }));

    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("warns and guards closing the tab when storage is full", async () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (key.startsWith(SESSION_PREFIX))
        throw new DOMException("full", "QuotaExceededError");
      original.call(this, key, value);
    });
    const addListener = vi.spyOn(window, "addEventListener");

    await scoreTwoEpisodes();

    expect(
      await screen.findByText(
        "Autosave is paused because browser storage is full. Export your episodes to keep them."
      )
    ).toBeVisible();
    expect(addListener).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function)
    );
  });
});

describe("restoring a saved session", () => {
  it("offers to continue and brings the episodes back", async () => {
    await scoreTwoEpisodes();
    await reload();

    const { user } = await renderAppWithVideo(FILE);
    const prompt = await screen.findByRole("dialog", {
      name: "Continue where you left off?"
    });
    expect(prompt).toHaveTextContent("This video has 2 saved episodes from");
    await user.click(within(prompt).getByRole("button", { name: "Continue" }));

    expect(episodeTimes()).toEqual([
      [2, 3],
      [10, 12.5]
    ]);
    expect(await screen.findByText("Episodes (2)")).toBeVisible();
  });

  it("starts over after a second confirmation and deletes the saved copy", async () => {
    await scoreTwoEpisodes();
    await reload();

    const { user } = await renderAppWithVideo(FILE);
    await user.click(await screen.findByRole("button", { name: "Start over" }));
    const sure = await screen.findByRole("dialog", { name: "Start over?" });
    expect(sure).toHaveTextContent(
      "The 2 saved episodes for this video will be deleted."
    );
    await user.click(
      within(sure).getByRole("button", { name: "Delete and start over" })
    );

    expect(episodeTimes()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("keeps the saved episodes when starting over is declined", async () => {
    await scoreTwoEpisodes();
    await reload();

    const { user } = await renderAppWithVideo(FILE);
    await user.click(await screen.findByRole("button", { name: "Start over" }));
    await user.click(await screen.findByRole("button", { name: "Keep them" }));

    expect(episodeTimes()).toHaveLength(2);
  });

  it("does not offer another file's session", async () => {
    await scoreTwoEpisodes();
    await reload();

    await renderAppWithVideo({ ...FILE, lastModified: 9999 });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it("adds back a behavior that was removed from the list since", async () => {
    await scoreTwoEpisodes();
    await reload();
    useBehaviorsStore.setState((s) => ({
      behaviors: s.behaviors.filter((b) => b.name !== "Scratching")
    }));

    const { user } = await renderAppWithVideo(FILE);
    await user.click(await screen.findByRole("button", { name: "Continue" }));

    expect(useBehaviorsStore.getState().behaviors.map((b) => b.name)).toEqual([
      "Grooming",
      "Rearing",
      "Scratching"
    ]);
    expect(
      await screen.findByText(
        "Added Scratching to your behaviors so its episodes have a lane."
      )
    ).toBeVisible();
    expect(screen.getByTestId("tally-Scratching")).toHaveTextContent("2");
  });
});
