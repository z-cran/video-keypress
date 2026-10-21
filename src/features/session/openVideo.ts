import { notify } from "../../lib/noticeStore.ts";
import { videoFileProblem } from "../player/playback.ts";
import { usePlayerStore } from "../player/playerStore.ts";

/** Open a picked or dropped file as the current video. */
export function openVideo(files: readonly File[]): void {
  const problem = videoFileProblem(files);
  if (problem) {
    notify(problem, { severity: "warning" });
    return;
  }
  usePlayerStore.getState().openFile(files[0]!);
}
