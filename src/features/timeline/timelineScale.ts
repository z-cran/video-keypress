import { clamp } from "../../lib/time.ts";
import type { Episode } from "../recording/recorder.ts";

export const AXIS_HEIGHT = 24;
export const LANE_HEIGHT = 28;
export const LANE_GAP = 6;
/** Bars thinner than this are drawn at this width so they stay visible. */
export const MIN_BAR_PX = 2;
export const ZOOMS: readonly number[] = [1, 2, 4, 8, 16, 32, 64, 128];

const TICK_STEPS = [
  0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600
];

export interface Scale {
  /** Seconds the timeline spans. Always > 0. */
  span: number;
  pxPerSec: number;
  /** Total drawing width in px; at least the container width. */
  width: number;
}

/** Fit `span` seconds into the container, then zoom in. */
export function makeScale(
  span: number,
  containerWidth: number,
  zoom: number
): Scale {
  const safeSpan = Number.isFinite(span) && span > 0 ? span : 1;
  const safeWidth = Math.max(1, containerWidth);
  const pxPerSec = (safeWidth / safeSpan) * Math.max(1, zoom);
  return {
    span: safeSpan,
    pxPerSec,
    width: Math.max(safeWidth, Math.ceil(safeSpan * pxPerSec))
  };
}

export function timeToX(scale: Scale, t: number): number {
  return t * scale.pxPerSec;
}

export function xToTime(scale: Scale, x: number): number {
  return clamp(x / scale.pxPerSec, 0, scale.span);
}

/** Tick times at least `minGapPx` apart, on a readable step. */
export function niceTicks(scale: Scale, minGapPx = 80): number[] {
  const step =
    TICK_STEPS.find((s) => s * scale.pxPerSec >= minGapPx) ??
    Math.ceil(minGapPx / scale.pxPerSec / 3600) * 3600;
  const ticks: number[] = [];
  // Multiply instead of summing so 0.1 steps do not drift (0.30000000000000004).
  for (let i = 0; i * step <= scale.span + 1e-9; i++) {
    ticks.push(Math.round(i * step * 1000) / 1000);
  }
  return ticks;
}

export function laneTop(index: number): number {
  return AXIS_HEIGHT + index * (LANE_HEIGHT + LANE_GAP);
}

export function chartHeight(lanes: number): number {
  return laneTop(lanes) + LANE_GAP;
}

/** Which lane a y position falls in (gaps count toward the lane above), or -1. */
export function laneAt(y: number, lanes: number): number {
  if (y < AXIS_HEIGHT) return -1;
  const index = Math.floor((y - AXIS_HEIGHT) / (LANE_HEIGHT + LANE_GAP));
  return index < lanes ? index : -1;
}

export interface Bar {
  episode: Episode;
  lane: number;
  x: number;
  width: number;
}

/** Position episodes; ones whose behavior has no lane are skipped. */
export function layoutBars(
  episodes: readonly Episode[],
  laneOf: ReadonlyMap<string, number>,
  scale: Scale
): Bar[] {
  const bars: Bar[] = [];
  for (const episode of episodes) {
    const lane = laneOf.get(episode.behaviorId);
    if (lane === undefined) continue;
    const x = timeToX(scale, episode.start);
    const width = Math.max(MIN_BAR_PX, timeToX(scale, episode.end) - x);
    bars.push({ episode, lane, x, width });
  }
  return bars;
}

/**
 * The bar under (x, lane), allowing `tolerancePx` either side so very short
 * episodes are still clickable. Closest wins; the selected bar wins ties.
 */
export function hitTest(
  bars: readonly Bar[],
  x: number,
  lane: number,
  tolerancePx = 6,
  selectedId: string | null = null
): Bar | null {
  let best: Bar | null = null;
  let bestDistance = Infinity;
  for (const bar of bars) {
    if (bar.lane !== lane) continue;
    const distance =
      x < bar.x
        ? bar.x - x
        : x > bar.x + bar.width
          ? x - (bar.x + bar.width)
          : 0;
    if (distance > tolerancePx) continue;
    const better =
      distance < bestDistance ||
      (distance === bestDistance && bar.episode.id === selectedId);
    if (better) {
      best = bar;
      bestDistance = distance;
    }
  }
  return best;
}

/** Seconds the timeline should cover when the duration is not known yet. */
export function timelineSpan(
  duration: number,
  episodes: readonly Episode[],
  currentTime: number
): number {
  if (Number.isFinite(duration) && duration > 0) return duration;
  const lastEnd = episodes.reduce((max, e) => Math.max(max, e.end), 0);
  return Math.max(1, lastEnd, Number.isFinite(currentTime) ? currentTime : 0);
}
