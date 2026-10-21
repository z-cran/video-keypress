import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { failToLoad, setTime } from "../../test/fakeMedia.ts";
import { renderAppWithVideo } from "../../test/renderApp.tsx";

describe("video player", () => {
  it("replaces the drop zone with the video once a file is chosen", async () => {
    const { video } = await renderAppWithVideo({ name: "cage-04.mp4" });

    expect(screen.queryByText("Drop a video here")).not.toBeInTheDocument();
    expect(video).toHaveAttribute("src", expect.stringMatching(/^blob:/));
    expect(screen.getByText("cage-04.mp4")).toBeVisible();
  });

  it("plays and pauses with the Play button", async () => {
    const { user, video } = await renderAppWithVideo();

    await user.click(screen.getByRole("button", { name: "Play" }));

    expect(video.paused).toBe(false);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("toggles playback once with Space while a control button has focus", async () => {
    const { user, video } = await renderAppWithVideo();
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pause" })).toHaveFocus();

    await user.keyboard("[Space]");

    // If Space also clicked the focused button, playback would toggle twice.
    expect(video.paused).toBe(true);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it.each([
    ["{ArrowRight}", 15],
    ["{ArrowLeft}", 5],
    ["{Shift>}{ArrowRight}{/Shift}", 11],
    ["{Shift>}{ArrowLeft}{/Shift}", 9]
  ])("seeks from 10 s with %s to %s s", async (keys, expected) => {
    const { user, video } = await renderAppWithVideo({ duration: 60 });
    setTime(video, 10);

    await user.keyboard(keys);

    expect(video.currentTime).toBe(expected);
  });

  it("does not seek past the end of the video", async () => {
    const { user, video } = await renderAppWithVideo({ duration: 12 });
    setTime(video, 10);

    await user.keyboard("{ArrowRight}");

    expect(video.currentTime).toBe(12);
  });

  it("pauses and steps one frame forward with the period key", async () => {
    const { user, video } = await renderAppWithVideo();
    await user.click(screen.getByRole("button", { name: "Play" }));
    setTime(video, 10);

    await user.keyboard("[Period]");

    expect(video.paused).toBe(true);
    expect(video.currentTime).toBeCloseTo(10 + 1 / 30, 6);
  });

  it("shows a message with a way out when the browser cannot play the file", async () => {
    const { video } = await renderAppWithVideo();

    failToLoad(video, 4);

    expect(
      screen.getByText(
        "This browser cannot play this file. Try an MP4 (H.264) or WebM video."
      )
    ).toBeVisible();
    expect(screen.getByText("Choose another")).toBeVisible();
  });

  it("turns away a dropped image without leaving the current video", async () => {
    const { video } = await renderAppWithVideo({ name: "cage-04.mp4" });
    const image = new File(["x"], "frame.png", { type: "image/png" });

    fireEvent.drop(document.body, { dataTransfer: { files: [image] } });

    expect(
      await screen.findByText(
        "That file does not look like a video. Choose an MP4 or WebM file."
      )
    ).toBeVisible();
    expect(screen.getByLabelText("Video")).toBe(video);
    expect(screen.getByText("cage-04.mp4")).toBeVisible();
  });
});

describe("playback speed", () => {
  it("steps up by 0.25 and stops at 2x", async () => {
    const { user, video } = await renderAppWithVideo();
    const faster = screen.getByRole("button", { name: "Faster" });

    for (let i = 0; i < 4; i++) await user.click(faster);

    expect(
      screen.getByRole("button", { name: "Playback speed 2x" })
    ).toBeVisible();
    expect(faster).toBeDisabled();
    expect(video.playbackRate).toBe(2);
  });

  it("steps down to 0.25x and no further", async () => {
    const { user, video } = await renderAppWithVideo();
    const slower = screen.getByRole("button", { name: "Slower" });

    for (let i = 0; i < 3; i++) await user.click(slower);

    expect(
      screen.getByRole("button", { name: "Playback speed 0.25x" })
    ).toBeVisible();
    expect(slower).toBeDisabled();
    expect(video.playbackRate).toBe(0.25);
  });

  it("changes speed with Shift and the period key", async () => {
    const { user, video } = await renderAppWithVideo();

    await user.keyboard("{Shift>}[Period]{/Shift}");

    expect(video.playbackRate).toBe(1.25);
    expect(video.paused).toBe(true);
  });

  it("picks a speed from the menu and remembers it for next time", async () => {
    const { user, video } = await renderAppWithVideo();

    await user.click(screen.getByRole("button", { name: "Playback speed 1x" }));
    await user.click(screen.getByRole("menuitem", { name: "1.75x" }));

    expect(video.playbackRate).toBe(1.75);
    expect(JSON.parse(localStorage.getItem("video-keypress:prefs")!)).toEqual({
      state: { rate: 1.75, muted: false },
      version: 1
    });
  });
});
