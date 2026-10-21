import { newId } from "../../lib/id.ts";
import { notify } from "../../lib/noticeStore.ts";
import { useBehaviorsStore } from "../behaviors/behaviorsStore.ts";
import type { Episode } from "../recording/recorder.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import type { Session } from "./session.ts";

/**
 * Bring a saved or imported session's episodes into the current session.
 * Its behaviors are merged into the list first (matched by id, then name),
 * so every episode points at a behavior the app knows (ADR-014).
 * Returns how many episodes came in.
 */
export function adoptSession(
  incoming: Session,
  mode: "replace" | "add"
): number {
  const store = useSessionStore.getState();
  const current = store.session;
  if (!current) return 0;

  const { idMap, added } = useBehaviorsStore
    .getState()
    .mergeIn(incoming.behaviors);
  const known = new Set(
    useBehaviorsStore.getState().behaviors.map((b) => b.id)
  );
  const adopted: Episode[] = [];
  for (const e of incoming.episodes) {
    const behaviorId = idMap.get(e.behaviorId) ?? e.behaviorId;
    if (!known.has(behaviorId)) continue;
    // New ids, so adding never collides with episodes already here.
    adopted.push({ ...e, id: newId(), behaviorId });
  }

  const base = mode === "replace" ? [] : current.episodes;
  const episodes = [...base, ...adopted].sort((a, b) => a.start - b.start);
  store.setSession({
    ...current,
    createdAt:
      mode === "replace"
        ? incoming.createdAt || current.createdAt
        : current.createdAt,
    updatedAt: Date.now(),
    episodes
  });

  if (added.length > 0) {
    const names = added.map((b) => b.name).join(", ");
    notify(
      `Added ${names} to your behaviors so ${added.length === 1 ? "its" : "their"} episodes have a lane.`
    );
  }
  return adopted.length;
}
