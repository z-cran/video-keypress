import { create } from "zustand";
import { newId } from "../../lib/id.ts";
import { notify } from "../../lib/noticeStore.ts";
import type { Behavior } from "../behaviors/behaviors.ts";
import { usePlayerStore } from "../player/playerStore.ts";
import type { Session } from "../session/session.ts";
import {
  commitAll,
  insertEpisode,
  press,
  release,
  releaseWhere,
  type Active,
  type Episode,
  type Holder
} from "./recorder.ts";

interface SessionState {
  session: Session | null;
  active: Active;
  selectedId: string | null;
  /**
   * Off for a newly opened video until any saved session has been offered
   * for restore; otherwise the empty new session would overwrite it.
   */
  autosave: boolean;

  /** Replace the current session. Active episodes are dropped. */
  start: (session: Session, options?: { autosave?: boolean }) => void;
  /** Swap in a changed session (e.g. after a restore or import). */
  setSession: (session: Session) => void;
  enableAutosave: () => void;
  /** Drop every episode, recorded or in progress; the video stays open. */
  clearEpisodes: () => void;
  clear: () => void;
  setDuration: (duration: number) => void;

  press: (behavior: Behavior, holder: Holder) => void;
  release: (behaviorId: string, holder: Holder) => void;
  /** Keyups may never arrive (focus left the window); end key holds now. */
  releaseKeyHolds: () => void;
  /** End every active episode at the current time, e.g. before switching videos. */
  commitActive: () => void;

  select: (id: string | null) => void;
  deleteEpisode: (id: string) => void;
  /** Delete a behavior's episodes before the behavior itself is removed. */
  deleteEpisodesOf: (behaviorIds: readonly string[]) => void;
}

function withEpisodes(session: Session, episodes: Episode[]): Session {
  return { ...session, episodes, updatedAt: Date.now() };
}

function addEpisodes(session: Session, added: readonly Episode[]): Session {
  if (added.length === 0) return session;
  return withEpisodes(session, added.reduce(insertEpisode, session.episodes));
}

function mediaNow() {
  const player = usePlayerStore.getState();
  return {
    t: player.getTime(),
    media: { ready: player.ready, paused: player.el?.paused ?? true }
  };
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  session: null,
  active: {},
  selectedId: null,
  autosave: false,

  start: (session, options) =>
    set({
      session,
      active: {},
      selectedId: null,
      autosave: options?.autosave ?? false
    }),
  setSession: (session) => set({ session }),
  enableAutosave: () => set({ autosave: true }),
  clearEpisodes: () => {
    const { session } = get();
    if (!session) return;
    set({
      session: withEpisodes(session, []),
      active: {},
      selectedId: null
    });
  },
  clear: () =>
    set({ session: null, active: {}, selectedId: null, autosave: false }),

  setDuration: (duration) => {
    const { session } = get();
    if (!session || session.video.duration === duration) return;
    set({ session: { ...session, video: { ...session.video, duration } } });
  },

  press: (behavior, holder) => {
    const { session, active } = get();
    // Read-only sessions (an import with no video) cannot record.
    if (!session?.fingerprint) return;
    const { t, media } = mediaNow();
    const step = press(active, behavior, holder, t, media, newId);
    if (step.blocked === "paused-hold") {
      notify(
        `Press play first, or set ${behavior.name} to Toggle in Behaviors to score while paused.`
      );
    }
    set({
      active: step.active,
      session: step.committed ? addEpisodes(session, [step.committed]) : session
    });
  },

  release: (behaviorId, holder) => {
    const { session, active } = get();
    if (!session || !active[behaviorId]) return;
    const step = release(active, behaviorId, holder, mediaNow().t, newId);
    set({
      active: step.active,
      session: step.committed ? addEpisodes(session, [step.committed]) : session
    });
  },

  releaseKeyHolds: () => {
    const { session, active } = get();
    if (!session || Object.keys(active).length === 0) return;
    const result = releaseWhere(
      active,
      (h) => h === "key",
      mediaNow().t,
      newId
    );
    set({
      active: result.active,
      session: addEpisodes(session, result.committed)
    });
  },

  commitActive: () => {
    const { session, active } = get();
    if (!session || Object.keys(active).length === 0) return;
    const committed = commitAll(active, mediaNow().t, newId);
    set({ active: {}, session: addEpisodes(session, committed) });
  },

  select: (selectedId) => set({ selectedId }),

  deleteEpisode: (id) => {
    const { session } = get();
    const episode = session?.episodes.find((e) => e.id === id);
    if (!session || !episode) return;
    set({
      session: withEpisodes(
        session,
        session.episodes.filter((e) => e.id !== id)
      ),
      selectedId: get().selectedId === id ? null : get().selectedId
    });
    notify("Episode deleted.", {
      action: {
        label: "Undo",
        run: () => {
          const current = get().session;
          // Only undo into the same session, and only once.
          if (current?.createdAt !== session.createdAt) return;
          if (current.episodes.some((e) => e.id === id)) return;
          set({ session: addEpisodes(current, [episode]) });
        }
      }
    });
  },

  deleteEpisodesOf: (behaviorIds) => {
    const { session, active } = get();
    if (!session) return;
    const ids = new Set(behaviorIds);
    const nextActive = { ...active };
    for (const id of ids) delete nextActive[id];
    set({
      active: nextActive,
      session: withEpisodes(
        session,
        session.episodes.filter((e) => !ids.has(e.behaviorId))
      )
    });
  }
}));
