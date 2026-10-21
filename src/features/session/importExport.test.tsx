import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../App.tsx";
import { setTime } from "../../test/fakeMedia.ts";
import { renderAppWithVideo, videoFile } from "../../test/renderApp.tsx";
import { resetStores } from "../../test/resetStores.ts";
import { useBehaviorsStore } from "../behaviors/behaviorsStore.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import { BOM } from "./sessionFormat.ts";

type User = ReturnType<typeof userEvent.setup>;

async function record(
  user: User,
  video: HTMLVideoElement,
  key: string,
  start: number,
  end: number
) {
  setTime(video, start);
  await user.keyboard(`[${key}>]`);
  setTime(video, end);
  await user.keyboard(`[/${key}]`);
}

async function scoredVideo() {
  const app = await renderAppWithVideo({ name: "cage-07.mp4", duration: 60 });
  await app.user.click(screen.getByRole("button", { name: "Play" }));
  await record(app.user, app.video, "Digit1", 2, 3);
  await record(app.user, app.video, "Digit2", 10, 12.5);
  return app;
}

/** Capture what the app hands to the browser's download. */
function captureDownloads() {
  const blobs: Blob[] = [];
  const names: string[] = [];
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    blobs.push(blob as Blob);
    return "blob:test/download";
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    names.push(this.download);
  });
  return { blobs, names };
}

async function exportAs(user: User, label: string) {
  await user.click(screen.getByRole("button", { name: "Export" }));
  await user.click(
    screen.getByRole("menuitem", { name: new RegExp(`^${label}`) })
  );
}

function jsonFile(content: unknown, name = "scores.json") {
  return new File(
    [typeof content === "string" ? content : JSON.stringify(content)],
    name,
    { type: "application/json" }
  );
}

function tallyCount(name: string) {
  return within(screen.getByTestId(`tally-${name}`)).getAllByRole("cell")[1]
    ?.textContent;
}

const V1_FILE = {
  metadata: {
    fileName: "old-cage.mp4",
    scoringDate: 1645400000000,
    scoringDateText: "2022-02-20T23:33:20.000Z",
    duration: 90
  },
  events: [
    {
      key: "1",
      behavior: "Behavior1",
      order: 1,
      start: 1.234,
      id: 0,
      end: 4.037
    },
    { key: "1", behavior: "Behavior1", order: 1, start: 8, id: 1, end: 9 },
    { key: "2", behavior: "Behavior2", order: 2, start: 5, id: 2, end: 6 }
  ]
};

describe("export", () => {
  it("is unavailable until there is an episode", async () => {
    await renderAppWithVideo();
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
  });

  it("saves JSON that keeps the v1 event fields", async () => {
    const { user } = await scoredVideo();
    const downloads = captureDownloads();

    await exportAs(user, "Scores \\(JSON\\)");

    expect(downloads.names).toEqual(["cage-07-scores.json"]);
    const json = JSON.parse(await downloads.blobs[0]!.text()) as {
      events: Record<string, unknown>[];
    };
    expect(json.events.map((e) => [e.behavior, e.key, e.start, e.end])).toEqual(
      [
        ["Scratching", "1", 2, 3],
        ["Grooming", "2", 10, 12.5]
      ]
    );
  });

  it.each([
    [
      "Episodes \\(CSV\\)",
      "cage-07-episodes.csv",
      BOM +
        "episode,behavior,key,start_s,end_s,duration_s\r\n1,Scratching,1,2.000,3.000,1.000"
    ],
    [
      "Summary \\(CSV\\)",
      "cage-07-summary.csv",
      BOM +
        "behavior,key,count,total_s,mean_s,percent_of_video\r\nScratching,1,1,1.000"
    ],
    [
      "Timeline \\(SVG\\)",
      "cage-07-timeline.svg",
      '<svg xmlns="http://www.w3.org/2000/svg"'
    ]
  ])("saves %s as %s", async (label, fileName, start) => {
    const { user } = await scoredVideo();
    const downloads = captureDownloads();

    await exportAs(user, label);

    expect(downloads.names).toEqual([fileName]);
    // Blob.text() drops a leading BOM, so decode the bytes without stripping it.
    const bytes = await downloads.blobs[0]!.arrayBuffer();
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    expect(text.startsWith(start)).toBe(true);
  });
});

