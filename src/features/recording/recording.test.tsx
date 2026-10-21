import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setTime } from "../../test/fakeMedia.ts";
import { renderAppWithVideo } from "../../test/renderApp.tsx";
import { useBehaviorsStore } from "../behaviors/behaviorsStore.ts";
import { useSessionStore } from "./sessionStore.ts";

function trigger(name: string) {
  return screen.getByRole("button", { name: new RegExp(`^${name},`) });
}

function padCount(name: string) {
  return within(trigger(name)).getByTestId("trigger-count").textContent;
}

function episodes() {
  return useSessionStore
    .getState()
    .session?.episodes.map(({ start, end }) => [start, end]);
}

async function playingApp() {
  const app = await renderAppWithVideo({ duration: 60 });
  await app.user.click(screen.getByRole("button", { name: "Play" }));
  return app;
}

describe("recording with hotkeys", () => {
  it("records a hold from keydown to keyup and shows it in the pad and tally", async () => {
    const { user, video } = await playingApp();

    setTime(video, 2);
    await user.keyboard("[Digit1>]");
    setTime(video, 3.5);
    await user.keyboard("[/Digit1]");

    expect(padCount("Scratching")).toBe("1");
    expect(
      within(trigger("Scratching")).getByTestId("trigger-total")
    ).toHaveTextContent("1.50 s");
    const row = screen.getByTestId("tally-Scratching");
    expect(
      within(row)
        .getAllByRole("cell")
        .map((c) => c.textContent)
    ).toEqual(["Scratching", "1", "1.50 s", "1.50 s", "2.5%"]);
    expect(episodes()).toEqual([[2, 3.5]]);
  });

  it("shows the episode as recording while the key is held", async () => {
    const { user, video } = await playingApp();

    setTime(video, 2);
    await user.keyboard("[Digit2>]");
    setTime(video, 2.75);

    expect(trigger("Grooming")).toHaveAttribute("aria-pressed", "true");
    expect(
      within(trigger("Grooming")).getByText(/Recording/)
    ).toHaveTextContent("Recording 0.75 s");
    expect(padCount("Grooming")).toBe("0");
  });

  it("ends a hold even if Shift went down before the key came up", async () => {
    const { user, video } = await playingApp();

    setTime(video, 1);
    await user.keyboard("[Digit1>]");
    setTime(video, 2);
    await user.keyboard("{Shift>}[/Digit1]{/Shift}");

    expect(episodes()).toEqual([[1, 2]]);
    expect(trigger("Scratching")).toHaveAttribute("aria-pressed", "false");
  });

  it("does not start a hold while the video is paused, and says why", async () => {
    const { user, video } = await renderAppWithVideo();

    setTime(video, 5);
    await user.keyboard("[Digit1>][/Digit1]");

    expect(episodes()).toEqual([]);
    expect(
      await screen.findByText(
        "Press play first, or set Scratching to Toggle in Behaviors to score while paused."
      )
    ).toBeVisible();
  });

  it("ends a held episode when the window loses focus", async () => {
    const { user, video } = await playingApp();

    setTime(video, 4);
    await user.keyboard("[Digit3>]");
    setTime(video, 6);
    fireEvent.blur(window);

    expect(episodes()).toEqual([[4, 6]]);
    expect(trigger("Rearing")).toHaveAttribute("aria-pressed", "false");
  });

  it("ignores hotkeys typed into the Behaviors dialog", async () => {
    const { user } = await playingApp();

    await user.click(screen.getByRole("button", { name: "Edit behaviors" }));
    const dialog = screen.getByRole("dialog", { name: "Behaviors" });
    await user.type(within(dialog).getAllByLabelText("Name")[0]!, " 123");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(episodes()).toEqual([]);
    expect(screen.getByLabelText<HTMLVideoElement>("Video").paused).toBe(false);
  });
});

