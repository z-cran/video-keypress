import type { Episode } from "./recorder.ts";

export interface BehaviorTally {
  count: number;
  /** Sum of episode durations in seconds (overlaps are counted twice). */
  total: number;
  /** Mean duration, or null with no episodes. */
  mean: number | null;
  /** Share of the video, or null when the duration is unknown. */
  percentOfVideo: number | null;
}

const EMPTY: BehaviorTally = {
  count: 0,
  total: 0,
  mean: null,
  percentOfVideo: null
};

/** Per-behavior stats. Every id in `behaviorIds` gets an entry. */
export function summarize(
  episodes: readonly Episode[],
  behaviorIds: readonly string[],
  duration: number
): Map<string, BehaviorTally> {
  const sums = new Map<string, { count: number; total: number }>();
  for (const id of behaviorIds) sums.set(id, { count: 0, total: 0 });
  for (const e of episodes) {
    const sum = sums.get(e.behaviorId);
    if (!sum) continue;
    sum.count += 1;
    sum.total += e.end - e.start;
  }

  const knownDuration = Number.isFinite(duration) && duration > 0;
  const result = new Map<string, BehaviorTally>();
  for (const [id, { count, total }] of sums) {
    if (count === 0) {
      result.set(id, { ...EMPTY, percentOfVideo: knownDuration ? 0 : null });
      continue;
    }
    result.set(id, {
      count,
      total,
      mean: total / count,
      percentOfVideo: knownDuration ? (total / duration) * 100 : null
    });
  }
  return result;
}

/** Seconds an active episode has been running at video time `now`. */
export function liveElapsed(start: number, now: number): number {
  if (!Number.isFinite(now) || !Number.isFinite(start)) return 0;
  return Math.abs(now - start);
}

/**
 * Ids of episodes that overlap another episode of the same behavior. That
 * only happens after seeking back during a recording or importing a file;
 * the list flags them so the researcher can check.
 */
export function findOverlaps(episodes: readonly Episode[]): Set<string> {
  const byBehavior = new Map<string, Episode[]>();
  for (const e of episodes) {
    const list = byBehavior.get(e.behaviorId) ?? [];
    list.push(e);
    byBehavior.set(e.behaviorId, list);
  }
  const overlapping = new Set<string>();
  for (const list of byBehavior.values()) {
    const sorted = [...list].sort((a, b) => a.start - b.start);
    let reach: Episode | null = null;
    for (const e of sorted) {
      if (reach && e.start < reach.end) {
        overlapping.add(e.id);
        overlapping.add(reach.id);
      }
      if (!reach || e.end > reach.end) reach = e;
    }
  }
  return overlapping;
}
