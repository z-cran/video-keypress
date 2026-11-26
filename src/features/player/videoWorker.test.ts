// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fileReply,
  forgetMessage,
  isNeedFileMessage,
  putMessage
} from "./videoStream.ts";
import {
  installVideoWorker,
  type ExtendableEventLike,
  type FetchEventLike,
  type MessageEventLike,
  type VideoWorkerOptions,
  type WorkerClient,
  type WorkerScope
} from "./videoWorker.ts";

const SCOPE = "https://example.test/video-keypress/";

/** 100 bytes whose values are their own offsets, so slices are easy to check. */
const video = () =>
  new Blob([Uint8Array.from({ length: 100 }, (_, i) => i)], {
    type: "video/mp4"
  });

/** A page that answers the worker's request for a file with `file`. */
function page(file: Blob | null): WorkerClient & { asked: number } {
  const client = {
    asked: 0,
    postMessage(message: unknown, [port]: Transferable[]) {
      client.asked++;
      if (isNeedFileMessage(message)) {
        (port as MessagePort).postMessage(fileReply(message.id, file));
      }
    }
  };
  return client;
}

/** A page that never answers. */
const silentPage: WorkerClient = { postMessage() {} };

function install(
  {
    requester,
    windows = []
  }: { requester?: WorkerClient; windows?: WorkerClient[] } = {},
  options: VideoWorkerOptions = { maxBytes: 16 }
) {
  const listeners = new Map<string, (event: never) => void>();
  const calls = { skipWaiting: 0, claim: 0 };
  const scope = {
    registration: { scope: SCOPE },
    clients: {
      claim: () => {
        calls.claim++;
        return Promise.resolve();
      },
      get: () => Promise.resolve(requester),
      matchAll: () => Promise.resolve(windows)
    },
    skipWaiting: () => {
      calls.skipWaiting++;
      return Promise.resolve();
    },
    addEventListener: (type: string, listener: (event: never) => void) => {
      listeners.set(type, listener);
    }
  } as WorkerScope;
  installVideoWorker(scope, options);

  const dispatch = <E>(type: string, event: E) =>
    (listeners.get(type) as (event: E) => void)(event);

  return {
    calls,
    send: (data: unknown) => dispatch<MessageEventLike>("message", { data }),
    lifecycle(type: "install" | "activate") {
      let pending: Promise<unknown> = Promise.resolve();
      dispatch<ExtendableEventLike>(type, {
        waitUntil: (p) => {
          pending = p;
        }
      });
      return pending;
    },
    /** The worker's answer, or undefined if it left the request alone. */
    fetch(path: string, init?: RequestInit, clientId = "page-1") {
      let answer: Promise<Response> | undefined;
      dispatch<FetchEventLike>("fetch", {
        request: new Request(SCOPE + path, init),
        clientId,
        respondWith: (response) => {
          answer = response;
        }
      });
      return answer;
    }
  };
}

const bytesOf = async (response: Response) =>
  Array.from(new Uint8Array(await response.arrayBuffer()));

afterEach(() => {
  vi.useRealTimers();
});

describe("video service worker", () => {
  it("serves the requested byte range of a file the page handed over", async () => {
    const worker = install();
    worker.send(putMessage("v1", video()));

    const response = await worker.fetch("__video/v1", {
      headers: { Range: "bytes=10-19" }
    })!;

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 10-19/100");
    expect(await bytesOf(response)).toEqual([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19
    ]);
  });

  it("answers an open-ended range with at most the cap", async () => {
    const worker = install({}, { maxBytes: 16 });
    worker.send(putMessage("v1", video()));

    const response = await worker.fetch("__video/v1", {
      headers: { Range: "bytes=0-99" }
    })!;

    expect(response.headers.get("Content-Range")).toBe("bytes 0-15/100");
    expect(await bytesOf(response)).toHaveLength(16);
  });

  it("answers a range past the end with 416", async () => {
    const worker = install();
    worker.send(putMessage("v1", video()));

    const response = await worker.fetch("__video/v1", {
      headers: { Range: "bytes=100-" }
    })!;

    expect(response.status).toBe(416);
    expect(response.headers.get("Content-Range")).toBe("bytes */100");
  });

  it("answers HEAD with the size and no body", async () => {
    const worker = install();
    worker.send(putMessage("v1", video()));

    const response = await worker.fetch("__video/v1", { method: "HEAD" })!;

    expect(response.headers.get("Content-Length")).toBe("100");
    expect(response.body).toBeNull();
  });

  it.each(["assets/index.js", "", "__video/"])(
    "leaves the request for %j to the browser",
    (path) => {
      const worker = install();

      expect(worker.fetch(path)).toBeUndefined();
    }
  );

  it("asks the requesting page for a file it lost when it was stopped", async () => {
    const requester = page(video());
    const worker = install({ requester });

    const response = await worker.fetch("__video/v1", {
      headers: { Range: "bytes=0-3" }
    })!;

    expect(await bytesOf(response)).toEqual([0, 1, 2, 3]);
  });

  it("keeps a file the page sent back instead of asking every time", async () => {
    const requester = page(video());
    const worker = install({ requester });
    await worker.fetch("__video/v1")!;

    await worker.fetch("__video/v1")!;

    expect(requester.asked).toBe(1);
  });

  it("asks the open windows when the request names no page", async () => {
    const worker = install({ windows: [page(null), page(video())] });

    const response = await worker.fetch("__video/v1", undefined, "")!;

    expect(response.status).toBe(200);
  });

  it("answers 404 with a next step when no page has the file", async () => {
    const worker = install({ requester: page(null) });

    const response = await worker.fetch("__video/v1")!;

    expect(response.status).toBe(404);
    expect(await response.text()).toMatch(/Choose it again/);
  });

  it("gives up on a page that does not answer", async () => {
    vi.useFakeTimers();
    const worker = install(
      { requester: silentPage },
      { maxBytes: 16, askTimeoutMs: 3000 }
    );

    const answer = worker.fetch("__video/v1")!;
    await vi.advanceTimersByTimeAsync(3000);

    expect((await answer).status).toBe(404);
  });

  it("forgets a file the page closed", async () => {
    const worker = install();
    worker.send(putMessage("v1", video()));

    worker.send(forgetMessage("v1"));

    expect((await worker.fetch("__video/v1")!).status).toBe(404);
  });

  it.each([
    ["no file", { type: "video-keypress:put", id: "v1" }],
    [
      "a file that is not a Blob",
      { type: "video-keypress:put", id: "v1", file: "x" }
    ],
    ["a numeric id", { type: "video-keypress:put", id: 1, file: video() }],
    ["no message", null]
  ])("ignores a put message with %s", async (_, message) => {
    const worker = install();

    worker.send(message);

    expect((await worker.fetch("__video/v1")!).status).toBe(404);
  });

  it("activates without waiting for old pages to close", async () => {
    const worker = install();

    await worker.lifecycle("install");

    expect(worker.calls.skipWaiting).toBe(1);
  });

  it("takes control of open pages when it activates", async () => {
    const worker = install();

    await worker.lifecycle("activate");

    expect(worker.calls.claim).toBe(1);
  });
});
