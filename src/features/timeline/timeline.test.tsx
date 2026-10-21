import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setTime } from "../../test/fakeMedia.ts";
import { renderAppWithVideo } from "../../test/renderApp.tsx";
import { useSessionStore } from "../recording/sessionStore.ts";
import { laneTop } from "./timelineScale.ts";

// The test ResizeObserver reports 1000 px; a 60 s video is 50/3 px per second.
const PX_PER_SEC = 1000 / 60;
const LANE0_Y = laneTop(0) + 10;

async function recordScratching(
  user: Awaited<ReturnType<typeof renderAppWithVideo>>["user"],
  video: HTMLVideoElement,
  start: number,
  end: number
) {
  setTime(video, start);
  await user.keyboard("[Digit1>]");
  setTime(video, end);
  await user.keyboard("[/Digit1]");
}

async function playingApp() {
  const app = await renderAppWithVideo({ duration: 60 });
  await app.user.click(screen.getByRole("button", { name: "Play" }));
  return app;
}

describe("timeline", () => {
  it("jumps the video to the clicked moment", async () => {
    const { user, video } = await renderAppWithVideo({ duration: 60 });
    const svg = screen.getByTestId("timeline-svg");

    await user.pointer({
      keys: "[MouseLeft]",
      target: svg,
      coords: { clientX: 30 * PX_PER_SEC, clientY: LANE0_Y }
    });

    expect(video.currentTime).toBeCloseTo(30, 6);
  });

  it("scrubs while the pointer is dragged across empty space", async () => {
    const { user, video } = await renderAppWithVideo({ duration: 60 });
    const svg = screen.getByTestId("timeline-svg");

    await user.pointer([
      {
        keys: "[MouseLeft>]",
        target: svg,
        coords: { clientX: 6 * PX_PER_SEC, clientY: LANE0_Y }
      },
      { target: svg, coords: { clientX: 42 * PX_PER_SEC, clientY: LANE0_Y } },
      {
        keys: "[/MouseLeft]",
        target: svg,
        coords: { clientX: 42 * PX_PER_SEC, clientY: LANE0_Y }
      }
    ]);

    expect(video.currentTime).toBeCloseTo(42, 6);
  });

  it("draws one bar per recorded episode", async () => {
    const { user, video } = await playingApp();

    await recordScratching(user, video, 10, 20);
    await recordScratching(user, video, 30, 31);

    expect(screen.getAllByTestId("episode-bar")).toHaveLength(2);
    expect(
      screen.getByRole("img", { name: "Timeline with 2 episodes" })
    ).toBeVisible();
  });

  it("shows an episode growing while it is being recorded", async () => {
    const { user, video } = await playingApp();

    setTime(video, 5);
    await user.keyboard("[Digit2>]");
    setTime(video, 8);

    const bar = screen.getByTestId("active-bar");
    expect(Number(bar.getAttribute("x"))).toBeCloseTo(5 * PX_PER_SEC, 6);
    expect(Number(bar.getAttribute("width"))).toBeCloseTo(3 * PX_PER_SEC, 6);
  });

  it("selects a clicked episode and jumps to its start", async () => {
    const { user, video } = await playingApp();
    await recordScratching(user, video, 10, 20);
    setTime(video, 50);

    const svg = screen.getByTestId("timeline-svg");
    await user.pointer({
      keys: "[MouseLeft]",
      target: svg,
      coords: { clientX: 15 * PX_PER_SEC, clientY: LANE0_Y }
    });

    expect(video.currentTime).toBe(10);
    expect(screen.getByText(/0:10\.000 to 0:20\.000/)).toHaveTextContent(
      "Scratching · 0:10.000 to 0:20.000 · 10.00 s"
    );
  });

  it("deletes the selected episode and brings it back with Undo", async () => {
    const { user, video } = await playingApp();
    await recordScratching(user, video, 10, 20);
    const svg = screen.getByTestId("timeline-svg");
    await user.pointer({
      keys: "[MouseLeft]",
      target: svg,
      coords: { clientX: 15 * PX_PER_SEC, clientY: LANE0_Y }
    });

    await user.click(screen.getByRole("button", { name: "Delete episode" }));
    expect(screen.queryAllByTestId("episode-bar")).toHaveLength(0);
    expect(screen.getByTestId("tally-Scratching")).toHaveTextContent("0");

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(screen.getAllByTestId("episode-bar")).toHaveLength(1);
    expect(
      useSessionStore.getState().session?.episodes.map((e) => [e.start, e.end])
    ).toEqual([[10, 20]]);
  });
});

describe("episode list", () => {
  it("lists episodes in time order and jumps to one when its row is clicked", async () => {
    const { user, video } = await playingApp();
    await recordScratching(user, video, 30, 32);
    setTime(video, 12);
    await user.keyboard("[Digit3>]");
    setTime(video, 13.5);
    await user.keyboard("[/Digit3]");

    await user.click(screen.getByRole("button", { name: "Episodes (2)" }));
    const table = screen.getByRole("table", { name: "Episodes" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(
      rows.map((r) =>
        within(r)
          .getAllByRole("cell")
          .slice(0, 5)
          .map((c) => c.textContent)
      )
    ).toEqual([
      ["1", "Rearing", "0:12.000", "0:13.500", "1.50 s"],
      ["2", "Scratching", "0:30.000", "0:32.000", "2.00 s"]
    ]);

    await user.click(rows[1]!);
    expect(video.currentTime).toBe(30);
  });

  it("flags episodes of one behavior that overlap after seeking back", async () => {
    const { user, video } = await playingApp();
    // Seeking back mid-hold records 5..10; the next hold covers 8..12.
    await recordScratching(user, video, 10, 5);
    await recordScratching(user, video, 8, 12);

    await user.click(screen.getByRole("button", { name: "Episodes (2)" }));

    expect(
      screen.getAllByLabelText("Overlaps another Scratching episode")
    ).toHaveLength(2);
  });
});
