import { useMemo } from "react";
import { useBehaviorsStore } from "../behaviors/behaviorsStore.ts";
import { useSessionStore } from "./sessionStore.ts";
import { summarize } from "./tally.ts";

const NO_EPISODES: never[] = [];

/** Per-behavior stats for the current session, recomputed only on change. */
export function useTally() {
  const behaviors = useBehaviorsStore((s) => s.behaviors);
  const episodes = useSessionStore((s) => s.session?.episodes ?? NO_EPISODES);
  const duration = useSessionStore(
    (s) => s.session?.video.duration ?? Number.NaN
  );
  return useMemo(
    () =>
      summarize(
        episodes,
        behaviors.map((b) => b.id),
        duration
      ),
    [episodes, behaviors, duration]
  );
}
