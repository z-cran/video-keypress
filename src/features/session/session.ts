import type { Behavior } from "../behaviors/behaviors.ts";
import type { Episode } from "../recording/recorder.ts";

export interface VideoInfo {
  fileName: string;
  size: number;
  lastModified: number;
  /** Seconds; NaN until the video's metadata loads. */
  duration: number;
}

export interface Session {
  version: 2;
  /** Identifies the video file for autosave. Null for an import with no video (read-only). */
  fingerprint: string | null;
  video: VideoInfo;
  /** ms since epoch */
  createdAt: number;
  updatedAt: number;
  /** The behaviors the episodes use, so the session stands on its own. */
  behaviors: Behavior[];
  /** Sorted by start. */
  episodes: Episode[];
}

export function fingerprintOf(file: {
  name: string;
  size: number;
  lastModified: number;
}): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function newSession(
  video: VideoInfo,
  fingerprint: string | null,
  now: number
): Session {
  return {
    version: 2,
    fingerprint,
    video,
    createdAt: now,
    updatedAt: now,
    behaviors: [],
    episodes: []
  };
}

/**
 * The behaviors referenced by the session's episodes, taken from the current
 * list where possible and from the previous snapshot otherwise.
 */
export function snapshotBehaviors(
  session: Session,
  current: readonly Behavior[]
): Behavior[] {
  const used = new Set(session.episodes.map((e) => e.behaviorId));
  const byId = new Map(session.behaviors.map((b) => [b.id, b]));
  for (const b of current) byId.set(b.id, b);
  const ordered = [
    ...current.filter((b) => used.has(b.id)),
    ...session.behaviors.filter(
      (b) => used.has(b.id) && !current.some((c) => c.id === b.id)
    )
  ];
  return ordered.map((b) => byId.get(b.id) ?? b);
}
