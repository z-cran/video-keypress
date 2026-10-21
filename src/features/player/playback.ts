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
