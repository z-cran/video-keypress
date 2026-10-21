import { confirmAction } from "../../lib/confirmStore.ts";
import { notify } from "../../lib/noticeStore.ts";
import { videoFileProblem } from "../player/playback.ts";
import { usePlayerStore } from "../player/playerStore.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import { adoptSession } from "./adoptSession.ts";
import { importScores } from "./importScores.ts";
import { fingerprintOf, newSession } from "./session.ts";

/** Open a picked or dropped file as the current video and start scoring it. */
export async function openVideo(files: readonly File[]): Promise<void> {
  const problem = videoFileProblem(files);
  if (problem) {
    notify(problem, { severity: "warning" });
    return;
  }
  const file = files[0]!;
  const store = useSessionStore.getState();

  // Scores imported without a video can be attached to the video opened next.
  const imported =
    store.session &&
    !store.session.fingerprint &&
    store.session.episodes.length > 0
      ? store.session
      : null;
  let attach = false;
  if (imported) {
    const n = imported.episodes.length;
    const otherFile =
      imported.video.fileName && imported.video.fileName !== file.name
        ? ` The scores were recorded on ${imported.video.fileName}.`
        : "";
    attach = await confirmAction({
      title: "Keep the imported episodes?",
      message: `Attach the ${n} imported ${n === 1 ? "episode" : "episodes"} to ${file.name} and keep scoring?${otherFile}`,
      confirmLabel: "Attach",
      cancelLabel: "Discard"
    });
  }

  // Finish anything still recording against the old video before it goes.
  store.commitActive();
  usePlayerStore.getState().openFile(file);
  store.start(
    newSession(
      {
        fileName: file.name,
        size: file.size,
        lastModified: file.lastModified,
        duration: Number.NaN
      },
      fingerprintOf(file),
      Date.now()
    ),
    // Attaching replaces any autosave for this video, so skip the restore offer.
    { autosave: attach }
  );
  if (attach && imported) adoptSession(imported, "replace");
}

const isJson = (f: File) =>
  f.type === "application/json" || /\.json$/i.test(f.name);

/** Route picked or dropped files: JSON is imported, anything else is a video. */
export function openFiles(files: readonly File[]): void {
  if (files.some(isJson)) {
    if (files.length > 1) {
      notify("Open one file at a time.", { severity: "warning" });
      return;
    }
    void importScores(files[0]!);
    return;
  }
  void openVideo(files);
}
