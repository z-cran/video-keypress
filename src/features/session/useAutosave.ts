import { useEffect } from "react";
import { newId } from "../../lib/id.ts";
import { notify } from "../../lib/noticeStore.ts";
import type { Behavior } from "../behaviors/behaviors.ts";
import { useBehaviorsStore } from "../behaviors/behaviorsStore.ts";
import { usePlayerStore } from "../player/playerStore.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import { offerRestore } from "./restoreSession.ts";
import { createSessionRepo } from "./savedSessions.ts";
import { snapshotBehaviors, type Session } from "./session.ts";

const warnOnLeave = (e: BeforeUnloadEvent) => e.preventDefault();

/**
 * Write the session to localStorage on every change (ADR-013), and offer a
 * saved session for restore once a newly opened video's duration is known.
 */
export function useAutosave() {
  useEffect(() => {
    const repo = createSessionRepo(localStorage, newId);
    let lastSession: Session | null = null;
    let lastBehaviors: Behavior[] | null = null;
    let full = false;
    let broken = false;

    const write = () => {
      const { session, autosave } = useSessionStore.getState();
      const { behaviors } = useBehaviorsStore.getState();
      if (!session?.fingerprint || !autosave || broken) return;
      if (session === lastSession && behaviors === lastBehaviors) return;
      lastSession = session;
      lastBehaviors = behaviors;

      try {
        if (session.episodes.length === 0) {
          repo.remove(session.fingerprint);
          return;
        }
        const result = repo.save({
          ...session,
          behaviors: snapshotBehaviors(session, behaviors)
        });
        if (result === "full" && !full) {
          full = true;
          window.addEventListener("beforeunload", warnOnLeave);
          notify(
            "Autosave is paused because browser storage is full. Export your episodes to keep them.",
            { severity: "warning", sticky: true }
          );
        } else if (result !== "full" && full) {
          full = false;
          window.removeEventListener("beforeunload", warnOnLeave);
        }
        if (result === "evicted") {
          notify(
            "Older saved sessions were removed to make room for this one."
          );
        }
      } catch {
        // Storage is blocked (private mode, site data disabled).
        broken = true;
        window.addEventListener("beforeunload", warnOnLeave);
        notify(
          "This browser window cannot save your progress. Export your episodes before closing it.",
          { severity: "warning", sticky: true }
        );
      }
    };

    const onPlayer = (
      state: ReturnType<typeof usePlayerStore.getState>,
      prev: ReturnType<typeof usePlayerStore.getState>
    ) => {
      if (state.duration === prev.duration || !Number.isFinite(state.duration))
        return;
      useSessionStore.getState().setDuration(state.duration);
      void offerRestore(repo);
    };

    const unsubscribe = [
      useSessionStore.subscribe(write),
      useBehaviorsStore.subscribe(write),
      usePlayerStore.subscribe(onPlayer)
    ];
    return () => {
      unsubscribe.forEach((fn) => fn());
      window.removeEventListener("beforeunload", warnOnLeave);
    };
  }, []);
}
