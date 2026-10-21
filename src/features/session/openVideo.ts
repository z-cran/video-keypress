import { notify } from "../../lib/noticeStore.ts";
import { videoFileProblem } from "../player/playback.ts";
import { usePlayerStore } from "../player/playerStore.ts";
import { useSessionStore } from "../recording/sessionStore.ts";
import { fingerprintOf, newSession } from "./session.ts";

/** Open a picked or dropped file as the current video and start scoring it. */
export function openVideo(files: readonly File[]): void {
  const problem = videoFileProblem(files);
  if (problem) {
    notify(problem, { severity: "warning" });
    return;
  }
  const file = files[0]!;
  const session = useSessionStore.getState();
  // Finish anything still recording against the old video before it goes.
  session.commitActive();
  usePlayerStore.getState().openFile(file);
  session.start(
    newSession(
      {
        fileName: file.name,
        size: file.size,
        lastModified: file.lastModified,
        duration: Number.NaN
      },
      fingerprintOf(file),
      Date.now()
    )
  );
}
