import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Root from "../../Root.tsx";
import { renderAppWithVideo, videoFile } from "../../test/renderApp.tsx";

/** The flags are read from the URL when the app renders. */
function openAt(search: string) {
  window.history.replaceState(null, "", `/${search}`);
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

function fire(el: HTMLElement, type: string) {
  act(() => {
    el.dispatchEvent(new Event(type));
  });
}

describe("media diagnostics in the app", () => {
  it("stays hidden without ?debug=media", async () => {
    await renderAppWithVideo();

    expect(
      screen.queryByRole("region", { name: "Media diagnostics" })
    ).not.toBeInTheDocument();
  });

  it("logs a stall the video reports", async () => {
    openAt("?debug=media");
    const { video } = await renderAppWithVideo();

    fire(video, "waiting");

    const log = screen.getByRole("list", { name: "Media events" });
    expect(within(log).getByText(/· waiting ·/)).toBeInTheDocument();
  });

  it("does not log timeupdate, which fires several times a second", async () => {
    openAt("?debug=media");
    const { video } = await renderAppWithVideo();

    fire(video, "timeupdate");

    const log = screen.getByRole("list", { name: "Media events" });
    expect(within(log).queryByText(/timeupdate/)).not.toBeInTheDocument();
  });

  it("copies a report naming the file and the stall", async () => {
    openAt("?debug=media");
    const { user, video } = await renderAppWithVideo({ name: "cage-04.mp4" });
    fire(video, "stalled");

    await user.click(screen.getByRole("button", { name: "Copy report" }));

    const report = await navigator.clipboard.readText();
    expect(report).toContain("File: cage-04.mp4 · video/mp4");
    expect(report).toMatch(/· stalled ·/);
  });

  it("confirms the copy so the researcher knows to paste it", async () => {
    openAt("?debug=media");
    const { user } = await renderAppWithVideo();

    await user.click(screen.getByRole("button", { name: "Copy report" }));

    expect(await screen.findByText(/Report copied/)).toBeVisible();
  });

  it.each([
    [
      "rejects the write",
      () => Promise.reject(new DOMException("blocked", "NotAllowedError"))
    ],
    [
      "has no clipboard (not HTTPS)",
      () => {
        throw new TypeError("clipboard is undefined");
      }
    ]
  ])(
    "shows the report to copy by hand when the browser %s",
    async (_, writeText) => {
      openAt("?debug=media");
      const { user } = await renderAppWithVideo({ name: "cage-04.mp4" });
      vi.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);

      await user.click(screen.getByRole("button", { name: "Copy report" }));

      const box = await screen.findByRole<HTMLTextAreaElement>("textbox", {
        name: "Media report"
      });
      expect(box.value).toContain("File: cage-04.mp4");
    }
  );
});

describe("media check page", () => {
  async function renderMediaCheck() {
    openAt("?mediacheck");
    const user = userEvent.setup();
    render(<Root />);
    const input = screen.getByLabelText<HTMLInputElement>("Choose a video");
    const file = videoFile({ name: "cage-04.mov" });
    await user.upload(input, file);
    return { input, file, video: screen.getByLabelText("Video") };
  }

  it("plays the chosen file in a bare player without the scoring workspace", async () => {
    const { video } = await renderMediaCheck();

    expect(video).toHaveAttribute("src", expect.stringMatching(/^blob:/));
    expect(
      screen.queryByRole("region", { name: "Triggers" })
    ).not.toBeInTheDocument();
  });

  it("keeps the chosen file in its input, unlike the app's picker", async () => {
    const { input, file } = await renderMediaCheck();

    expect(input.files?.[0]).toBe(file);
  });

  it("logs the bare player's media events", async () => {
    const { video } = await renderMediaCheck();

    fire(video, "waiting");

    const log = screen.getByRole("list", { name: "Media events" });
    expect(within(log).getByText(/· waiting ·/)).toBeInTheDocument();
  });
});
