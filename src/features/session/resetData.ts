import { chooseAction } from "../../lib/confirmStore.ts";
import { newId } from "../../lib/id.ts";
import { notify } from "../../lib/noticeStore.ts";
import {
  LEGACY_KEYBINDS_KEY,
  useBehaviorsStore
} from "../behaviors/behaviorsStore.ts";
import { usePlayerStore } from "../player/playerStore.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import { useExportPrefs } from "./exportPrefsStore.ts";
import { createSessionRepo } from "./savedSessions.ts";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Delete every saved session, and the episodes of the one that is open.
 * The open session is emptied first: autosave would otherwise write it
 * straight back on the next change.
 */
export function clearSavedSessions(): void {
  const store = useSessionStore.getState();
  if (store.session?.fingerprint) store.clearEpisodes();
  else store.clear(); // imported scores with no video: nothing left to show
  const repo = createSessionRepo(localStorage, newId);
  for (const saved of repo.list()) repo.remove(saved.fingerprint);
}

/** Saved sessions plus behaviors, hotkeys, speed, mute and CSV columns. */
export function resetEverything(): void {
  clearSavedSessions();
  useBehaviorsStore.getState().resetToDefaults();
  const player = usePlayerStore.getState();
  player.setRate(1);
  player.setMuted(false);
  const prefs = useExportPrefs.getInitialState();
  useExportPrefs.setState({
    episodeColumns: prefs.episodeColumns,
    summaryColumns: prefs.summaryColumns
  });
  localStorage.removeItem(LEGACY_KEYBINDS_KEY);
}

/**
 * Ask what to reset, then do it. Resolves to what was reset, so the caller
 * can reset what it owns too (the theme lives in MUI's color scheme hook).
 */
export async function askAndResetData(): Promise<
  "sessions" | "everything" | null
> {
  const saved = createSessionRepo(localStorage, newId).list();
  const episodes = saved.reduce((n, s) => n + s.episodes, 0);
  const stored =
    saved.length === 0
      ? "No sessions are saved in this browser."
      : `This browser has ${plural(saved.length, "saved session")} with ${plural(episodes, "episode")}.`;

  const choice = await chooseAction({
    title: "Reset saved data?",
    message: [
      stored,
      "Clear saved sessions deletes every saved episode, including the open video's. Reset everything also restores the default behaviors, hotkeys and settings.",
      "This cannot be undone. Export anything you want to keep first."
    ].join("\n\n"),
    alternativeLabel: "Clear saved sessions",
    confirmLabel: "Reset everything",
    destructive: true
  });

  if (choice === "alternative") {
    clearSavedSessions();
    notify("Saved sessions cleared.", { severity: "success" });
    return "sessions";
  }
  if (choice === "confirm") {
    resetEverything();
    notify("Everything is back to the defaults.", { severity: "success" });
    return "everything";
  }
  return null;
}
