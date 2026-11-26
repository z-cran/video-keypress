import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Root from "../../Root.tsx";
import { renderAppWithVideo, videoFile } from "../../test/renderApp.tsx";
import { fileReply, forgetMessage, needFileMessage } from "./videoStream.ts";

/**
 * Stand in for navigator.serviceWorker. jsdom has none, so without this the
 * app takes its blob URL fallback.
 */
function installWorker({ controlling = true } = {}) {
  const postMessage = vi.fn();
  const container = Object.assign(new EventTarget(), {
    controller: controlling ? { postMessage } : null
  });
  Object.defineProperty(navigator, "serviceWorker", {
    value: container,
    configurable: true
  });
  /** The worker asks the page for a file, as it does after a restart. */
  const ask = (id: string) => {
    const port = { postMessage: vi.fn() };
    container.dispatchEvent(
      Object.assign(new Event("message"), {
        data: needFileMessage(id),
        ports: [port]
      })
    );
    return port.postMessage;
  };
  return { postMessage, ask };
}

/** A worker URL under the app's base (Vitest serves from "/"). */
const WORKER_URL = new RegExp(`^${import.meta.env.BASE_URL}__video/[^/]+$`);

/** The id at the end of a worker URL such as /video-keypress/__video/<id>. */
const idOf = (video: HTMLElement) =>
  decodeURIComponent(video.getAttribute("src")!.split("/__video/")[1]!);

afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  window.history.replaceState(null, "", "/");
});

describe("loading the video through the service worker", () => {
  it("streams the chosen video through the worker when one controls the page", async () => {
    installWorker();

    const { video } = await renderAppWithVideo();

    expect(video).toHaveAttribute("src", expect.stringMatching(WORKER_URL));
  });

  it("hands the worker the chosen file", async () => {
    const { postMessage } = installWorker();

    const { video, file } = await renderAppWithVideo();

    expect(postMessage).toHaveBeenCalledWith({
      type: "video-keypress:put",
      id: idOf(video),
      file
    });
  });

  it.each([
    ["the browser has no service workers", () => {}],
    [
      "the worker does not control the page yet",
      () => installWorker({ controlling: false })
    ]
  ])("falls back to a blob URL when %s", async (_, setup) => {
    setup();

    const { video } = await renderAppWithVideo();

    expect(video).toHaveAttribute("src", expect.stringMatching(/^blob:/));
  });

  it("sends the file again when a restarted worker asks for it", async () => {
    const { ask } = installWorker();
    const { video, file } = await renderAppWithVideo();

    const reply = ask(idOf(video));

    expect(reply).toHaveBeenCalledWith(fileReply(idOf(video), file));
  });

  it("tells the worker to drop the previous video when another opens", async () => {
    const { postMessage } = installWorker();
    const { user, video } = await renderAppWithVideo({ name: "first.mp4" });
    const firstId = idOf(video);

    await user.upload(
      screen.getByLabelText("Open video"),
      videoFile({ name: "second.mp4", lastModified: 2 })
    );

    expect(postMessage).toHaveBeenCalledWith(forgetMessage(firstId));
  });

  it("no longer hands out a video that was replaced", async () => {
    const { ask } = installWorker();
    const { user, video } = await renderAppWithVideo({ name: "first.mp4" });
    const firstId = idOf(video);
    await user.upload(
      screen.getByLabelText("Open video"),
      videoFile({ name: "second.mp4", lastModified: 2 })
    );

    const reply = ask(firstId);

    expect(reply).toHaveBeenCalledWith(fileReply(firstId, null));
  });

  it("names the worker as the source in the diagnostics report", async () => {
    installWorker();
    window.history.replaceState(null, "", "/?debug=media");
    const { user } = await renderAppWithVideo();

    await user.click(screen.getByRole("button", { name: "Copy report" }));

    expect(await navigator.clipboard.readText()).toContain(
      "Source: service worker"
    );
  });
});

describe("media check page load choice", () => {
  it.each([
    ["Service worker when available", WORKER_URL],
    ["Blob URL", /^blob:/]
  ])("loads with %s when chosen", async (choice, src) => {
    installWorker();
    window.history.replaceState(null, "", "/?mediacheck");
    const user = userEvent.setup();
    render(<Root />);

    await user.click(screen.getByRole("radio", { name: choice }));
    await user.upload(screen.getByLabelText("Choose a video"), videoFile());

    expect(screen.getByLabelText("Video")).toHaveAttribute(
      "src",
      expect.stringMatching(src)
    );
  });

  it("reloads the open video when the choice changes", async () => {
    installWorker();
    window.history.replaceState(null, "", "/?mediacheck");
    const user = userEvent.setup();
    render(<Root />);
    await user.upload(screen.getByLabelText("Choose a video"), videoFile());

    await user.click(screen.getByRole("radio", { name: "Blob URL" }));

    expect(screen.getByLabelText("Video")).toHaveAttribute(
      "src",
      expect.stringMatching(/^blob:/)
    );
  });
});
