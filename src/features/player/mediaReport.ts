import { formatClock } from "../../lib/time.ts";

/** What a media element reports at one moment, as plain data. */
export interface MediaSnapshot {
  currentTime: number;
  duration: number;
  paused: boolean;
  readyState: number;
  networkState: number;
  /** Buffered `[start, end]` ranges in seconds. */
  buffered: readonly (readonly [number, number])[];
  error: { code: number; message: string } | null;
}

/** The parts of `HTMLMediaElement` that `snapshotOf` reads. */
export interface MediaLike {
  currentTime: number;
  duration: number;
  paused: boolean;
  readyState: number;
  networkState: number;
  /** Optional: jsdom and some embedded views leave it out. */
  buffered?: {
    length: number;
    start(index: number): number;
    end(index: number): number;
  } | null;
  error: { code: number; message: string } | null;
}

export interface MediaEvent {
  /** Seconds since logging started. */
  at: number;
  type: string;
  currentTime: number;
  readyState: number;
  networkState: number;
  /** Repeats of this type in a row, folded into one entry. */
  count: number;
}

export interface FileInfo {
  name: string;
  type: string;
  size: number;
}

export function snapshotOf(media: MediaLike): MediaSnapshot {
  const ranges = media.buffered;
  const buffered: [number, number][] = [];
  for (let i = 0; ranges && i < ranges.length; i++) {
    buffered.push([ranges.start(i), ranges.end(i)]);
  }
  return {
    currentTime: media.currentTime,
    duration: media.duration,
    paused: media.paused,
    readyState: media.readyState,
    networkState: media.networkState,
    buffered,
    error: media.error
      ? { code: media.error.code, message: media.error.message }
      : null
  };
}

/**
 * Add an event to the log, keeping only the newest `max`. A repeat of the
 * last event's type is folded into it, so a burst of `progress` events does
 * not push the `waiting` that matters out of the log.
 */
export function appendEvent(
  log: readonly MediaEvent[],
  event: Omit<MediaEvent, "count">,
  max: number
): MediaEvent[] {
  if (Number.isNaN(max) || max <= 0) return [];
  const last = log.at(-1);
  const next =
    last?.type === event.type
      ? [...log.slice(0, -1), { ...event, count: last.count + 1 }]
      : [...log, { ...event, count: 1 }];
  return next.length > max ? next.slice(next.length - Math.floor(max)) : next;
}

const READY_STATES = [
  "nothing",
  "metadata",
  "current frame",
  "future data",
  "enough data"
];
const NETWORK_STATES = ["empty", "idle", "loading", "no source"];

export function readyStateLabel(state: number): string {
  return `${state} · ${READY_STATES[state] ?? "unknown"}`;
}

export function networkStateLabel(state: number): string {
  return `${state} · ${NETWORK_STATES[state] ?? "unknown"}`;
}

/** Seconds buffered past the playhead; 0 when the playhead is not buffered. */
export function bufferedAhead({
  currentTime,
  buffered
}: Pick<MediaSnapshot, "currentTime" | "buffered">): number {
  if (!Number.isFinite(currentTime)) return 0;
  const range = buffered.find(
    ([start, end]) => start <= currentTime && currentTime <= end
  );
  return range ? Math.max(0, range[1] - currentTime) : 0;
}

export function formatBuffered(buffered: MediaSnapshot["buffered"]): string {
  if (buffered.length === 0) return "Nothing yet";
  return buffered
    .map(([start, end]) => `${formatClock(start, 1)} to ${formatClock(end, 1)}`)
    .join(", ");
}

/** File sizes in the decimal units iPadOS shows in Files. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown size";
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  const units = ["kB", "MB", "GB", "TB"];
  let value = bytes / 1000;
  let unit = 0;
  // Compare the rounded value so 999,950 bytes reads 1.0 MB, not 1000.0 kB.
  while (Number(value.toFixed(1)) >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

export function describeMedia(
  snapshot: MediaSnapshot
): { label: string; value: string }[] {
  const ahead = bufferedAhead(snapshot);
  const { error } = snapshot;
  return [
    {
      label: "Position",
      value: `${formatClock(snapshot.currentTime, 2)} of ${formatClock(snapshot.duration, 2)}`
    },
    { label: "Playback", value: snapshot.paused ? "Paused" : "Playing" },
    { label: "Ready state", value: readyStateLabel(snapshot.readyState) },
    { label: "Network", value: networkStateLabel(snapshot.networkState) },
    { label: "Buffered", value: formatBuffered(snapshot.buffered) },
    {
      label: "Buffered ahead",
      value: Number.isFinite(ahead) ? `${ahead.toFixed(1)} s` : "to the end"
    },
    {
      label: "Error",
      value: error ? `${error.code} · ${error.message || "no message"}` : "None"
    }
  ];
}

export function formatEventLine(event: MediaEvent): string {
  const repeats = event.count > 1 ? ` x${event.count}` : "";
  return [
    `${event.at.toFixed(2)} s`,
    `${event.type}${repeats}`,
    `at ${formatClock(event.currentTime, 2)}`,
    `ready ${event.readyState}`,
    `network ${event.networkState}`
  ].join(" · ");
}

export interface ReportInput {
  /** Which page wrote the report: the app or the bare media check. */
  page: string;
  version: string;
  userAgent: string;
  /** iPad Safari reports a Mac user agent; touch points tell them apart. */
  touchPoints: number;
  file: FileInfo | null;
  snapshot: MediaSnapshot | null;
  events: readonly MediaEvent[];
}

/** Plain text a researcher can paste into a message about a playback problem. */
export function formatReport(input: ReportInput): string {
  const { file, snapshot, events } = input;
  // Typed as a number, but missing in jsdom and some embedded browsers.
  const touch = Number.isFinite(input.touchPoints)
    ? `${input.touchPoints} touch points`
    : "touch points unknown";
  return [
    "Video Keypress media report",
    `Page: ${input.page} · version ${input.version}`,
    `Browser: ${input.userAgent} · ${touch}`,
    file
      ? `File: ${file.name} · ${file.type || "no type"} · ${formatBytes(file.size)}`
      : "File: none chosen",
    ...(snapshot
      ? describeMedia(snapshot).map(({ label, value }) => `${label}: ${value}`)
      : ["Video: no state reported yet"]),
    "Events, oldest first:",
    ...(events.length > 0 ? events.map(formatEventLine) : ["None yet"])
  ].join("\n");
}

/** Debug switches read from the page URL's query string. */
export function urlFlags(search: string): {
  debugMedia: boolean;
  mediaCheck: boolean;
} {
  const params = new URLSearchParams(search);
  return {
    debugMedia: params.getAll("debug").includes("media"),
    mediaCheck: params.has("mediacheck")
  };
}
