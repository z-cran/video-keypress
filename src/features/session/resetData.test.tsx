import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Root from "../../Root.tsx";
import { setTime } from "../../test/fakeMedia.ts";
import { renderAppWithVideo } from "../../test/renderApp.tsx";
import { useBehaviorsStore } from "../behaviors/behaviorsStore.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import { useExportPrefs } from "./exportPrefsStore.ts";
import { SESSION_PREFIX } from "./savedSessions.ts";

type User = ReturnType<typeof userEvent.setup>;

async function record(
  user: User,
  video: HTMLVideoElement,
  start: number,
  end: number
) {
  setTime(video, start);
  await user.keyboard("[Digit1>]");
  setTime(video, end);
  await user.keyboard("[/Digit1]");
}

async function scoredVideo() {
  const app = await renderAppWithVideo({ duration: 60 });
  await app.user.click(screen.getByRole("button", { name: "Play" }));
  await record(app.user, app.video, 2, 3);
  await record(app.user, app.video, 10, 12);
  return app;
}

function savedSessionKeys() {
  return Object.keys(localStorage).filter((k) => k.startsWith(SESSION_PREFIX));
}

async function openReset(user: User) {
  await user.click(screen.getByRole("button", { name: "Reset saved data" }));
  return screen.getByRole("dialog", { name: "Reset saved data?" });
}

describe("reset saved data", () => {
  it("asks first, says what is saved, and keeps everything on Cancel", async () => {
    const { user } = await scoredVideo();

    const dialog = await openReset(user);
    expect(dialog).toHaveTextContent(
      "This browser has 1 saved session with 2 episodes."
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(savedSessionKeys()).toEqual([`${SESSION_PREFIX}mouse.mp4|1|1`]);
    expect(useSessionStore.getState().session?.episodes).toHaveLength(2);
  });

  it("says when nothing is saved", async () => {
    const user = userEvent.setup();
    render(<Root />);

    const dialog = await openReset(user);

    expect(dialog).toHaveTextContent("No sessions are saved in this browser.");
  });

  it("clears saved and open episodes but keeps the behaviors", async () => {
    useBehaviorsStore.setState((s) => ({
      behaviors: s.behaviors.map((b) =>
        b.name === "Scratching" ? { ...b, name: "Licking" } : b
      )
    }));
    const { user, video } = await scoredVideo();

    const dialog = await openReset(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Clear saved sessions" })
    );

    expect(savedSessionKeys()).toEqual([]);
    expect(screen.getByTestId("tally-Licking")).toHaveTextContent("0");
    expect(await screen.findByText("Saved sessions cleared.")).toBeVisible();
    expect(useBehaviorsStore.getState().behaviors.map((b) => b.name)).toEqual([
      "Licking",
      "Grooming",
      "Rearing"
    ]);

    // Scoring carries on, and autosave picks the new episode up.
    await record(user, video, 20, 21);
    expect(savedSessionKeys()).toHaveLength(1);
  });

  it("puts behaviors, speed, CSV columns and theme back to the defaults", async () => {
    useBehaviorsStore.setState((s) => ({ behaviors: s.behaviors.slice(0, 1) }));
    useExportPrefs.getState().setEpisodeColumns(["episode"]);
    const { user, video } = await scoredVideo();
    await user.click(screen.getByRole("button", { name: "Faster" }));
    await user.click(
      screen.getByRole("button", { name: "Theme: match the system" })
    );

    const dialog = await openReset(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Reset everything" })
    );

    expect(savedSessionKeys()).toEqual([]);
    expect(useBehaviorsStore.getState().behaviors.map((b) => b.name)).toEqual([
      "Scratching",
      "Grooming",
      "Rearing"
    ]);
    expect(video.playbackRate).toBe(1);
    expect(useExportPrefs.getState().episodeColumns).toHaveLength(6);
    // The page is hidden from queries until the confirm dialog has closed.
    expect(
      await screen.findByRole("button", { name: "Theme: match the system" })
    ).toBeVisible();
    expect(
      await screen.findByText("Everything is back to the defaults.")
    ).toBeVisible();
  });
});
