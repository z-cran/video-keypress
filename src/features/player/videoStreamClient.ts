import { newId } from "../../lib/id.ts";
import {
  fileReply,
  forgetMessage,
  isNeedFileMessage,
  putMessage,
  videoUrl
} from "./videoStream.ts";

export type StreamVia = "service worker" | "blob URL";

export interface VideoStream {
  url: string;
  via: StreamVia;
  /** Stop serving the file: revoke the blob URL or tell the worker to drop it. */
  release: () => void;
}

/** Files the worker may ask for again after the browser stopped it. */
const open = new Map<string, Blob>();
let answering: ServiceWorkerContainer | null = null;

/** Missing outside secure contexts, e.g. the dev server on a LAN address. */
function workers(): ServiceWorkerContainer | null {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator
    ? navigator.serviceWorker
    : null;
}

function answerWorker(container: ServiceWorkerContainer) {
  if (answering === container) return;
  answering = container;
  container.addEventListener("message", (event) => {
    const data: unknown = event.data;
    if (!isNeedFileMessage(data)) return;
    event.ports[0]?.postMessage(fileReply(data.id, open.get(data.id) ?? null));
  });
}

/**
 * Install the worker that serves large videos in pieces (ADR-017). Builds
 * only: `npm run dev` does not serve video-sw.js, so it plays from blob URLs.
 */
export function registerVideoServiceWorker(
  base = import.meta.env.BASE_URL
): void {
  const container = workers();
  if (!container || import.meta.env.DEV) return;
  answerWorker(container);
  container.register(`${base}video-sw.js`, { scope: base }).catch(() => {
    // Private browsing or blocked site data. Blob URLs still play.
  });
}

/**
 * A URL the `<video>` can load `file` from. Through the service worker when
 * one controls the page, so large files stream in capped ranges; otherwise
 * a blob URL, which stalls on iPad for multi-gigabyte files.
 */
export function openVideoStream(
  file: Blob,
  { preferBlob = false }: { preferBlob?: boolean } = {}
): VideoStream {
  const container = preferBlob ? null : workers();
  const controller = container?.controller;
  if (container && controller) {
    const id = newId();
    try {
      controller.postMessage(putMessage(id, file));
      answerWorker(container);
      open.set(id, file);
      return {
        url: videoUrl(import.meta.env.BASE_URL, id),
        via: "service worker",
        release: () => {
          open.delete(id);
          workers()?.controller?.postMessage(forgetMessage(id));
        }
      };
    } catch {
      // The worker could not take the file; fall back to a blob URL.
    }
  }
  const url = URL.createObjectURL(file);
  return { url, via: "blob URL", release: () => URL.revokeObjectURL(url) };
}
