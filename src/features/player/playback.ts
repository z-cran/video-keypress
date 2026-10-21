import { clamp } from "../../lib/time.ts";

export const RATE_STEP = 0.25;
export const MIN_RATE = 0.25;
export const MAX_RATE = 2;
export const RATES: readonly number[] = Array.from(
  { length: (MAX_RATE - MIN_RATE) / RATE_STEP + 1 },
  (_, i) => MIN_RATE + i * RATE_STEP
);

export const SEEK_STEP = 5;
export const FINE_SEEK_STEP = 1;
/** Browsers do not expose the frame rate; 1/30 s is one frame at 30 fps. */
export const FRAME_STEP = 1 / 30;

const EPSILON = 1e-9;

/** The next speed up or down on the 0.25 grid, clamped to 0.25..2. */
export function stepRate(rate: number, direction: 1 | -1): number {
  const from = Number.isFinite(rate) ? rate : 1;
  if (direction > 0) {
    return RATES.find((r) => r > from + EPSILON) ?? MAX_RATE;
  }
  return RATES.findLast((r) => r < from - EPSILON) ?? MIN_RATE;
}

/** Nearest allowed speed, for values read back from storage. */
export function snapRate(rate: unknown): number {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return 1;
  const snapped = Math.round(rate / RATE_STEP) * RATE_STEP;
  return clamp(snapped, MIN_RATE, MAX_RATE);
}

export function formatRate(rate: number): string {
  return `${rate}x`;
}

/**
 * Why the dropped or picked files cannot be opened as one video, or null.
 * Files with an empty type are allowed through: browsers leave it blank for
 * containers they do not recognize (e.g. .mkv), and the element decides.
 */
export function videoFileProblem(
  files: readonly { name: string; type: string }[]
): string | null {
  if (files.length === 0) return "No file was selected.";
  if (files.length > 1) return "Open one video at a time.";
  const { type } = files[0]!;
  if (type === "" || type.startsWith("video/")) return null;
  if (type.startsWith("audio/")) return null;
  return "That file does not look like a video. Choose an MP4 or WebM file.";
}

/** `MediaError.code` as a sentence with a next step. */
export function mediaErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return "Loading stopped before the video was ready. Try choosing it again.";
    case 2:
      return "The video could not be read from disk. Try choosing it again.";
    case 3:
      return "This browser could not decode the video. Converting it to MP4 (H.264) usually helps.";
    case 4:
      return "This browser cannot play this file. Try an MP4 (H.264) or WebM video.";
    default:
      return "The video did not load. Try another file or another browser.";
  }
}

/** Where a relative seek lands, kept inside the video. */
export function seekTarget(
  current: number,
  delta: number,
  duration: number
): number {
  const from = Number.isFinite(current) ? current : 0;
  const target = from + delta;
  const end = Number.isFinite(duration) && duration > 0 ? duration : Infinity;
  return clamp(target, 0, end);
}