describe("import", () => {
  it("shows a v1 file read-only when no video is open", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText("Or open saved scores (JSON)"),
      jsonFile(V1_FILE)
    );

    expect(
      await screen.findByText(/Viewing imported scores for old-cage.mp4/)
    ).toBeVisible();
    expect(tallyCount("Behavior1")).toBe("2");
    expect(tallyCount("Behavior2")).toBe("1");
    expect(screen.getByRole("button", { name: /^Behavior1,/ })).toBeDisabled();
    expect(useBehaviorsStore.getState().behaviors.map((b) => b.name)).toEqual([
      "Scratching",
      "Grooming",
      "Rearing",
      "Behavior1",
      "Behavior2"
    ]);
  });

  it("reads back its own JSON export after a reload", async () => {
    const { user } = await scoredVideo();
    const downloads = captureDownloads();
    await exportAs(user, "Scores \\(JSON\\)");
    const exported = await downloads.blobs[0]!.text();
    cleanup();
    resetStores();

    const fresh = userEvent.setup();
    render(<App />);
    await fresh.upload(
      screen.getByLabelText("Import"),
      jsonFile(exported, "cage-07-scores.json")
    );

    expect(
      await screen.findByText(
        "Showing 2 episodes from cage-07-scores.json. Open the matching video to keep scoring."
      )
    ).toBeVisible();
    expect(tallyCount("Scratching")).toBe("1");
    expect(tallyCount("Grooming")).toBe("1");
  });

  it.each([
    [
      "not JSON",
      "{oops",
      "This file could not be read as JSON. Choose a .json file exported from the app."
    ],
    [
      "some other JSON",
      { hello: "world" },
      "This file does not look like scores from Video Keypress. Choose a .json file exported from the app."
    ]
  ])(
    "explains why a file that is %s cannot be imported",
    async (_label, content, message) => {
      const user = userEvent.setup();
      render(<App />);

      await user.upload(screen.getByLabelText("Import"), jsonFile(content));

      expect(await screen.findByText(message)).toBeVisible();
      expect(screen.getByText("Drop a video here")).toBeVisible();
    }
  );

  it("adds imported episodes to a video that already has some", async () => {
    const { user } = await scoredVideo();

    await user.upload(
      screen.getByLabelText("Import"),
      jsonFile({
        ...V1_FILE,
        metadata: { ...V1_FILE.metadata, fileName: "cage-07.mp4" }
      })
    );
    const dialog = await screen.findByRole("dialog", { name: "Import scores" });
    expect(dialog).toHaveTextContent(
      "This video already has 2 episodes. Add the 3 imported episodes to them, or replace them?"
    );
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(useSessionStore.getState().session?.episodes).toHaveLength(5);
  });

  it("replaces a video's episodes when asked", async () => {
    const { user } = await scoredVideo();

    await user.upload(
      screen.getByLabelText("Import"),
      jsonFile({
        ...V1_FILE,
        metadata: { ...V1_FILE.metadata, fileName: "cage-07.mp4" }
      })
    );
    await user.click(await screen.findByRole("button", { name: "Replace" }));

    expect(
      useSessionStore.getState().session?.episodes.map((e) => [e.start, e.end])
    ).toEqual([
      [1.234, 4.037],
      [5, 6],
      [8, 9]
    ]);
  });

  it("asks before importing scores recorded on a different video", async () => {
    const { user } = await renderAppWithVideo({ name: "cage-07.mp4" });

    await user.upload(screen.getByLabelText("Import"), jsonFile(V1_FILE));
    const dialog = await screen.findByRole("dialog", {
      name: "Import scores for another file?"
    });
    expect(dialog).toHaveTextContent(
      "These scores are for old-cage.mp4, and the open video is cage-07.mp4."
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(useSessionStore.getState().session?.episodes).toEqual([]);
  });

  it("attaches imported scores to the next video opened, and saves them", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(
      screen.getByLabelText("Or open saved scores (JSON)"),
      jsonFile(V1_FILE)
    );

    await user.upload(
      within(screen.getByRole("banner")).getByLabelText("Open video"),
      videoFile({ name: "old-cage.mp4" })
    );
    await user.click(await screen.findByRole("button", { name: "Attach" }));

    const session = useSessionStore.getState().session;
    expect(session?.fingerprint).toBe("old-cage.mp4|1|1");
    expect(session?.episodes).toHaveLength(3);
    expect(
      localStorage.getItem("video-keypress:session:old-cage.mp4|1|1")
    ).not.toBeNull();
  });
});
