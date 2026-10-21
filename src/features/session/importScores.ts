import { chooseAction, confirmAction } from "../../lib/confirmStore.ts";
import { newId } from "../../lib/id.ts";
import { notify } from "../../lib/noticeStore.ts";
import { usePlayerStore } from "../player/playerStore.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import { adoptSession } from "./adoptSession.ts";
import { MAX_IMPORT_BYTES, parseSessionFile } from "./sessionFormat.ts";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Load a JSON export. With no video open the scores are shown read-only;
 * with a video open they are attached to it (add to or replace its episodes).
 */
export async function importScores(file: File): Promise<void> {
  if (file.size > MAX_IMPORT_BYTES) {
    notify(
      "This file is larger than 10 MB, which is more than a scores file should be.",
      {
        severity: "warning"
      }
    );
    return;
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    notify("The file could not be read. Try choosing it again.", {
      severity: "warning"
    });
    return;
  }
  const parsed = parseSessionFile(text, newId, Date.now());
  if (!parsed.ok) {
    notify(parsed.message, { severity: "warning" });
    return;
  }

  const incoming = parsed.session;
  const n = incoming.episodes.length;
  const skippedNote =
    parsed.skipped > 0
      ? ` ${plural(parsed.skipped, "event")} with unreadable times were left out.`
      : "";
  const store = useSessionStore.getState();
  const current = store.session;

  if (!usePlayerStore.getState().source || !current?.fingerprint) {
    store.start({ ...incoming, behaviors: [], episodes: [] });
    adoptSession(incoming, "replace");
    notify(
      `Showing ${plural(n, "episode")} from ${file.name}. Open the matching video to keep scoring.${skippedNote}`,
      { severity: "success" }
    );
    return;
  }

  const otherVideo =
    incoming.video.fileName &&
    incoming.video.fileName !== current.video.fileName
      ? `These scores are for ${incoming.video.fileName}, and the open video is ${current.video.fileName}.`
      : null;
  let mode: "add" | "replace" = "replace";
  if (current.episodes.length > 0) {
    const choice = await chooseAction({
      title: "Import scores",
      message: [
        otherVideo,
        `This video already has ${plural(current.episodes.length, "episode")}. Add the ${plural(n, "imported episode")} to them, or replace them?`
      ]
        .filter(Boolean)
        .join("\n\n"),
      confirmLabel: "Add",
      alternativeLabel: "Replace"
    });
    if (choice === "cancel") return;
    mode = choice === "confirm" ? "add" : "replace";
  } else if (otherVideo) {
    const ok = await confirmAction({
      title: "Import scores for another file?",
      message: otherVideo,
      confirmLabel: "Import anyway"
    });
    if (!ok) return;
  }

  useSessionStore.getState().commitActive();
  const count = adoptSession(incoming, mode);
  notify(
    `Imported ${plural(count, "episode")} from ${file.name}.${skippedNote}`,
    {
      severity: "success"
    }
  );
}
