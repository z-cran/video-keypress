import { roundMs } from "../../lib/time.ts";
import type { Behavior, NewId } from "../behaviors/behaviors.ts";

export interface Episode {
  id: string;
  behaviorId: string;
  /** Seconds into the video. Always `start <= end`. */
  start: number;
  end: number;
}

/** Who is holding a hold-mode episode open: the hotkey or a pointer. */
export type Holder = "key" | `pointer:${number}`;

export interface ActiveEpisode {
  behaviorId: string;
  start: number;
  /** Empty for toggle-mode episodes. */
  holders: readonly Holder[];
}

/** At most one active episode per behavior, keyed by behavior id. */
export type Active = Readonly<Record<string, ActiveEpisode>>;

export interface MediaState {
  /** Metadata has loaded, so `currentTime` means something. */
  ready: boolean;
  paused: boolean;
}

export type Blocked = "no-video" | "paused-hold";

export interface Step {
  active: Active;
  committed: Episode | null;
  blocked: Blocked | null;
}

/**
 * Close an active episode at time `t`. Seeking back during an episode makes
 * `t` earlier than the start; keep min and max instead of a negative length.
 */
export function closeEpisode(a: ActiveEpisode, t: number, id: string): Episode {
  const at = Number.isFinite(t) ? t : a.start;
  return {
    id,
    behaviorId: a.behaviorId,
    start: roundMs(Math.min(a.start, at)),
    end: roundMs(Math.max(a.start, at))
  };
}

function without(active: Active, behaviorId: string): Active {
  const next = { ...active };
  delete next[behaviorId];
  return next;
}

/**
 * A key or pointer went down on a behavior.
 * - hold: starts an episode, or adds a holder to the running one.
 * - toggle: starts an episode, or ends the running one.
 * Starting needs a loaded video; a hold also needs it to be playing.
 */
export function press(
  active: Active,
  behavior: Pick<Behavior, "id" | "mode">,
  holder: Holder,
  t: number,
  media: MediaState,
  newId: NewId
): Step {
  const running = active[behavior.id];

  if (running && behavior.mode === "toggle") {
    return {
      active: without(active, behavior.id),
      committed: closeEpisode(running, t, newId()),
      blocked: null
    };
  }
  if (running) {
    if (running.holders.includes(holder)) {
      return { active, committed: null, blocked: null };
    }
    return {
      active: {
        ...active,
        [behavior.id]: { ...running, holders: [...running.holders, holder] }
      },
      committed: null,
      blocked: null
    };
  }

  if (!media.ready || !Number.isFinite(t)) {
    return { active, committed: null, blocked: "no-video" };
  }
  if (behavior.mode === "hold" && media.paused) {
    return { active, committed: null, blocked: "paused-hold" };
  }
  return {
    active: {
      ...active,
      [behavior.id]: {
        behaviorId: behavior.id,
        start: roundMs(t),
        holders: behavior.mode === "hold" ? [holder] : []
      }
    },
    committed: null,
    blocked: null
  };
}

/**
 * A key or pointer came up. A hold episode ends when its last holder lets
 * go. Toggle episodes and unknown holders are left alone.
 */
export function release(
  active: Active,
  behaviorId: string,
  holder: Holder,
  t: number,
  newId: NewId
): Step {
  const running = active[behaviorId];
  if (!running || !running.holders.includes(holder)) {
    return { active, committed: null, blocked: null };
  }
  const holders = running.holders.filter((h) => h !== holder);
  if (holders.length > 0) {
    return {
      active: { ...active, [behaviorId]: { ...running, holders } },
      committed: null,
      blocked: null
    };
  }
  return {
    active: without(active, behaviorId),
    committed: closeEpisode(running, t, newId()),
    blocked: null
  };
}

/**
 * Drop every holder matching `predicate` (for example all key holders when
 * the window loses focus) and end the hold episodes left with none.
 */
export function releaseWhere(
  active: Active,
  predicate: (holder: Holder) => boolean,
  t: number,
  newId: NewId
): { active: Active; committed: Episode[] } {
  let next: Active = active;
  const committed: Episode[] = [];
  for (const running of Object.values(active)) {
    if (!running.holders.some(predicate)) continue;
    const holders = running.holders.filter((h) => !predicate(h));
    if (holders.length > 0) {
      next = { ...next, [running.behaviorId]: { ...running, holders } };
    } else {
      next = without(next, running.behaviorId);
      committed.push(closeEpisode(running, t, newId()));
    }
  }
  return { active: next, committed };
}

/** End every active episode, hold and toggle, e.g. before switching videos. */
export function commitAll(active: Active, t: number, newId: NewId): Episode[] {
  return Object.values(active).map((a) => closeEpisode(a, t, newId()));
}

/** Insert keeping episodes sorted by start (stable for equal starts). */
export function insertEpisode(
  episodes: readonly Episode[],
  episode: Episode
): Episode[] {
  const index = episodes.findIndex((e) => e.start > episode.start);
  if (index < 0) return [...episodes, episode];
  return [...episodes.slice(0, index), episode, ...episodes.slice(index)];
}
