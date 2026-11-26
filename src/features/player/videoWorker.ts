import {
  isFileReply,
  isForgetMessage,
  isPutMessage,
  MAX_RANGE_BYTES,
  needFileMessage,
  planRange,
  rangeHeaders,
  videoIdFromUrl
} from "./videoStream.ts";

/*
 * The parts of ServiceWorkerGlobalScope this worker uses. Typed here rather
 * than with the WebWorker lib, which clashes with the app's DOM types, so the
 * worker builds with the app and runs in tests against a fake scope.
 */
export interface WorkerClient {
  postMessage(message: unknown, transfer: Transferable[]): void;
}
export interface ExtendableEventLike {
  waitUntil(promise: Promise<unknown>): void;
}
export interface MessageEventLike {
  readonly data: unknown;
}
export interface FetchEventLike {
  readonly request: Request;
  readonly clientId: string;
  respondWith(response: Promise<Response>): void;
}
export interface WorkerScope {
  readonly registration: { readonly scope: string };
  readonly clients: {
    claim(): Promise<void>;
    get(id: string): Promise<WorkerClient | undefined>;
    matchAll(options: { type: "window" }): Promise<readonly WorkerClient[]>;
  };
  skipWaiting(): Promise<void>;
  addEventListener(
    type: "install" | "activate",
    listener: (event: ExtendableEventLike) => void
  ): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEventLike) => void
  ): void;
  addEventListener(
    type: "fetch",
    listener: (event: FetchEventLike) => void
  ): void;
}

export interface VideoWorkerOptions {
  maxBytes?: number;
  /** How long to wait for a page to send back a file the worker lost. */
  askTimeoutMs?: number;
}

const GONE =
  "This video is no longer open here. Choose it again in Video Keypress.";

/**
 * Serve videos the page hands over (`put`) at `<scope>__video/<id>`, one
 * capped byte range at a time. Every other request is left to the browser,
 * so the worker never caches the app and cannot serve a stale version.
 */
export function installVideoWorker(
  scope: WorkerScope,
  { maxBytes = MAX_RANGE_BYTES, askTimeoutMs = 3000 }: VideoWorkerOptions = {}
): void {
  const files = new Map<string, Blob>();

  // Take over open pages at once, so a first visit plays through the worker
  // without a reload.
  scope.addEventListener("install", (event) => {
    event.waitUntil(scope.skipWaiting());
  });
  scope.addEventListener("activate", (event) => {
    event.waitUntil(scope.clients.claim());
  });

  scope.addEventListener("message", ({ data }) => {
    if (isPutMessage(data)) files.set(data.id, data.file);
    else if (isForgetMessage(data)) files.delete(data.id);
  });

  scope.addEventListener("fetch", (event) => {
    const id = videoIdFromUrl(event.request.url, scope.registration.scope);
    if (id === null) return;
    event.respondWith(respond(event, id));
  });

  async function respond(event: FetchEventLike, id: string) {
    const file = await fileFor(id, event.clientId);
    if (!file) {
      return new Response(GONE, {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    }
    const plan = planRange(
      event.request.headers.get("range"),
      file.size,
      maxBytes
    );
    const body =
      plan.status === 416 || event.request.method === "HEAD"
        ? null
        : file.slice(plan.start, plan.end + 1);
    return new Response(body, {
      status: plan.status,
      headers: rangeHeaders(plan, file.size, file.type)
    });
  }

  /**
   * Browsers stop idle workers, which drops the files they were handed.
   * Ask the page that made the request, or any open window, to send it again.
   */
  async function fileFor(id: string, clientId: string) {
    const known = files.get(id);
    if (known) return known;
    const requester = clientId ? await scope.clients.get(clientId) : undefined;
    const candidates = requester
      ? [requester]
      : await scope.clients.matchAll({ type: "window" });
    for (const client of candidates) {
      const file = await askClient(client, id);
      if (file) {
        files.set(id, file);
        return file;
      }
    }
    return null;
  }

  function askClient(client: WorkerClient, id: string) {
    return new Promise<Blob | null>((resolve) => {
      const channel = new MessageChannel();
      const finish = (file: Blob | null) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(file);
      };
      const timer = setTimeout(() => finish(null), askTimeoutMs);
      channel.port1.onmessage = ({ data }: MessageEvent) => {
        finish(isFileReply(data) && data.id === id ? data.file : null);
      };
      try {
        client.postMessage(needFileMessage(id), [channel.port2]);
      } catch {
        finish(null);
      }
    });
  }
}