describe("toggle mode", () => {
  it("records one episode across frame steps while paused", async () => {
    useBehaviorsStore.setState((s) => ({
      behaviors: s.behaviors.map((b) =>
        b.name === "Scratching" ? { ...b, mode: "toggle" as const } : b
      )
    }));
    const { user, video } = await renderAppWithVideo();
    setTime(video, 10);

    await user.keyboard("[Digit1]");
    await user.keyboard("[Period][Period][Period]");
    await user.keyboard("[Digit1]");

    expect(episodes()).toEqual([[10, 10.1]]);
  });

  it("starts and stops with clicks on the trigger", async () => {
    useBehaviorsStore.setState((s) => ({
      behaviors: s.behaviors.map((b) =>
        b.name === "Grooming" ? { ...b, mode: "toggle" as const } : b
      )
    }));
    const { user, video } = await renderAppWithVideo();

    setTime(video, 3);
    await user.click(trigger("Grooming"));
    setTime(video, 8);
    await user.click(trigger("Grooming"));

    expect(episodes()).toEqual([[3, 8]]);
  });
});

describe("recording with the trigger pad", () => {
  it("records while the mouse button is held on a trigger", async () => {
    const { user, video } = await playingApp();

    setTime(video, 2);
    await user.pointer({ keys: "[MouseLeft>]", target: trigger("Rearing") });
    setTime(video, 3);
    await user.pointer({ keys: "[/MouseLeft]", target: trigger("Rearing") });

    expect(episodes()).toEqual([[2, 3]]);
    expect(padCount("Rearing")).toBe("1");
  });

  it("ends the episode when the browser cancels the pointer", async () => {
    const { user, video } = await playingApp();

    setTime(video, 2);
    await user.pointer({ keys: "[MouseLeft>]", target: trigger("Rearing") });
    setTime(video, 2.5);
    fireEvent.pointerCancel(trigger("Rearing"), { pointerId: 1 });

    expect(episodes()).toEqual([[2, 2.5]]);
  });

  it("records once when the key and the mouse hold the same behavior", async () => {
    const { user, video } = await playingApp();

    setTime(video, 1);
    await user.keyboard("[Digit1>]");
    await user.pointer({ keys: "[MouseLeft>]", target: trigger("Scratching") });
    setTime(video, 2);
    await user.keyboard("[/Digit1]");
    setTime(video, 3);
    await user.pointer({ keys: "[/MouseLeft]", target: trigger("Scratching") });

    expect(episodes()).toEqual([[1, 3]]);
  });
});

describe("removing a behavior", () => {
  it("asks before deleting its episodes, then removes both", async () => {
    const { user, video } = await playingApp();
    setTime(video, 1);
    await user.keyboard("[Digit2>]");
    setTime(video, 2);
    await user.keyboard("[/Digit2]");

    await user.click(screen.getByRole("button", { name: "Edit behaviors" }));
    await user.click(screen.getByRole("button", { name: "Delete Grooming" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    const confirm = screen.getByRole("dialog", {
      name: "Delete episodes too?"
    });
    expect(confirm).toHaveTextContent("Grooming has 1 episode in this video.");
    await user.click(
      within(confirm).getByRole("button", {
        name: "Remove and delete episodes"
      })
    );

    expect(episodes()).toEqual([]);
    expect(useBehaviorsStore.getState().behaviors.map((b) => b.name)).toEqual([
      "Scratching",
      "Rearing"
    ]);
  });

  it("keeps the behavior and its episodes when the question is declined", async () => {
    const { user, video } = await playingApp();
    setTime(video, 1);
    await user.keyboard("[Digit2>]");
    setTime(video, 2);
    await user.keyboard("[/Digit2]");

    await user.click(screen.getByRole("button", { name: "Edit behaviors" }));
    await user.click(screen.getByRole("button", { name: "Delete Grooming" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(episodes()).toEqual([[1, 2]]);
    // The Behaviors dialog stays hidden from queries until the confirm closes.
    expect(
      await screen.findByRole("dialog", { name: "Behaviors" })
    ).toBeVisible();
  });
});
