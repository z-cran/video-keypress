/**
 * Serving a picked video through the service worker, in pieces.
 *
 * WebKit on iPad asks for the whole rest of a video in one request
 * (`Range: bytes=0-<size-1>`). Served from a `blob:` URL, a multi-gigabyte
 * file stalls after a few seconds. Answering each request with at most
 * `MAX_RANGE_BYTES` as `206 Partial Content` makes the player ask for the
 * next piece instead (ADR-017).
 */

/**
 * Largest answer to one range request. In the iPadOS simulator, with a 4 GB,
 * 45 Mbps file, a seek 10 minutes in took 0.5 s at 4 MiB and 8.6 s at 8 MiB,
 * because the player waits out the larger answers already in flight.
 * Playback stayed 5 to 8 s ahead at 4 MiB.
 */
export const MAX_RANGE_BYTES = 4 * 1024 * 1024;

/** Path under the app's base where the worker serves open videos. */
export const VIDEO_PATH = "__video/";

export interface RangePlan {
  status: 200 | 206 | 416;
  /** First byte, inclusive. */
  start: number;
  /** Last byte, inclusive; `start - 1` for an empty body. */
  end: number;
}

const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/i;

/**
 * What to send for a `Range` header against a file of `size` bytes. Only
 * single ranges are honored; a malformed or multi-range header is ignored,
 * which RFC 9110 allows, and the whole file is sent.
 */
export function planRange(
  header: string | null,
  size: number,
  maxBytes: number
): RangePlan {
  const whole: RangePlan = { status: 200, start: 0, end: size - 1 };
  const match = header === null ? null : SINGLE_RANGE.exec(header.trim());
  if (!match) return whole;
  const [, first = "", last = ""] = match;
  if (first === "" && last === "") return whole;

  let start: number;
  let end: number;
  if (first === "") {
    // Suffix form: the last n bytes.
    start = Math.max(0, size - Number(last));
    end = size - 1;
    if (Number(last) === 0) start = size; // asks for nothing: unsatisfiable
  } else {
    start = Number(first);
    if (last !== "" && Number(last) < start) return whole; // invalid
    end = last === "" ? size - 1 : Math.min(Number(last), size - 1);
  }
  if (start >= size) return { status: 416, start: 0, end: -1 };

  const limit =
    Number.isFinite(maxBytes) && maxBytes >= 1
      ? Math.floor(maxBytes)
      : Infinity;
  if (end - start + 1 > limit) end = start + limit - 1;
  return { status: 206, start, end };
}

/** Response headers for a planned range of a file. */
export function rangeHeaders(
  plan: RangePlan,
  size: number,
  type: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store"
  };
  if (plan.status === 416) {
    headers["Content-Range"] = `bytes */${size}`;
    return headers;
  }
  headers["Content-Length"] = String(plan.end - plan.start + 1);
  // Without a type (e.g. .mkv), let the browser sniff rather than guess.
  if (type) headers["Content-Type"] = type;
  if (plan.status === 206) {
    headers["Content-Range"] = `bytes ${plan.start}-${plan.end}/${size}`;
  }
  return headers;
}

/** The URL the `<video>` loads an open file from. */
export function videoUrl(base: string, id: string): string {
  return `${base}${VIDEO_PATH}${encodeURIComponent(id)}`;
}

/** The open file's id if `url` is one of the worker's video URLs, else null. */
export function videoIdFromUrl(url: string, scope: string): string | null {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return null;
  }
  const prefix = `${scope.endsWith("/") ? scope : `${scope}/`}${VIDEO_PATH}`;
  const path = target.origin + target.pathname;
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  if (rest === "" || rest.includes("/")) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return null;
  }
}

const PUT = "video-keypress:put";
const FORGET = "video-keypress:forget";
const NEED_FILE = "video-keypress:need-file";
const FILE = "video-keypress:file";

/** Page to worker: serve this file under this id. */
export interface PutMessage {
  type: typeof PUT;
  id: string;
  file: Blob;
}
/** Page to worker: the video was closed or replaced. */
export interface ForgetMessage {
  type: typeof FORGET;
  id: string;
}
/** Worker to page: send this file again (a stopped worker lost it). */
export interface NeedFileMessage {
  type: typeof NEED_FILE;
  id: string;
}
/** Page to worker, on the reply port: the file, or null if it is closed. */
export interface FileReply {
  type: typeof FILE;
  id: string;
  file: Blob | null;
}

export const putMessage = (id: string, file: Blob): PutMessage => ({
  type: PUT,
  id,
  file
});
export const forgetMessage = (id: string): ForgetMessage => ({
  type: FORGET,
  id
});
export const needFileMessage = (id: string): NeedFileMessage => ({
  type: NEED_FILE,
  id
});
export const fileReply = (id: string, file: Blob | null): FileReply => ({
  type: FILE,
  id,
  file
});

function hasTypeAndId(
  message: unknown,
  type: string
): message is { type: string; id: string } {
  if (typeof message !== "object" || message === null) return false;
  const { type: actual, id } = message as { type?: unknown; id?: unknown };
  return actual === type && typeof id === "string";
}

export function isPutMessage(message: unknown): message is PutMessage {
  return (
    hasTypeAndId(message, PUT) &&
    (message as { file?: unknown }).file instanceof Blob
  );
}

export function isForgetMessage(message: unknown): message is ForgetMessage {
  return hasTypeAndId(message, FORGET);
}

export function isNeedFileMessage(
  message: unknown
): message is NeedFileMessage {
  return hasTypeAndId(message, NEED_FILE);
}

export function isFileReply(message: unknown): message is FileReply {
  if (!hasTypeAndId(message, FILE)) return false;
  const { file } = message as { file?: unknown };
  return file === null || file instanceof Blob;
}
