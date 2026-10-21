import { useEffect } from "react";
import { usePlayerStore } from "../player/playerStore.ts";
import { useSessionStore } from "../recording/sessionStore.ts";

/** Copy the video's duration into the session once the browser knows it. */
export function useSessionDuration() {
  useEffect(
    () =>
      usePlayerStore.subscribe((state, prev) => {
        if (
          state.duration !== prev.duration &&
          Number.isFinite(state.duration)
        ) {
          useSessionStore.getState().setDuration(state.duration);
        }
      }),
    []
  );
}
