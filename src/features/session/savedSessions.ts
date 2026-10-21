import type { NewId } from "../behaviors/behaviors.ts";
import { sanitizeBehaviors } from "../behaviors/behaviors.ts";
import type { Episode } from "../recording/recorder.ts";
import type { Session } from "./session.ts";

export const SESSION_PREFIX = "video-keypress:session:";

export type SaveResult = "saved" | "evicted" | "full";

export interface SavedSummary {
  fingerprint: string;
  fileName: string;
  updatedAt: number;
  episodes: number;
}

export interface SessionRepo {
  load: (fingerprint: string) => Session | null;
  /** "evicted": older sessions were removed to make room. "full": not saved. */
  save: (session: Session) => SaveResult;
  remove: (fingerprint: string) => void;
  /** Saved sessions, oldest first. */
  list: () => SavedSummary[];
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err.code === 22)
  );
}

const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/**
 * A stored session, or null if it is not one. Bad episodes are dropped
 * rather than failing the whole session.
 */
export function parseStoredSession(raw: unknown, newId: NewId): Session | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;
  const video = s.video as Record<string, unknown> | undefined;
  if (s.version !== 2 || typeof s.fingerprint !== "string") return null;
  if (typeof video?.fileName !== "string") return null;
  if (!Array.isArray(s.episodes)) return null;

  const behaviors = sanitizeBehaviors(s.behaviors, newId) ?? [];
  const known = new Set(behaviors.map((b) => b.id));
  const episodes: Episode[] = [];
  for (const item of s.episodes as unknown[]) {
    const e = item as Partial<Episode> | null;
    if (!e || typeof e.id !== "string" || typeof e.behaviorId !== "string")
      continue;
    if (!known.has(e.behaviorId) || !finite(e.start) || !finite(e.end))
      continue;
    if (e.start < 0 || e.end < 0) continue;
    episodes.push({
      id: e.id,
      behaviorId: e.behaviorId,
      start: Math.min(e.start, e.end),
      end: Math.max(e.start, e.end)
    });
  }
  episodes.sort((a, b) => a.start - b.start);

  return {
    version: 2,
    fingerprint: s.fingerprint,
    video: {
      fileName: video.fileName,
      size: finite(video.size) ? video.size : 0,
      lastModified: finite(video.lastModified) ? video.lastModified : 0,
      duration: finite(video.duration) ? video.duration : Number.NaN
    },
    createdAt: finite(s.createdAt) ? s.createdAt : 0,
    updatedAt: finite(s.updatedAt) ? s.updatedAt : 0,
    behaviors,
    episodes
  };
}

export function createSessionRepo(storage: Storage, newId: NewId): SessionRepo {
  const keyOf = (fingerprint: string) => `${SESSION_PREFIX}${fingerprint}`;

  const read = (key: string): Session | null => {
    try {
      const raw = storage.getItem(key);
      return raw ? parseStoredSession(JSON.parse(raw), newId) : null;
    } catch {
      return null; // corrupt entry: treat as nothing saved
    }
  };

  const list = (): SavedSummary[] => {
    const summaries: SavedSummary[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(SESSION_PREFIX)) continue;
      const session = read(key);
      summaries.push({
        fingerprint: key.slice(SESSION_PREFIX.length),
        fileName: session?.video.fileName ?? "",
        // Unreadable entries sort first, so they are evicted first.
        updatedAt: session?.updatedAt ?? -1,
        episodes: session?.episodes.length ?? 0
      });
    }
    return summaries.sort((a, b) => a.updatedAt - b.updatedAt);
  };

  return {
    load: (fingerprint) => read(keyOf(fingerprint)),
    remove: (fingerprint) => storage.removeItem(keyOf(fingerprint)),
    list,
    save: (session) => {
      if (!session.fingerprint) return "full";
      const key = keyOf(session.fingerprint);
      const value = JSON.stringify(session);
      let evicted = false;
      for (;;) {
        try {
          storage.setItem(key, value);
          return evicted ? "evicted" : "saved";
        } catch (err) {
          if (!isQuotaError(err)) throw err;
          const oldest = list().find(
            (s) => s.fingerprint !== session.fingerprint
          );
          if (!oldest) return "full";
          storage.removeItem(keyOf(oldest.fingerprint));
          evicted = true;
        }
      }
    }
  };
}
