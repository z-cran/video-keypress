import { confirmAction } from "../../lib/confirmStore.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import type { Behavior } from "./behaviors.ts";

/**
 * Removing a behavior removes its episodes from the current session, so every
 * episode keeps pointing at a behavior in the list. Ask first if any exist.
 */
export async function confirmBehaviorRemoval(
  removed: readonly Behavior[]
): Promise<boolean> {
  const episodes = useSessionStore.getState().session?.episodes ?? [];
  const ids = new Set(removed.map((b) => b.id));
  const affected = removed.filter((b) =>
    episodes.some((e) => e.behaviorId === b.id)
  );
  if (affected.length > 0) {
    const count = episodes.filter((e) => ids.has(e.behaviorId)).length;
    const names = affected.map((b) => b.name).join(", ");
    const ok = await confirmAction({
      title: "Delete episodes too?",
      message: `${names} ${affected.length === 1 ? "has" : "have"} ${count} ${count === 1 ? "episode" : "episodes"} in this video. Removing ${affected.length === 1 ? "it" : "them"} also deletes those episodes.`,
      confirmLabel: "Remove and delete episodes",
      destructive: true
    });
    if (!ok) return false;
  }
  useSessionStore.getState().deleteEpisodesOf([...ids]);
  return true;
}
