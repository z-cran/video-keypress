import { confirmAction } from "../../lib/confirmStore.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import { adoptSession } from "./adoptSession.ts";
import type { SessionRepo } from "./savedSessions.ts";

/** Saved and loaded durations further apart than this are different videos. */
const DURATION_TOLERANCE = 0.5;

let asking: string | null = null;

/**
 * Once the new video's duration is known, offer any saved session for it.
 * Autosave stays off until this has run, so nothing saved is overwritten.
 */
export async function offerRestore(repo: SessionRepo): Promise<void> {
  const store = useSessionStore.getState();
  const session = store.session;
  const fingerprint = session?.fingerprint;
  if (!session || !fingerprint || store.autosave || asking === fingerprint)
    return;

  const saved = repo.load(fingerprint);
  const duration = session.video.duration;
  const sameVideo =
    saved !== null &&
    (!Number.isFinite(saved.video.duration) ||
      !Number.isFinite(duration) ||
      Math.abs(saved.video.duration - duration) <= DURATION_TOLERANCE);
  if (!saved || !sameVideo || saved.episodes.length === 0) {
    store.enableAutosave();
    return;
  }

  asking = fingerprint;
  try {
    const n = saved.episodes.length;
    const episodes = `${n} saved ${n === 1 ? "episode" : "episodes"}`;
    let resume = await confirmAction({
      title: "Continue where you left off?",
      message: `This video has ${episodes} from ${new Date(saved.updatedAt).toLocaleString()}.`,
      confirmLabel: "Continue",
      cancelLabel: "Start over"
    });
    if (!resume) {
      const discard = await confirmAction({
        title: "Start over?",
        message: `The ${episodes} for this video will be deleted.`,
        confirmLabel: "Delete and start over",
        cancelLabel: "Keep them",
        destructive: true
      });
      if (discard) repo.remove(fingerprint);
      resume = !discard;
    }
    // The researcher may have opened another video while deciding.
    if (useSessionStore.getState().session?.fingerprint !== fingerprint) return;
    if (resume) adoptSession(saved, "replace");
    useSessionStore.getState().enableAutosave();
  } finally {
    asking = null;
  }
}
